// ============================================================================
//  src/lib/storage.js — stocare media pe Backblaze B2 (S3-compatibil)
// ----------------------------------------------------------------------------
//  Folosește aws4fetch (~3KB), nu AWS SDK. AWS SDK are câteva sute de KB după
//  bundling și riscă să depășească limita de dimensiune a unui Worker.
//
//  ── DE CE NU SE PROCESEAZĂ IMAGINILE AICI ─────────────────────────────────
//  sharp e o librărie nativă C++ și NU rulează în Cloudflare Workers (doar
//  JS/WASM). Procesarea (redimensionare + compresie) se face în BROWSER,
//  înainte de upload — vezi compresia din panoul de admin (Batch 10).
//  Worker-ul primește fișierul deja procesat și doar îl stochează.
//
//  ── ORGANIZAREA FIȘIERELOR ────────────────────────────────────────────────
//  Cheile în B2:  cars/<car_id>/<media_id>.jpg
//                 branding/<tip>-<timestamp>.jpg   (logo, banner — Batch 11)
//
//  Structura pe „foldere" (prefixe) face ștergerea unei mașini simplă: ștergi
//  toate obiectele cu prefixul cars/<car_id>/. Nu derivăm niciodată calea din
//  URL — o ținem în DB — deci nu există capcana „split('/').pop()".
// ============================================================================

import { AwsClient } from 'aws4fetch';

// Construiește clientul din secretele de mediu. Un client per cerere e ok în
// Workers (sunt obiecte ieftine), dar îl cache-uim pe `c` dacă e nevoie.
export const makeClient = (env) => {
    return new AwsClient({
        accessKeyId: env.B2_ACCESS_KEY_ID,
        secretAccessKey: env.B2_SECRET_ACCESS_KEY,
        service: 's3',
        // Regiunea o extragem din endpoint dacă nu e dată separat.
        region: env.B2_REGION || regionFromEndpoint(env.B2_ENDPOINT) || 'us-west-004',
    });
};

const regionFromEndpoint = (endpoint) => {
    // https://s3.us-west-004.backblazeb2.com → us-west-004
    const m = /s3\.([a-z0-9-]+)\.backblazeb2\.com/i.exec(endpoint || '');
    return m ? m[1] : null;
};

// URL-ul complet al unui obiect în B2.
const objectUrl = (env, key) => {
    const base = String(env.B2_ENDPOINT || '').replace(/\/+$/, '');
    return `${base}/${env.B2_BUCKET_NAME}/${key}`;
};

// ── ID scurt pentru un fișier media ──────────────────────────────────────────
export const mediaId = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
};

// Extensia permisă din content-type. Doar imagini — video nu în v1.
const EXT_BY_TYPE = {
    'image/jpeg': 'jpg',
    'image/jpg':  'jpg',
    'image/png':  'png',
    'image/webp': 'webp',
};

export const extFromType = (contentType) => EXT_BY_TYPE[String(contentType || '').toLowerCase()] || null;

// ── Verificare că bytes-ii chiar sunt o imagine (magic bytes) ─────────────────
//  Nu ne bazăm pe content-type-ul declarat — cineva poate minți. Verificăm
//  primii octeți. E o barieră ieftină contra fișierelor deghizate.
export const sniffImage = (bytes) => {
    if (!bytes || bytes.length < 12) return null;
    // JPEG: FF D8 FF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
    // PNG: 89 50 4E 47
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
    // WEBP: RIFF....WEBP
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'webp';
    return null;
};

/**
 * Urcă un fișier în B2.
 * @param {object} env
 * @param {string} key   'cars/<id>/<mediaId>.jpg'
 * @param {ArrayBuffer|Uint8Array} body
 * @param {string} contentType
 * @returns {Promise<boolean>}
 */
export const putObject = async (env, key, body, contentType) => {
    const client = makeClient(env);
    const res = await client.fetch(objectUrl(env, key), {
        method: 'PUT',
        headers: {
            'content-type': contentType || 'application/octet-stream',
            // Cache lung: cheia conține un id unic, deci fișierul nu se schimbă.
            'cache-control': 'public, max-age=31536000, immutable',
        },
        body,
    });
    if (!res.ok) {
        const txt = await res.text().catch(() => '');
        console.error(`[storage] PUT ${key} → ${res.status}: ${txt.slice(0, 200)}`);
        return false;
    }
    return true;
};

/**
 * Șterge un obiect din B2. Best-effort — nu aruncă.
 */
export const deleteObject = async (env, key) => {
    try {
        const client = makeClient(env);
        const res = await client.fetch(objectUrl(env, key), { method: 'DELETE' });
        // B2 întoarce 200 la succes; 404 înseamnă deja șters — ambele ok.
        if (!res.ok && res.status !== 404) {
            console.warn(`[storage] DELETE ${key} → ${res.status}`);
            return false;
        }
        return true;
    } catch (err) {
        console.warn(`[storage] DELETE ${key}:`, err.message);
        return false;
    }
};

/**
 * Șterge toate fișierele unei mașini, pe baza listei `media` din DB.
 * Fiecare intrare are forma { id, ext }.
 */
export const deleteCarMedia = async (env, carId, mediaList) => {
    const items = Array.isArray(mediaList) ? mediaList : [];
    let deleted = 0;
    // Le ștergem în paralel; niciun eșec nu blochează restul.
    await Promise.all(items.map(async (m) => {
        if (!m || !m.id) return;
        const key = `cars/${carId}/${m.id}.${m.ext || 'jpg'}`;
        if (await deleteObject(env, key)) deleted++;
    }));
    return deleted;
};

/** Cheia pentru un fișier de mașină. */
export const carKey = (carId, id, ext) => `cars/${carId}/${id}.${ext || 'jpg'}`;

export default {
    makeClient, mediaId, extFromType, sniffImage,
    putObject, deleteObject, deleteCarMedia, carKey,
};
