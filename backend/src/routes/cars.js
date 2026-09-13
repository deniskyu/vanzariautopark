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
// ============================================================================

import { Hono } from 'hono';
import { requireAuth } from '../auth.js';
import { validateCar, generateCarSlug, normalizePhone } from '../lib/carUtils.js';
import { deleteCarMedia } from '../lib/storage.js';
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
adminCars.get('/:id', async (c) => {
    const db = c.env.DB;
    try {
        const row = await db.prepare(`SELECT ${CAR_COLUMNS}, sold_at, position FROM cars WHERE id = ?`)
            .bind(c.req.param('id')).first();
        if (!row) return c.json({ ok: false, error: 'Anunț inexistent.' }, 404);
        return c.json({ ok: true, car: hydrate(row) });
    } catch (err) {
        return c.json({ ok: false, error: 'Eroare server.' }, 500);
    }
});

// ── Adăugare ─────────────────────────────────────────────────────────────────
//  Media vine ca array deja procesat (Batch 3 se ocupă de upload înainte).
//  Aici doar validăm câmpurile și scriem rândul.
adminCars.post('/', async (c) => {
    const db = c.env.DB;
    let body;
    try { body = await c.req.json(); }
    catch { return c.json({ ok: false, error: 'Corp invalid.' }, 400); }

    const v = validateCar(body);
    if (!v.ok) return c.json({ ok: false, errors: v.errors }, 400);

    // Telefon gol → numărul principal al parcului (din settings).
    let phone = v.data.phone;
    if (!phone) {
        const s = await db.prepare('SELECT phone_primary FROM settings WHERE id = 1').first();
        phone = normalizePhone(s?.phone_primary) || '';
    }

    // Media: acceptăm doar un array; forma detaliată se validează în Batch 3.
    let media = [];
    if (Array.isArray(body.media)) media = body.media.slice(0, LIMITS.max_photos);

    const id = nanoid();
    const slug = generateCarSlug(v.data.title, v.data.brand, v.data.production_year);
    const status = body.status === 'draft' ? 'draft' : 'published';

    try {
        await db.prepare(`
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
        ).run();

        return c.json({ ok: true, id, slug });
    } catch (err) {
        console.error('[adminCars] create:', err.message);
        return c.json({ ok: false, error: 'Eroare la salvare.' }, 500);
    }
});

// ── Editare ──────────────────────────────────────────────────────────────────
//  Marca, anul NU se schimbă (slug-ul e derivat din ele și e deja indexat).
//  Restul câmpurilor, da.
adminCars.put('/:id', async (c) => {
    const db = c.env.DB;
    const id = c.req.param('id');

    // Citim și `media` (nu doar `id`), ca să putem face diff mai jos.
    const existing = await db.prepare('SELECT id, media FROM cars WHERE id = ?').bind(id).first();
    if (!existing) return c.json({ ok: false, error: 'Anunț inexistent.' }, 404);

    let body;
    try { body = await c.req.json(); }
    catch { return c.json({ ok: false, error: 'Corp invalid.' }, 400); }

    const v = validateCar(body);
    if (!v.ok) return c.json({ ok: false, errors: v.errors }, 400);

    let phone = v.data.phone;
    if (!phone) {
        const s = await db.prepare('SELECT phone_primary FROM settings WHERE id = 1').first();
        phone = normalizePhone(s?.phone_primary) || '';
    }

    let media = [];
    if (Array.isArray(body.media)) media = body.media.slice(0, LIMITS.max_photos);

    // ── Diff media (Strat 2 anti-orfani) ──────────────────────────────────
    //  Orice poză care era în `media` veche dar nu mai apare în lista nouă
    //  a fost scoasă din formular — trebuie ștearsă și din B2, nu doar din
    //  rândul din DB. Fără asta, pozele înlocuite la editare rămân orfane.
    let oldMedia = [];
    try { oldMedia = JSON.parse(existing.media || '[]'); } catch {}
    const newIds = new Set(media.map((m) => m && m.id).filter(Boolean));
    const removed = oldMedia.filter((m) => m && m.id && !newIds.has(m.id));

    // status: se poate schimba în draft/published/sold din editare
    let statusSql = '', statusBinds = [];
    if (['draft', 'published', 'sold'].includes(body.status)) {
        statusSql = ', status = ?';
        statusBinds.push(body.status);
        if (body.status === 'sold') statusSql += ", sold_at = datetime('now')";
    }

    try {
        await db.prepare(`
            UPDATE cars SET
                title=?, price=?, negotiable=?, mileage=?, fuel=?, engine_capacity=?,
                horsepower=?, pollution_standard=?, body_type=?, color=?, transmission=?,
                drivetrain=?, steering_wheel=?, vin=?, registration_status=?,
                for_dismantling=?, description=?, phone=?, media=?,
                updated_at=datetime('now') ${statusSql}
            WHERE id=?
        `).bind(
            v.data.title, v.data.price, v.data.negotiable, v.data.mileage, v.data.fuel,
            v.data.engine_capacity, v.data.horsepower, v.data.pollution_standard,
            v.data.body_type, v.data.color, v.data.transmission, v.data.drivetrain,
            v.data.steering_wheel, v.data.vin, v.data.registration_status,
            v.data.for_dismantling, v.data.description, phone, JSON.stringify(media),
            ...statusBinds, id
        ).run();

        // Ștergem din B2 pozele scoase — în fundal, nu blocăm răspunsul, și nu
        // eșuăm salvarea mașinii dacă ștergerea din B2 dă vreo eroare.
        if (removed.length) {
            c.executionCtx?.waitUntil?.(deleteCarMedia(c.env, id, removed));
            c.executionCtx?.waitUntil?.(
                db.prepare(
                    `DELETE FROM media_uploads WHERE id IN (${removed.map(() => '?').join(',')})`
                ).bind(...removed.map((m) => m.id)).run().catch(() => {})
            );
        }

        return c.json({ ok: true, id });
    } catch (err) {
        console.error('[adminCars] update:', err.message);
        return c.json({ ok: false, error: 'Eroare la salvare.' }, 500);
    }
});

// ── Marcare rapidă ca vândut / disponibil ────────────────────────────────────
adminCars.patch('/:id/status', async (c) => {
    const db = c.env.DB;
    const id = c.req.param('id');
    let body;
    try { body = await c.req.json(); } catch { body = {}; }

    if (!['draft', 'published', 'sold'].includes(body.status))
        return c.json({ ok: false, error: 'Stare invalidă.' }, 400);

    const soldSql = body.status === 'sold' ? ", sold_at = datetime('now')" : '';
    try {
        const r = await db.prepare(
            `UPDATE cars SET status = ?${soldSql}, updated_at = datetime('now') WHERE id = ?`
        ).bind(body.status, id).run();
        if (!r.meta.changes) return c.json({ ok: false, error: 'Anunț inexistent.' }, 404);
        return c.json({ ok: true });
    } catch (err) {
        return c.json({ ok: false, error: 'Eroare server.' }, 500);
    }
});

// ── Ștergere ─────────────────────────────────────────────────────────────────
//  Rândul din D1 + fotografiile din B2 (Strat 4 anti-orfani — deja exista).
adminCars.delete('/:id', async (c) => {
    const db = c.env.DB;
    const id = c.req.param('id');
    try {
        // Întâi citim media, ca să putem șterge fișierele.
        const row = await db.prepare('SELECT media FROM cars WHERE id = ?').bind(id).first();
        if (!row) return c.json({ ok: false, error: 'Anunț inexistent.' }, 404);

        await db.prepare('DELETE FROM cars WHERE id = ?').bind(id).run();

        // Ștergem și fotografiile din B2. Best-effort, în fundal — nu blocăm
        // răspunsul și nu eșuăm ștergerea anunțului dacă B2 dă o eroare.
        let mediaList = [];
        try { mediaList = JSON.parse(row.media || '[]'); } catch {}
        c.executionCtx?.waitUntil?.(deleteCarMedia(c.env, id, mediaList));

        return c.json({ ok: true });
    } catch (err) {
        console.error('[adminCars] delete:', err.message);
        return c.json({ ok: false, error: 'Eroare la ștergere.' }, 500);
    }
});

export { cars, adminCars };
