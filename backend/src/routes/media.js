// ============================================================================
//  src/routes/media.js — upload, servire, ștergere și curățare de fotografii
// ----------------------------------------------------------------------------
//  Fluxul de upload al unei mașini, în doi pași:
//    1. Panoul urcă fiecare poză (deja comprimată în browser) la
//       POST /api/admin/media  → primește înapoi un obiect { id, ext, w, h }
//    2. La salvarea mașinii, panoul trimite array-ul de obiecte în câmpul
//       `media` al anunțului (ruta din Batch 2).
//
//  De ce în doi pași și nu totul odată: uploadul poate fi lung (20 de poze).
//  Separat, panoul arată progres per poză și utilizatorul vede clar ce s-a
//  încărcat înainte să apese „Salvează".
//
//  Servirea: /media/cars/<car_id>/<media_id>.jpg — Worker-ul citește din B2 și
//  întoarce fișierul cu cache lung. Cloudflare pune apoi în cache la edge, deci
//  a doua cerere nici nu mai ajunge la Worker.
//
//  ── ORFANI ────────────────────────────────────────────────────────────────
//  Fiecare upload reușit se înregistrează și în tabelul `media_uploads`
//  (ledger). DELETE /api/admin/media/:carId/:file (Strat 1: userul apasă „✕"
//  în formular, înainte de Salvează) șterge imediat din B2 + din ledger. Ce
//  scapă de Stratul 1 (tab închis, upload urmat de eroare la salvare, etc.) e
//  prins mai târziu de sweep-ul programat din src/lib/sweep.js (Strat 3).
// ============================================================================

import { Hono } from 'hono';
import { requireAuth } from '../auth.js';
import {
    makeClient, mediaId, extFromType, sniffImage, putObject, deleteObject, carKey,
} from '../lib/storage.js';
import { LIMITS } from '../data/carOptions.js';
import { isMediaAttached } from '../lib/mediaCheck.js';

const DIR_RE = /^[a-zA-Z0-9_-]{1,64}$/;
const FILE_RE = /^[a-f0-9]{24}\.(jpg|png|webp)$/;

const MAX_BYTES = LIMITS.max_photo_bytes;   // 15 MB

// ── UPLOAD (admin) ───────────────────────────────────────────────────────────
const adminMedia = new Hono();
adminMedia.use('*', requireAuth);

//  POST /api/admin/media
//  Corpul e fișierul brut (application/octet-stream sau image/*), plus, opțional,
//  dimensiunile reale ca query (?w=1600&h=1200), pe care browserul le știe deja.
//  De ce dimensiunile din browser: le folosim la <img width height> pentru CLS 0.
adminMedia.post('/', async (c) => {
    const env = c.env;
    const contentType = c.req.header('content-type') || '';

    // car_id opțional: dacă mașina nu e încă salvată, folosim un dosar temporar
    // pe care îl mutăm la salvare. Mai simplu: cerem car_id doar la editare;
    // la adăugare punem într-un id de sesiune de upload.
    const carId = c.req.query('car_id') || c.req.query('draft_id') || 'draft';
    // Folderul ajunge în cheia din B2 — doar litere, cifre, _ și -, ca la servire.
    if (!DIR_RE.test(carId)) return c.json({ ok: false, error: 'Identificator de dosar invalid.' }, 400);

    // Citim corpul ca bytes.
    let bytes;
    try {
        const buf = await c.req.arrayBuffer();
        bytes = new Uint8Array(buf);
    } catch {
        return c.json({ ok: false, error: 'Fișier lipsă sau corupt.' }, 400);
    }

    if (bytes.length === 0) return c.json({ ok: false, error: 'Fișier gol.' }, 400);
    if (bytes.length > MAX_BYTES)
        return c.json({ ok: false, error: `Fișierul depășește ${Math.round(MAX_BYTES / 1024 / 1024)}MB.` }, 400);

    // Verificăm că e chiar imagine (magic bytes), nu doar content-type declarat.
    const sniffed = sniffImage(bytes);
    if (!sniffed) return c.json({ ok: false, error: 'Fișierul nu este o imagine validă (JPEG/PNG/WEBP).' }, 400);

    const ext = sniffed;   // ne bazăm pe conținut, nu pe ce zice clientul
    const id = mediaId();
    const key = carKey(carId, id, ext);
    const storeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

    const okPut = await putObject(env, key, bytes, storeType);
    if (!okPut) return c.json({ ok: false, error: 'Eroare la stocarea imaginii.' }, 502);

    // Înregistrăm în ledger, ca sweep-ul (Strat 3) să știe de acest fișier
    // dacă nu ajunge niciodată atașat unei mașini salvate. Un eșec aici NU
    // trebuie să strice uploadul — poza tot există corect în B2 — deci doar
    // logăm; în cel mai rău caz, acest fișier nu va fi urmărit de sweep dacă
    // rămâne orfan (dar oricum nu era orfan înainte să existe ledger-ul).
    try {
        await env.DB.prepare(
            'INSERT INTO media_uploads (id, car_id, ext) VALUES (?, ?, ?)'
        ).bind(id, carId, ext).run();
    } catch (err) {
        console.warn('[media] ledger insert:', err.message);
    }

    const w = parseInt(c.req.query('w'), 10) || null;
    const h = parseInt(c.req.query('h'), 10) || null;

    return c.json({
        ok: true,
        media: {
            id,
            ext,
            w,
            h,
            car_id: carId,   // panoul îl folosește să știe unde s-a pus
        },
    });
});

