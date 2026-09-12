// ============================================================================
//  src/routes/media.js — upload, servire și ștergere de fotografii
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
// ============================================================================

import { Hono } from 'hono';
import { requireAuth } from '../auth.js';
import {
    makeClient, mediaId, extFromType, sniffImage, putObject, carKey,
} from '../lib/storage.js';
import { LIMITS } from '../data/carOptions.js';

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

// ── SERVIRE (public) ─────────────────────────────────────────────────────────
//  GET /media/cars/:carId/:file
//  Citim din B2 și întoarcem. Cache lung; Cloudflare cache-uiește la edge.
const media = new Hono();

media.get('/cars/:carId/:file', async (c) => {
    const env = c.env;
    const { carId, file } = c.req.param();

    // Validare strictă a numelui — doar id.ext, fără căi.
    if (!/^[a-f0-9]{24}\.(jpg|png|webp)$/.test(file) || !/^[a-zA-Z0-9]+$/.test(carId)) {
        return c.notFound();
    }

    const key = `cars/${carId}/${file}`;
    const base = String(env.B2_ENDPOINT || '').replace(/\/+$/, '');
    const url = `${base}/${env.B2_BUCKET_NAME}/${key}`;

    try {
        // Bucketul e public — putem citi direct, fără semnătură. Dar semnăm
        // oricum, ca să meargă și dacă bucketul devine privat.
        const client = makeClient(env);
        const signed = await client.sign(url, { method: 'GET' });
        const res = await fetch(signed);

        if (!res.ok) return c.notFound();

        const type = file.endsWith('.png') ? 'image/png'
            : file.endsWith('.webp') ? 'image/webp' : 'image/jpeg';

        return new Response(res.body, {
            status: 200,
            headers: {
                'content-type': type,
                'cache-control': 'public, max-age=31536000, immutable',
            },
        });
    } catch (err) {
        console.error('[media] serve:', err.message);
        return c.notFound();
    }
});

export { adminMedia, media };
