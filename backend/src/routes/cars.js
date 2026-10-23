// ============================================================================
//  src/routes/cars.js — rutele pentru mașini
// ----------------------------------------------------------------------------
//  Două grupuri:
//    PUBLICE  (/api/cars/*)        — citire, pentru site
//    ADMIN    (/api/admin/cars/*)  — scriere, protejate de requireAuth
//
//  Media NU se atinge aici, cu O EXCEPȚIE: la editare (PUT), facem diff între
//  media veche (din DB) și media nouă (trimisă din formular) și ștergem din B2
//  orice poză scoasă — altfel rămânea orfană (Strat 2 din strategia anti-orfani,
//  vezi și media.js pentru Stratul 1 și src/lib/sweep.js pentru Stratul 3).
//
//  La POST și PUT, lista `media` trece prin resolveMedia (lib/mediaCheck.js):
//  refuzăm salvarea dacă vreo poză nouă nu mai există în B2, iar pozele
//  acceptate sunt scoase din ledger în aceeași tranzacție cu salvarea — de
//  acolo încolo sweep-ul nu mai are ce căuta la ele.
// ============================================================================

import { Hono } from 'hono';
import { requireAuth } from '../auth.js';
import { validateCar, generateCarSlug, normalizePhone } from '../lib/carUtils.js';
import {
    resolveMedia, missingMediaResponse, ledgerDetachStmt, releaseCarMedia,
} from '../lib/mediaCheck.js';
import {
    BRANDS, FUEL_TYPES, POLLUTION_STANDARDS, ENGINE_CAPACITIES, LIMITS,
} from '../data/carOptions.js';

const nanoid = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
};

const PAGE_SIZE = 20;

// Coloanele întoarse către site — fără nimic intern în plus.
const CAR_COLUMNS = `
    id, slug, title, brand, production_year, price, negotiable, mileage,
    fuel, engine_capacity, horsepower, pollution_standard, body_type, color,
    transmission, drivetrain, steering_wheel, vin, registration_status,
    for_dismantling, description, phone, media, status, featured, views,
    created_at
`;

// Parsează `media` (JSON) în obiect. Defensiv — un JSON stricat nu strică pagina.
const hydrate = (row) => {
    if (!row) return row;
    try { row.media = JSON.parse(row.media || '[]'); }
    catch { row.media = []; }
    row.negotiable = !!row.negotiable;
    row.featured = !!row.featured;
    row.for_dismantling = !!row.for_dismantling;
    return row;
};

const cars = new Hono();

// ════════════════════════════════════════════════════════════════════════════
//  PUBLIC — LISTA CU FILTRE ȘI PAGINARE
// ────────────────────────────────────────────────────────────────────────────
//  GET /api/cars?brand=BMW&an_min=2015&pret_max=20000&page=2&sort=pret_asc
//
//  Doar mașinile `published`. Filtrele se construiesc dinamic, dar fiecare
//  valoare trece prin bind (?), niciodată concatenată — fără injecție SQL.
// ════════════════════════════════════════════════════════════════════════════
cars.get('/', async (c) => {
    const db = c.env.DB;
    const q = c.req.query();

    const where = ["status = 'published'"];
    const binds = [];

    if (q.brand && BRANDS.includes(q.brand)) { where.push('brand = ?'); binds.push(q.brand); }
    if (q.fuel && FUEL_TYPES.includes(q.fuel)) { where.push('fuel = ?'); binds.push(q.fuel); }
    if (q.pollution && POLLUTION_STANDARDS.includes(q.pollution)) { where.push('pollution_standard = ?'); binds.push(q.pollution); }
    if (q.capacity && ENGINE_CAPACITIES.includes(q.capacity)) { where.push('engine_capacity = ?'); binds.push(q.capacity); }

    const range = (field, lo, hi) => {
        const a = parseInt(lo, 10), b = parseInt(hi, 10);
        if (Number.isFinite(a)) { where.push(`${field} >= ?`); binds.push(a); }
        if (Number.isFinite(b)) { where.push(`${field} <= ?`); binds.push(b); }
    };
    range('price', q.pret_min, q.pret_max);
    range('production_year', q.an_min, q.an_max);
    range('mileage', q.km_min, q.km_max);

    const SORTS = {
        nou:       'featured DESC, created_at DESC',
        pret_asc:  'price ASC',
        pret_desc: 'price DESC',
        an_desc:   'production_year DESC',
        km_asc:    'mileage ASC',
    };
    const order = SORTS[q.sort] || SORTS.nou;

    const page = Math.max(1, parseInt(q.page, 10) || 1);
    const offset = (page - 1) * PAGE_SIZE;
    const whereSql = where.join(' AND ');

    try {
        const countRow = await db.prepare(`SELECT COUNT(*) AS n FROM cars WHERE ${whereSql}`)
            .bind(...binds).first();
        const total = countRow?.n || 0;

        const { results } = await db.prepare(
            `SELECT ${CAR_COLUMNS} FROM cars WHERE ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`
        ).bind(...binds, PAGE_SIZE, offset).all();

        return c.json({
            ok: true,
            cars: (results || []).map(hydrate),
            total,
            page,
            pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
            page_size: PAGE_SIZE,
        });
    } catch (err) {
        console.error('[cars] list:', err.message);
        return c.json({ ok: false, error: 'Eroare la încărcarea mașinilor.' }, 500);
    }
});

