// ============================================================================
//  src/lib/mediaCheck.js — verifică lista `media` la salvarea unei mașini
// ----------------------------------------------------------------------------
//  De ce există: formularul ține pozele urcate DOAR în memorie până la
//  „Salvează". Dacă tabul stă deschis mai mult decât fereastra sweep-ului
//  (vezi sweep.js), pozele sunt șterse din B2 ca orfane, iar salvarea de
//  după publica un anunț cu linkuri moarte. (S-a întâmplat: VW Golf 6,
//  poze urcate pe 20 oct, șterse de sweep pe 22 oct, anunț salvat după.)
//
//  Reguli:
//   - pozele care erau deja pe mașină (la editare) se acceptă așa cum sunt în
//     DB — nu cum le trimite clientul;
//   - o poză NOUĂ trebuie să fie în ledger-ul media_uploads (adică urcată și
//     încă neatinsă de sweep). Dacă nu e acolo, verificăm direct în B2
//     (HEAD) — acoperă cazul rar în care inserarea în ledger a eșuat la upload;
//   - orice altceva ajunge în `missing`, iar ruta refuză salvarea.
//
//  Datele unei poze noi (folder, extensie) se iau din ledger, nu din client.
// ============================================================================

import { headObject } from './storage.js';

const ID_RE = /^[a-f0-9]{24}$/;
const DIR_RE = /^[a-zA-Z0-9_-]+$/;
const EXTS = new Set(['jpg', 'png', 'webp']);

const dim = (v) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * @param {object} env       bindings Worker (DB + secrete B2)
 * @param {Array}  rawList   `body.media` trimis de formular
 * @param {Array}  oldList   media deja salvată pe mașină (la editare), altfel []
 * @returns {Promise<{ invalid: boolean, media: Array, attachIds: string[], missing: string[] }>}
 *   media     — lista curată, gata de JSON.stringify în coloana `media`
 *   attachIds — id-urile noi, de scos din ledger după salvare
 *   missing   — id-urile noi care nu mai există în B2
 * Aruncă dacă B2 nu răspunde clar la verificare.
 */
export async function resolveMedia(env, rawList, oldList = []) {
    const list = Array.isArray(rawList) ? rawList : [];
    const oldById = new Map(
        (Array.isArray(oldList) ? oldList : [])
            .filter((m) => m && typeof m.id === 'string')
            .map((m) => [m.id, m])
    );

    // 1. Forma fiecărei intrări + eliminarea dublurilor (păstrăm ordinea).
    const items = [];
    const seen = new Set();
    for (const m of list) {
        const id = m && typeof m.id === 'string' ? m.id : '';
        const isOld = oldById.has(id);
        if (!isOld && !ID_RE.test(id)) {
            return { invalid: true, media: [], attachIds: [], missing: [] };
        }
        if (seen.has(id)) continue;
        seen.add(id);
        items.push({ id, isOld, client: m });
    }

    // 2. Pozele noi: întâi în ledger.
    const newIds = items.filter((it) => !it.isOld).map((it) => it.id);
    const ledger = new Map();
    if (newIds.length) {
        const { results } = await env.DB.prepare(
            `SELECT id, car_id, ext FROM media_uploads WHERE id IN (${newIds.map(() => '?').join(',')})`
        ).bind(...newIds).all();
        for (const r of results || []) ledger.set(r.id, r);
    }

    // 3. Ce nu e în ledger: verificăm direct în B2.
    const verified = new Map();
    const missingSet = new Set();
    await Promise.all(items
        .filter((it) => !it.isOld && !ledger.has(it.id))
        .map(async (it) => {
            const dir = String(it.client.dir || it.client.car_id || '');
            const ext = String(it.client.ext || '');
            if (!DIR_RE.test(dir) || !EXTS.has(ext)) { missingSet.add(it.id); return; }
            if (await headObject(env, `cars/${dir}/${it.id}.${ext}`)) verified.set(it.id, { dir, ext });
            else missingSet.add(it.id);
        }));

    // 4. Lista finală, în ordinea din formular.
    const media = [];
    const attachIds = [];
    for (const it of items) {
        if (it.isOld) { media.push(oldById.get(it.id)); continue; }
        if (missingSet.has(it.id)) continue;
        const l = ledger.get(it.id);
        const src = l ? { dir: l.car_id, ext: l.ext } : verified.get(it.id);
        media.push({ id: it.id, ext: src.ext, w: dim(it.client.w), h: dim(it.client.h), dir: src.dir });
        attachIds.push(it.id);
    }

    return {
        invalid: false,
        media,
        attachIds,
        missing: items.filter((it) => missingSet.has(it.id)).map((it) => it.id),
    };
}

/** Răspunsul 409 când unele poze nu mai există. */
export const missingMediaResponse = (missing) => {
    const n = missing.length;
    const what = n === 1 ? 'O poză nu mai există' : n < 20 ? `${n} poze nu mai există` : `${n} de poze nu mai există`;
    const msg = `${what} pe server — formularul a stat probabil deschis prea mult și au fost curățate automat. ` +
        'Sunt marcate cu roșu la Fotografii: șterge-le și urcă-le din nou.';
    return { ok: false, error: msg, errors: [msg], missing_media: missing };
};

/** Statement D1 care scoate din ledger pozele tocmai atașate (sau null). */
export const ledgerDetachStmt = (db, ids) => (ids && ids.length
    ? db.prepare(`DELETE FROM media_uploads WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids)
    : null);

export default { resolveMedia, missingMediaResponse, ledgerDetachStmt };
