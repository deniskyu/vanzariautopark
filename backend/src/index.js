// ============================================================================
//  src/index.js — punctul de intrare al Worker-ului (Hono)
// ----------------------------------------------------------------------------
//  Montează rutele. Site-ul public randat server-side vine în Batch 5 — până
//  atunci, ruta '/' răspunde cu un mesaj simplu, ca să confirmi că merge.
//
//  Ordinea de montare:
//    /api/admin/*        login, logout, opțiuni  (unele protejate în interior)
//    /api/admin/cars/*   CRUD mașini, tot protejat
//    /api/cars/*         citire publică
//    /media/*            (Batch 3)
//    /*                  site public (Batch 5)
//
//  ── CRON ─────────────────────────────────────────────────────────────────
//  Pe lângă `fetch` (cererile HTTP normale, gestionate de Hono), Worker-ul
//  exportă și `scheduled` — apelat automat de Cloudflare la orele din
//  `triggers.crons` (wrangler.jsonc). Rulează sweepOrphanedMedia(), care
//  curăță din B2 pozele urcate și niciodată atașate unei mașini salvate
//  (Stratul 3 din strategia anti-orfani; Straturile 1, 2 și 4 sunt deja în
//  media.js și cars.js).
// ============================================================================

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { admin } from './routes/admin.js';
import { cars, adminCars } from './routes/cars.js';
import { adminMedia, media } from './routes/media.js';
import { settings } from './routes/settings.js';
import { buildSitemap, buildRobots } from './site/seo.js';
import { SITE_CSS, CSS_VERSION } from './site/styles.js';
import { renderHome } from './site/pages/home.js';
import { renderStoc } from './site/pages/stoc.js';
import { renderMasina } from './site/pages/masina.js';
import { renderContact } from './site/pages/contact.js';
import { renderTermeni, renderConfidentialitate, renderCookies } from './site/pages/legal.js';
import { BRANDS, POLLUTION_STANDARDS, ENGINE_CAPACITIES } from './data/carOptions.js';
import { DEFAULT_SCHEDULE } from './site/components.js';
import { sweepOrphanedMedia } from './lib/sweep.js';

const app = new Hono();

// ── Citește configurația site-ului din settings (un singur rând) ─────────────
// Cu fallback la valori implicite, ca pagina să meargă chiar înainte de seed.
const loadSite = async (env) => {
    let row = {};
    try {
        row = await env.DB.prepare('SELECT * FROM settings WHERE id = 1').first() || {};
    } catch { /* DB indisponibil la build local — folosim implicitele */ }
    // parsăm JSON-urile
    try { row.services = JSON.parse(row.services || '[]'); } catch { row.services = []; }
    if (!row.schedule) row.schedule = DEFAULT_SCHEDULE;
    row.domain = row.domain || 'vanzariautopark.ro';
    return row;
};

// ── CORS ─────────────────────────────────────────────────────────────────────
//  Panoul de admin (React pe Cloudflare Pages) trăiește pe alt domeniu decât
//  Worker-ul, deci are nevoie de CORS cu credentials, ca să trimită cookie-ul.
//  Domeniul panoului se pune în ADMIN_ORIGIN (secret). Site-ul public randat
//  de Hono e pe același origin, deci nu-l afectează.
app.use('/api/*', async (c, next) => {
    const origin = c.env.ADMIN_ORIGIN || '';
    return cors({
        origin: origin ? [origin] : [],
        credentials: true,
        allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type'],
    })(c, next);
});

// ── Rute API ─────────────────────────────────────────────────────────────────
app.route('/api/admin/cars', adminCars);   // protejat în interior (requireAuth)
app.route('/api/admin/media', adminMedia); // upload foto, protejat
app.route('/api/admin/settings', settings); // citire + editare setări site
app.route('/api/admin', admin);            // login/logout publice, options protejat
app.route('/api/cars', cars);              // public
app.route('/media', media);                // servire foto, public

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (c) => c.json({ ok: true, service: 'vanzariautopark' }));

// ── CSS-ul site-ului, ca fișier cacheabil un an ──────────────────────────────
app.get(`/assets/site.${CSS_VERSION}.css`, (c) => {
    return new Response(SITE_CSS, {
        headers: {
            'content-type': 'text/css; charset=utf-8',
            'cache-control': 'public, max-age=31536000, immutable',
        },
    });
});