// ── PUBLIC — cele mai recente câteva (pentru pagina de acasă) ─────────────────
cars.get('/latest', async (c) => {
    const db = c.env.DB;
    const limit = Math.min(12, Math.max(1, parseInt(c.req.query('limit'), 10) || 6));
    try {
        const { results } = await db.prepare(
            `SELECT ${CAR_COLUMNS} FROM cars WHERE status = 'published'
             ORDER BY featured DESC, created_at DESC LIMIT ?`
        ).bind(limit).all();
        return c.json({ ok: true, cars: (results || []).map(hydrate) });
    } catch (err) {
        console.error('[cars] latest:', err.message);
        return c.json({ ok: false, error: 'Eroare server.' }, 500);
    }
});

// ── PUBLIC — o mașină după slug ──────────────────────────────────────────────
cars.get('/:slug', async (c) => {
    const db = c.env.DB;
    const slug = c.req.param('slug');
    try {
        const row = await db.prepare(
            `SELECT ${CAR_COLUMNS} FROM cars WHERE slug = ? AND status = 'published'`
        ).bind(slug).first();

        if (!row) return c.json({ ok: false, error: 'Anunț inexistent.' }, 404);

        // Incrementăm vizualizările, best-effort — nu blocăm răspunsul.
        c.executionCtx?.waitUntil?.(
            db.prepare('UPDATE cars SET views = views + 1 WHERE id = ?').bind(row.id).run()
        );

        return c.json({ ok: true, car: hydrate(row) });
    } catch (err) {
        console.error('[cars] one:', err.message);
        return c.json({ ok: false, error: 'Eroare server.' }, 500);
    }
});

// ════════════════════════════════════════════════════════════════════════════
//  ADMIN — protejate. Se montează sub /api/admin/cars în index.js, cu requireAuth.
// ════════════════════════════════════════════════════════════════════════════
const adminCars = new Hono();
adminCars.use('*', requireAuth);

// ── Lista completă pentru admin (include draft și sold) ──────────────────────
adminCars.get('/', async (c) => {
    const db = c.env.DB;
    const q = c.req.query();
    const page = Math.max(1, parseInt(q.page, 10) || 1);
    const offset = (page - 1) * PAGE_SIZE;

    const where = [];
    const binds = [];
    if (q.status && ['draft', 'published', 'sold'].includes(q.status)) {
        where.push('status = ?'); binds.push(q.status);
    }
    if (q.search) {
        where.push('(title LIKE ? OR brand LIKE ?)');
        const like = `%${q.search}%`;
        binds.push(like, like);
    }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

    try {
        const countRow = await db.prepare(`SELECT COUNT(*) AS n FROM cars ${whereSql}`)
            .bind(...binds).first();
        const { results } = await db.prepare(
            `SELECT ${CAR_COLUMNS}, updated_at, sold_at FROM cars ${whereSql}
             ORDER BY created_at DESC LIMIT ? OFFSET ?`
        ).bind(...binds, PAGE_SIZE, offset).all();

        return c.json({
            ok: true,
            cars: (results || []).map(hydrate),
            total: countRow?.n || 0,
            page,
            pages: Math.max(1, Math.ceil((countRow?.n || 0) / PAGE_SIZE)),
        });
    } catch (err) {
        console.error('[adminCars] list:', err.message);
        return c.json({ ok: false, error: 'Eroare server.' }, 500);
    }
});

