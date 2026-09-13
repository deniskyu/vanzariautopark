// ============================================================================
//  src/lib/sweep.js — curățarea pozelor orfane din B2
// ----------------------------------------------------------------------------
//  O poză devine "candidat de orfan" dacă a fost urcată (există în tabelul
//  media_uploads) de mai mult de STALE_HOURS ȘI id-ul ei nu apare în coloana
//  `media` a NICIUNEI mașini din `cars`.
//
//  De ce verificăm pe id-ul unic al pozei, nu pe folder (car_id): la editare,
//  draftId = id-ul mașinii reale, deci o poză nouă adăugată la editare stă în
//  ACELAȘI folder cu pozele deja atașate ale mașinii. Un test „are folderul
//  ăsta vreo poză atașată undeva?" ar ieși mereu adevărat pentru un asemenea
//  folder — și o poză nouă abandonată (adăugată, apoi tab închis fără
//  Salvează) nu ar fi prinsă niciodată. Verificând id-ul exact al fiecărei
//  poze, distincția se face corect indiferent dacă e mașină nouă sau editare.
//
//  Rulează din src/index.js, la fiecare execuție a Cron Trigger-ului definit
//  în wrangler.jsonc (vezi „triggers.crons").
// ============================================================================

import { deleteObject } from './storage.js';

const STALE_HOURS = 24;

export async function sweepOrphanedMedia(env) {
    const db = env.DB;

    const { results: candidates } = await db.prepare(
        `SELECT id, car_id, ext FROM media_uploads
         WHERE uploaded_at < datetime('now', '-${STALE_HOURS} hours')`
    ).all();

    if (!candidates || !candidates.length) {
        console.log('[sweep] nimic de verificat');
        return { checked: 0, deleted: 0, attached: 0 };
    }

    let deleted = 0, attached = 0;

    for (const r of candidates) {
        // id-ul e mereu hex (vezi mediaId() din storage.js) — sigur pentru
        // LIKE, fără caractere speciale (%, _) de escapat.
        const row = await db.prepare(
            `SELECT 1 FROM cars WHERE media LIKE ? LIMIT 1`
        ).bind(`%"id":"${r.id}"%`).first();

        if (row) {
            attached++;
        } else {
            const key = `cars/${r.car_id}/${r.id}.${r.ext}`;
            if (await deleteObject(env, key)) deleted++;
        }

        // rândul și-a făcut treaba în ambele cazuri — îl scoatem din ledger,
        // altfel tabelul crește la nesfârșit
        await db.prepare('DELETE FROM media_uploads WHERE id = ?').bind(r.id).run();
    }

    console.log(`[sweep] verificate ${candidates.length}, atașate ${attached}, șterse ${deleted}`);
    return { checked: candidates.length, deleted, attached };
}

export default { sweepOrphanedMedia };