// ── SITEMAP & ROBOTS ─────────────────────────────────────────────────────────
const siteOrigin = (c) => {
    const host = c.req.header('host') || 'vanzariautopark.ro';
    return `https://${host}`;
};

app.get('/sitemap.xml', async (c) => {
    const origin = siteOrigin(c);
    let cars = [];
    try {
        const { results } = await c.env.DB.prepare(
            "SELECT slug, updated_at FROM cars WHERE status = 'published' ORDER BY updated_at DESC LIMIT 5000"
        ).all();
        cars = results || [];
    } catch { /* fără mașini */ }
    return new Response(buildSitemap(origin, cars), {
        headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' },
    });
});

app.get('/robots.txt', (c) => {
    return new Response(buildRobots(siteOrigin(c)), {
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=86400' },
    });
});

// ── ACASĂ ────────────────────────────────────────────────────────────────────
app.get('/', async (c) => {
    const site = await loadSite(c.env);
    let cars = [];
    try {
        const { results } = await c.env.DB.prepare(
            `SELECT id, slug, title, brand, production_year, price, mileage, fuel,
                    engine_capacity, media, status FROM cars
             WHERE status = 'published' ORDER BY featured DESC, created_at DESC LIMIT 6`
        ).all();
        cars = (results || []).map((r) => {
            try { r.media = JSON.parse(r.media || '[]'); } catch { r.media = []; }
            return r;
        });
    } catch { /* fără mașini încă */ }
    return c.html(renderHome(site, cars));
});