// ── Citire pentru editare (orice status) ─────────────────────────────────────
//  `updated_at` merge înapoi la PUT: așa prindem două taburi pe aceeași mașină.
adminCars.get('/:id', async (c) => {
    const db = c.env.DB;
    try {
        const row = await db.prepare(`SELECT ${CAR_COLUMNS}, sold_at, position, updated_at FROM cars WHERE id = ?`)
            .bind(c.req.param('id')).first();
        if (!row) return c.json({ ok: false, error: 'Anunț inexistent.' }, 404);
        return c.json({ ok: true, car: hydrate(row) });
    } catch (err) {
        return c.json({ ok: false, error: 'Eroare server.' }, 500);
    }
});

// Marcaj de timp cu milisecunde — două salvări în aceeași secundă rămân diferite.
const NOW_MS = "strftime('%Y-%m-%d %H:%M:%f','now')";

// ── Verificarea pozelor, comună pentru POST și PUT ──────────────────────────
//  Întoarce { media, attachIds } sau { response } dacă salvarea trebuie oprită.
const checkMedia = async (c, rawMedia, oldMedia = []) => {
    const list = Array.isArray(rawMedia) ? rawMedia : [];
    if (list.length > LIMITS.max_photos) {
        return { response: c.json({ ok: false, errors: [`Maxim ${LIMITS.max_photos} de poze pe anunț.`] }, 400) };
    }
    let r;
    try {
        r = await resolveMedia(c.env, list, oldMedia);
    } catch (err) {
        console.error('[adminCars] media check:', err.message);
        return { response: c.json({ ok: false, error: 'Nu am putut verifica pozele. Încearcă din nou.' }, 502) };
    }
    if (r.invalid) return { response: c.json({ ok: false, errors: ['Listă de poze invalidă.'] }, 400) };
    if (r.missing.length) {
        console.warn(`[adminCars] ${r.missing.length} poze lipsă din B2: ${r.missing.join(', ')}`);
        return { response: c.json(missingMediaResponse(r.missing), 409) };
    }
    return { media: r.media, attachIds: r.attachIds };
};

// ── Telefonul anunțului ──────────────────────────────────────────────────────
//  Gol sau identic cu numărul principal al parcului → salvăm '' și pagina
//  afișează numărul curent din Setări. Înainte se copia numărul în anunț, iar
//  după o schimbare în Setări anunțurile vechi rămâneau cu numărul vechi.
const resolvePhone = async (db, phone) => {
    if (!phone) return '';
    try {
        const s = await db.prepare('SELECT phone_primary FROM settings WHERE id = 1').first();
        if (normalizePhone(s?.phone_primary) === phone) return '';
    } catch { /* fără setări — păstrăm numărul dat */ }
    return phone;
};

const conflictResponse = (c) => c.json({
    ok: false,
    conflict: true,
    error: 'Anunțul a fost modificat între timp (în alt tab sau de pe alt dispozitiv). ' +
        'Reîncarcă pagina ca să vezi ultima versiune, apoi refă modificarea.',
}, 409);