//  DELETE /api/admin/media/:carId/:file
//  Ștergere imediată a UNEI singure poze (Strat 1) — apelată din PhotoUploader
//  când userul apasă „✕", înainte chiar să salveze formularul. Fără asta,
//  orice poză scoasă din formular înainte de Salvează rămânea orfană în B2
//  pentru totdeauna (doar dispărea din lista trimisă la server).
adminMedia.delete('/:carId/:file', async (c) => {
    const env = c.env;
    const { carId, file } = c.req.param();

    if (!FILE_RE.test(file) || !DIR_RE.test(carId)) {
        return c.json({ ok: false, error: 'Identificator invalid.' }, 400);
    }

    // Plasă de siguranță: o poză care face parte dintr-un anunț salvat NU se
    // șterge de aici. Pozele scoase la editare se șterg abia când anunțul e
    // salvat (PUT), altfel „✕" + Anulează lăsa anunțul live cu poza moartă.
    const mediaIdPart = file.slice(0, file.lastIndexOf('.'));
    try {
        if (await isMediaAttached(env.DB, mediaIdPart)) {
            return c.json({ ok: false, attached: true, error: 'Poza face parte dintr-un anunț salvat; se șterge la salvarea anunțului.' }, 409);
        }
    } catch (err) {
        console.warn('[media] attached check:', err.message);
        return c.json({ ok: false, error: 'Nu am putut verifica poza. Încearcă din nou.' }, 502);
    }

    const key = `cars/${carId}/${file}`;
    const okDel = await deleteObject(env, key);
    if (!okDel) return c.json({ ok: false, error: 'Eroare la ștergerea imaginii.' }, 502);

    // curățăm și rândul din ledger — best-effort, nu blocăm răspunsul dacă eșuează
    c.executionCtx?.waitUntil?.(
        env.DB.prepare('DELETE FROM media_uploads WHERE id = ?').bind(mediaIdPart).run()
            .catch((err) => console.warn('[media] ledger delete:', err.message))
    );

    return c.json({ ok: true });
});

// ── SERVIRE (public) ─────────────────────────────────────────────────────────
//  GET /media/cars/:carId/:file
//  Citim din B2 și întoarcem. Răspunsurile 200 se pun în cache-ul Cloudflare
//  de la edge (Cache API), deci a doua cerere pentru aceeași poză nu mai ajunge
//  la B2. Pe *.workers.dev cache-ul nu există — merge, doar fără cache.
//
//  Doar un 404 real de la B2 înseamnă „poza lipsește". Orice altă eroare (B2
//  căzut, cheie expirată) întoarce 502, ca să nu pară un anunț stricat — și
//  niciuna dintre erori nu se pune în cache.
const media = new Hono();

const noStore = (status, text) => new Response(text, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
});

media.get('/cars/:carId/:file', async (c) => {
    const env = c.env;
    const { carId, file } = c.req.param();

    // Validare strictă a numelui — doar id.ext, fără căi.
    if (!FILE_RE.test(file) || !DIR_RE.test(carId)) return noStore(404, 'Not found');

    const cache = typeof caches !== 'undefined' ? caches.default : null;
    const keyUrl = new URL(c.req.url);
    keyUrl.search = '';
    const cacheKey = new Request(keyUrl.toString(), { method: 'GET' });

    if (cache) {
        try {
            const hit = await cache.match(cacheKey);
            if (hit) return hit;
        } catch { /* cache indisponibil — mergem la B2 */ }
    }

    const key = `cars/${carId}/${file}`;
    const base = String(env.B2_ENDPOINT || '').replace(/\/+$/, '');
    const url = `${base}/${env.B2_BUCKET_NAME}/${key}`;

    let res;
    try {
        // Bucketul e public — putem citi direct, fără semnătură. Dar semnăm
        // oricum, ca să meargă și dacă bucketul devine privat.
        const client = makeClient(env);
        const signed = await client.sign(url, { method: 'GET' });
        res = await fetch(signed);
    } catch (err) {
        console.error('[media] serve:', err.message);
        return noStore(502, 'Storage unavailable');
    }

    if (res.status === 404) return noStore(404, 'Not found');
    if (!res.ok) {
        console.error(`[media] serve ${key} → B2 ${res.status}`);
        return noStore(502, 'Storage error');
    }

    const type = file.endsWith('.png') ? 'image/png'
        : file.endsWith('.webp') ? 'image/webp' : 'image/jpeg';

    const out = new Response(res.body, {
        status: 200,
        headers: {
            'content-type': type,
            'cache-control': 'public, max-age=31536000, immutable',
        },
    });
    if (cache) {
        c.executionCtx?.waitUntil?.(cache.put(cacheKey, out.clone()).catch(() => {}));
    }
    return out;
});

export { adminMedia, media };