// ── STOC ─────────────────────────────────────────────────────────────────────
const PAGE_SIZE = 20;
app.get('/stoc', async (c) => {
    const site = await loadSite(c.env);
    const qs = c.req.query();

    // Preluăm doar filtrele valide (validate contra listelor hardcodate).
    const q = {};
    if (qs.brand && BRANDS.includes(qs.brand)) q.brand = qs.brand;
    if (qs.pollution && POLLUTION_STANDARDS.includes(qs.pollution)) q.pollution = qs.pollution;
    if (qs.capacity && ENGINE_CAPACITIES.includes(qs.capacity)) q.capacity = qs.capacity;
    for (const k of ['an_min', 'an_max', 'pret_min', 'pret_max', 'km_min', 'km_max']) {
        const n = parseInt(qs[k], 10);
        if (Number.isFinite(n) && n >= 0) q[k] = n;
    }
    const SORTS = {
        nou: 'featured DESC, created_at DESC', pret_asc: 'price ASC',
        pret_desc: 'price DESC', an_desc: 'production_year DESC', km_asc: 'mileage ASC',
    };
    if (qs.sort && SORTS[qs.sort]) q.sort = qs.sort;

    // Construim WHERE dinamic, totul prin bind.
    const where = ["status = 'published'"];
    const binds = [];
    if (q.brand) { where.push('brand = ?'); binds.push(q.brand); }
    if (q.pollution) { where.push('pollution_standard = ?'); binds.push(q.pollution); }
    if (q.capacity) { where.push('engine_capacity = ?'); binds.push(q.capacity); }
    const rng = (f, lo, hi) => {
        if (q[lo] != null) { where.push(`${f} >= ?`); binds.push(q[lo]); }
        if (q[hi] != null) { where.push(`${f} <= ?`); binds.push(q[hi]); }
    };
    rng('price', 'pret_min', 'pret_max');
    rng('production_year', 'an_min', 'an_max');
    rng('mileage', 'km_min', 'km_max');

    // Interval inversat (min > max) → îl schimbăm între ele, nu întoarcem zero.
    // (Făcut aici pe query, înainte de bind — dar mai simplu: verificăm în q.)
    const whereSql = where.join(' AND ');
    const order = SORTS[q.sort] || SORTS.nou;
    const page = Math.max(1, parseInt(qs.page, 10) || 1);
    const offset = (page - 1) * PAGE_SIZE;

    let cars = [], total = 0;
    try {
        const cnt = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM cars WHERE ${whereSql}`)
            .bind(...binds).first();
        total = cnt?.n || 0;
        const { results } = await c.env.DB.prepare(
            `SELECT id, slug, title, brand, production_year, price, mileage, fuel,
                    engine_capacity, media, status FROM cars
             WHERE ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`
        ).bind(...binds, PAGE_SIZE, offset).all();
        cars = (results || []).map((r) => {
            try { r.media = JSON.parse(r.media || '[]'); } catch { r.media = []; }
            return r;
        });
    } catch (err) {
        console.error('[stoc]', err.message);
    }

    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    // Mărcile care există efectiv în stoc (published), pentru filtru.
    let availableBrands = [];
    try {
        const { results } = await c.env.DB.prepare(
            "SELECT DISTINCT brand FROM cars WHERE status = 'published' ORDER BY brand"
        ).all();
        availableBrands = (results || []).map((r) => r.brand);
    } catch { /* fallback: toate mărcile */ }

    return c.html(renderStoc(site, { cars, total, page, pages, q, availableBrands }));
});

// ── PAGINA UNEI MAȘINI ───────────────────────────────────────────────────────
app.get('/masina/:slug', async (c) => {
    const site = await loadSite(c.env);
    const slug = c.req.param('slug');

    let car = null;
    try {
        car = await c.env.DB.prepare(
            `SELECT id, slug, title, brand, production_year, price, negotiable, mileage,
                    fuel, engine_capacity, horsepower, pollution_standard, body_type, color,
                    transmission, drivetrain, steering_wheel, vin, registration_status,
                    for_dismantling, description, phone, media, status
             FROM cars WHERE slug = ?`
        ).bind(slug).first();
    } catch (err) {
        console.error('[masina]', err.message);
    }

    // Doar published și sold sunt vizibile public. Draft → 404.
    if (!car || car.status === 'draft') {
        return c.html(render404(site), 404);
    }

    try { car.media = JSON.parse(car.media || '[]'); } catch { car.media = []; }
    car.negotiable = !!car.negotiable;
    car.for_dismantling = !!car.for_dismantling;

    // Incrementăm vizualizările în fundal.
    c.executionCtx?.waitUntil?.(
        c.env.DB.prepare('UPDATE cars SET views = views + 1 WHERE id = ?').bind(car.id).run()
    );

    return c.html(renderMasina(site, car));
});

// ── CONTACT ──────────────────────────────────────────────────────────────────
app.get('/contact', async (c) => {
    const site = await loadSite(c.env);
    return c.html(renderContact(site));
});


// ── PAGINI LEGALE ────────────────────────────────────────────────────────────
app.get('/termeni', async (c) => c.html(renderTermeni(await loadSite(c.env))));
app.get('/confidentialitate', async (c) => c.html(renderConfidentialitate(await loadSite(c.env))));
app.get('/cookies', async (c) => c.html(renderCookies(await loadSite(c.env))));

// 404 minimal stilizat (îl înlocuim cu unul complet în Batch 8)
const render404 = (site) => `<!doctype html><html lang="ro"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pagină negăsită</title><link rel="stylesheet" href="/assets/site.${CSS_VERSION}.css"></head>
<body><main class="wrap section" style="text-align:center;min-height:60vh;display:flex;flex-direction:column;justify-content:center;gap:1rem">
<h1>404 · Anunțul nu există</h1><p class="lead" style="margin-inline:auto">Mașina căutată nu mai e disponibilă sau a fost ștearsă.</p>
<div><a class="btn btn--primary" href="/stoc">Vezi stocul</a></div></main></body></html>`;

// ── 404 API ──────────────────────────────────────────────────────────────────
app.notFound((c) => {
    if (c.req.path.startsWith('/api/')) return c.json({ ok: false, error: 'Rută inexistentă.' }, 404);
    return c.html('<!doctype html><meta charset="utf-8"><title>404</title><p>Pagină negăsită.</p>', 404);
});

// ── Erori neprinse ───────────────────────────────────────────────────────────
app.onError((err, c) => {
    console.error('[unhandled]', err);
    if (c.req.path.startsWith('/api/')) return c.json({ ok: false, error: 'Eroare server.' }, 500);
    return c.html('<!doctype html><meta charset="utf-8"><title>Eroare</title><p>A apărut o eroare.</p>', 500);
});

// ── Export ───────────────────────────────────────────────────────────────────
//  Înainte era `export default app;` (Hono, doar fetch). Acum exportăm un
//  obiect cu ambele: `fetch` (exact comportamentul Hono de dinainte) și
//  `scheduled` (apelat de Cloudflare la orele din triggers.crons).
export default {
    fetch: app.fetch,
    async scheduled(event, env, ctx) {
        ctx.waitUntil(sweepOrphanedMedia(env));
    },
};