// ── Adăugare ─────────────────────────────────────────────────────────────────
//  Media vine ca array de poze deja urcate (vezi media.js). Validăm câmpurile,
//  verificăm că pozele încă există, apoi scriem rândul.
adminCars.post('/', async (c) => {
    const db = c.env.DB;
    let body;
    try { body = await c.req.json(); }
    catch { return c.json({ ok: false, error: 'Corp invalid.' }, 400); }

    const v = validateCar(body);
    if (!v.ok) return c.json({ ok: false, errors: v.errors }, 400);

    // ── Anunț deja salvat? (dublu-click, sau retry după ce răspunsul s-a pierdut)
    //  Pozele au id-uri unice: dacă o mașină le folosește deja, e aceeași
    //  salvare repetată — întoarcem mașina existentă, nu facem una nouă (o
    //  dublură împărțea fișierele, iar ștergerea ei strica originalul).
    const rawList = Array.isArray(body.media) ? body.media : [];
    const rawIds = rawList
        .map((m) => m && m.id).filter((x) => typeof x === 'string' && /^[a-f0-9]{24}$/.test(x));
    try {
        let dup = null;
        if (rawIds.length) {
            dup = await db.prepare('SELECT id, slug FROM cars WHERE media LIKE ? LIMIT 1')
                .bind(`%"id":"${rawIds[0]}"%`).first();
        } else if (rawList.length === 0) {
            // fără poze: aceeași mașină, tot fără poze, trimisă de două ori în
            // ultimele 2 minute
            dup = await db.prepare(
                `SELECT id, slug FROM cars WHERE title = ? AND brand = ? AND price = ? AND mileage = ?
                   AND media = '[]' AND created_at > datetime('now', '-2 minutes') LIMIT 1`
            ).bind(v.data.title, v.data.brand, v.data.price, v.data.mileage).first();
        }
        if (dup) return c.json({ ok: true, id: dup.id, slug: dup.slug, already: true });
    } catch (err) {
        console.warn('[adminCars] dedupe:', err.message);
    }

    const phone = await resolvePhone(db, v.data.phone);

    // Media: doar poze care chiar există în B2 (vezi lib/mediaCheck.js).
    const mc = await checkMedia(c, body.media);
    if (mc.response) return mc.response;
    const { media, attachIds } = mc;

    const id = nanoid();
    const slug = generateCarSlug(v.data.title, v.data.brand, v.data.production_year);
    const status = body.status === 'draft' ? 'draft' : 'published';

    try {
        const insert = db.prepare(`
            INSERT INTO cars (
                id, slug, title, brand, production_year, price, negotiable, mileage,
                fuel, engine_capacity, horsepower, pollution_standard, body_type, color,
                transmission, drivetrain, steering_wheel, vin, registration_status,
                for_dismantling, description, phone, media, status
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).bind(
            id, slug, v.data.title, v.data.brand, v.data.production_year, v.data.price,
            v.data.negotiable, v.data.mileage, v.data.fuel, v.data.engine_capacity,
            v.data.horsepower, v.data.pollution_standard, v.data.body_type, v.data.color,
            v.data.transmission, v.data.drivetrain, v.data.steering_wheel, v.data.vin,
            v.data.registration_status, v.data.for_dismantling, v.data.description,
            phone, JSON.stringify(media), status
        );

        // Inserarea + scoaterea pozelor din ledger, atomic (o singură tranzacție).
        const detach = ledgerDetachStmt(db, attachIds);
        await db.batch(detach ? [insert, detach] : [insert]);

        return c.json({ ok: true, id, slug });
    } catch (err) {
        console.error('[adminCars] create:', err.message);
        return c.json({ ok: false, error: 'Eroare la salvare.' }, 500);
    }
});

// ── Editare ──────────────────────────────────────────────────────────────────
//  Se poate schimba orice câmp, inclusiv marca și anul. Slug-ul (URL-ul) rămâne
//  același, ca linkurile deja trimise să meargă în continuare.
adminCars.put('/:id', async (c) => {
    const db = c.env.DB;
    const id = c.req.param('id');

    const existing = await db.prepare('SELECT id, media, status, updated_at FROM cars WHERE id = ?').bind(id).first();
    if (!existing) return c.json({ ok: false, error: 'Anunț inexistent.' }, 404);

    let body;
    try { body = await c.req.json(); }
    catch { return c.json({ ok: false, error: 'Corp invalid.' }, 400); }

    // Formularul trimite versiunea pe care a încărcat-o. Dacă între timp mașina
    // s-a salvat din alt tab/dispozitiv, nu suprascriem — altfel modificările
    // de acolo se pierdeau și pozele adăugate acolo erau șterse din B2.
    if (typeof body.updated_at === 'string' && body.updated_at && body.updated_at !== existing.updated_at) {
        return conflictResponse(c);
    }

    const v = validateCar(body);
    if (!v.ok) return c.json({ ok: false, errors: v.errors }, 400);

    const phone = await resolvePhone(db, v.data.phone);

    let oldMedia = [];
    try { oldMedia = JSON.parse(existing.media || '[]'); } catch {}

    // Pozele deja pe mașină trec direct; cele noi trebuie să existe în B2.
    const mc = await checkMedia(c, body.media, oldMedia);
    if (mc.response) return mc.response;
    const { media, attachIds } = mc;

    // ── Diff media (Strat 2 anti-orfani) ──────────────────────────────────
    //  Orice poză care era în `media` veche dar nu mai apare în lista nouă
    //  a fost scoasă din formular — se șterge din B2 DOAR după ce salvarea a
    //  reușit (formularul nu mai șterge nimic singur, vezi PhotoUploader).
    const newIds = new Set(media.map((m) => m && m.id).filter(Boolean));
    const removed = oldMedia.filter((m) => m && m.id && !newIds.has(m.id));

    // status + sold_at: data vânzării se pune doar la trecerea în „vândut”,
    // nu la fiecare salvare a unei mașini deja vândute.
    const status = ['draft', 'published', 'sold'].includes(body.status) ? body.status : existing.status;

    try {
        const r = await db.prepare(`
            UPDATE cars SET
                title=?, brand=?, production_year=?, price=?, negotiable=?, mileage=?,
                fuel=?, engine_capacity=?, horsepower=?, pollution_standard=?, body_type=?,
                color=?, transmission=?, drivetrain=?, steering_wheel=?, vin=?,
                registration_status=?, for_dismantling=?, description=?, phone=?, media=?,
                status=?,
                sold_at = CASE WHEN ? = 'sold'
                               THEN (CASE WHEN status = 'sold' THEN sold_at ELSE datetime('now') END)
                               ELSE NULL END,
                updated_at=${NOW_MS}
            WHERE id=? AND updated_at=?
        `).bind(
            v.data.title, v.data.brand, v.data.production_year, v.data.price, v.data.negotiable,
            v.data.mileage, v.data.fuel, v.data.engine_capacity, v.data.horsepower,
            v.data.pollution_standard, v.data.body_type, v.data.color, v.data.transmission,
            v.data.drivetrain, v.data.steering_wheel, v.data.vin, v.data.registration_status,
            v.data.for_dismantling, v.data.description, phone, JSON.stringify(media),
            status, status,
            id, existing.updated_at
        ).run();

        // 0 rânduri = altă salvare a ajuns între citire și scriere.
        if (!r.meta?.changes) return conflictResponse(c);

        // Pozele noi sunt acum atașate — le scoatem din ledger.
        const detach = ledgerDetachStmt(db, attachIds);
        if (detach) await detach.run().catch((err) => console.warn('[adminCars] ledger detach:', err.message));

        // Ștergem din B2 pozele scoase — în fundal, fără să blocăm răspunsul.
        if (removed.length) c.executionCtx?.waitUntil?.(releaseCarMedia(c.env, id, removed));

        const fresh = await db.prepare('SELECT updated_at FROM cars WHERE id = ?').bind(id).first();
        return c.json({ ok: true, id, updated_at: fresh?.updated_at || null });
    } catch (err) {
        console.error('[adminCars] update:', err.message);
        return c.json({ ok: false, error: 'Eroare la salvare.' }, 500);
    }
});

// ── Marcare rapidă: publicat / ciornă / vândut ───────────────────────────────
adminCars.patch('/:id/status', async (c) => {
    const db = c.env.DB;
    const id = c.req.param('id');
    let body;
    try { body = await c.req.json(); } catch { body = {}; }

    if (!['draft', 'published', 'sold'].includes(body.status))
        return c.json({ ok: false, error: 'Stare invalidă.' }, 400);

    try {
        const r = await db.prepare(
            `UPDATE cars SET
                sold_at = CASE WHEN ? = 'sold'
                               THEN (CASE WHEN status = 'sold' THEN sold_at ELSE datetime('now') END)
                               ELSE NULL END,
                status = ?,
                updated_at = ${NOW_MS}
             WHERE id = ?`
        ).bind(body.status, body.status, id).run();
        if (!r.meta.changes) return c.json({ ok: false, error: 'Anunț inexistent.' }, 404);
        return c.json({ ok: true });
    } catch (err) {
        return c.json({ ok: false, error: 'Eroare server.' }, 500);
    }
});

// ── Ștergere ─────────────────────────────────────────────────────────────────
//  Rândul din D1 + fotografiile din B2 (doar cele pe care nu le mai folosește
//  altă mașină; ștergerile eșuate sunt reîncercate de sweep).
adminCars.delete('/:id', async (c) => {
    const db = c.env.DB;
    const id = c.req.param('id');
    try {
        const row = await db.prepare('SELECT media FROM cars WHERE id = ?').bind(id).first();
        if (!row) return c.json({ ok: false, error: 'Anunț inexistent.' }, 404);

        await db.prepare('DELETE FROM cars WHERE id = ?').bind(id).run();

        let mediaList = [];
        try { mediaList = JSON.parse(row.media || '[]'); } catch {}
        if (mediaList.length) c.executionCtx?.waitUntil?.(releaseCarMedia(c.env, id, mediaList));

        return c.json({ ok: true });
    } catch (err) {
        console.error('[adminCars] delete:', err.message);
        return c.json({ ok: false, error: 'Eroare la ștergere.' }, 500);
    }
});

export { cars, adminCars };
