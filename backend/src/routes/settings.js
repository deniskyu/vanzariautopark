// ============================================================================
//  src/routes/settings.js — citirea și editarea setărilor site-ului
// ----------------------------------------------------------------------------
//  Patronul editează, din panou, doar o parte din câmpuri: textele de pe site,
//  numele afișat, cele două numere. Restul (date de firmă, adresă, coordonate)
//  rămân fixe — se schimbă doar din cod, nu sunt expuse în panou.
//
//  Regula: LISTĂ ALBĂ de câmpuri editabile. Orice altceva trimis din formular
//  e ignorat. Fiecare câmp text are o limită de caractere, validată aici.
// ============================================================================

import { Hono } from 'hono';
import { requireAuth } from '../auth.js';
import { normalizePhone, isValidPhone } from '../lib/carUtils.js';

const settings = new Hono();

// Limitele de caractere — aceleași ca în panou (feedback) și aici (autoritate).
const LIMITS = {
    display_name: 40,
    phone_primary_label: 20,
    phone_secondary_label: 20,
    hero_title: 80,
    hero_subtitle: 200,
    services_title: 60,
    about_title: 60,
    about_text: 1200,
    contact_intro: 300,
    svc_title: 40,
    svc_text: 200,
};

const clean = (v) => (v == null ? '' : String(v).trim());

// Coloanele tabelului settings (citite o dată per instanță de Worker).
let _columns = null;
const settingsColumns = async (db) => {
    if (_columns) return _columns;
    try {
        const { results } = await db.prepare('PRAGMA table_info(settings)').all();
        if (results && results.length) _columns = new Set(results.map((r) => r.name));
    } catch (err) {
        console.warn('[settings] PRAGMA:', err.message);
    }
    return _columns;   // null = nu știm; încercăm toate câmpurile
};

// ── GET: citire (pentru panou) ───────────────────────────────────────────────
settings.get('/', requireAuth, async (c) => {
    try {
        const row = await c.env.DB.prepare('SELECT * FROM settings WHERE id = 1').first();
        if (!row) return c.json({ ok: false, error: 'Setări inexistente.' }, 404);
        try { row.services = JSON.parse(row.services || '[]'); } catch { row.services = []; }
        return c.json({ ok: true, settings: row, limits: LIMITS });
    } catch (err) {
        console.error('[settings] get:', err.message);
        return c.json({ ok: false, error: 'Eroare server.' }, 500);
    }
});

// ── PUT: actualizare ─────────────────────────────────────────────────────────
settings.put('/', requireAuth, async (c) => {
    let b;
    try { b = await c.req.json(); }
    catch { return c.json({ ok: false, error: 'Corp invalid.' }, 400); }

    const errors = [];

    // Câmpurile text simple, cu verificare de lungime.
    const textFields = [
        'display_name', 'phone_primary_label', 'phone_secondary_label',
        'hero_title', 'hero_subtitle', 'services_title',
        'about_title', 'about_text', 'contact_intro', 'email',
    ];
    const data = {};
    for (const key of textFields) {
        if (!(key in b)) continue;
        const val = clean(b[key]);
        const max = LIMITS[key];
        if (max && val.length > max) {
            errors.push(`Câmpul „${key}" depășește ${max} de caractere.`);
        } else {
            data[key] = val;
        }
    }

    // Numele afișat nu poate fi gol (apare peste tot pe site).
    if ('display_name' in data && !data.display_name) {
        errors.push('Numele afișat nu poate fi gol.');
    }

    // Telefoane: normalizate, validate ca format.
    for (const key of ['phone_primary', 'phone_secondary', 'whatsapp']) {
        if (!(key in b)) continue;
        const norm = normalizePhone(b[key]);
        if (norm && !isValidPhone(norm)) {
            errors.push(`Numărul „${key}" are un format nevalid.`);
        } else {
            data[key] = norm;
        }
    }

    // Servicii: exact 3 sau 0. Fiecare cu titlu + text, sub limite.
    if ('services' in b) {
        const arr = Array.isArray(b.services) ? b.services : [];
        if (arr.length !== 0 && arr.length !== 3) {
            errors.push('Serviciile trebuie să fie exact 3 (sau niciunul).');
        } else {
            const svc = [];
            for (const s of arr) {
                const title = clean(s.title).slice(0, LIMITS.svc_title);
                const text = clean(s.text).slice(0, LIMITS.svc_text);
                if (!title || !text) {
                    errors.push('Fiecare serviciu are nevoie de titlu și descriere.');
                    break;
                }
                svc.push({ title, text });
            }
            if (svc.length === arr.length) data._services_json = JSON.stringify(svc);
        }
    }

    if (errors.length) return c.json({ ok: false, errors }, 400);
    if (Object.keys(data).length === 0) return c.json({ ok: true }); // nimic de schimbat

    // Doar coloanele care există efectiv în tabel. Baza de date din producție
    // poate fi mai veche decât schema.sql (ex. `services_title` lipsea) — atunci
    // un singur câmp necunoscut făcea toată salvarea să eșueze cu 500.
    const columns = await settingsColumns(c.env.DB);

    // Construim UPDATE dinamic, doar cu câmpurile trimise.
    const sets = [];
    const binds = [];
    for (const [k, v] of Object.entries(data)) {
        const col = k === '_services_json' ? 'services' : k;
        if (columns && !columns.has(col)) {
            console.warn(`[settings] coloana „${col}" lipsește din DB — câmp ignorat`);
            continue;
        }
        if (k === '_services_json') { sets.push('services = ?'); binds.push(v); }
        else { sets.push(`${k} = ?`); binds.push(v); }
    }
    if (!sets.length) return c.json({ ok: true });
    if (!columns || columns.has('updated_at')) sets.push("updated_at = datetime('now')");

    try {
        await c.env.DB.prepare(`UPDATE settings SET ${sets.join(', ')} WHERE id = 1`)
            .bind(...binds).run();
        return c.json({ ok: true });
    } catch (err) {
        console.error('[settings] put:', err.message);
        return c.json({ ok: false, error: 'Eroare la salvare.' }, 500);
    }
});

export { settings };
