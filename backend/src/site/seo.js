// ============================================================================
//  src/site/seo.js — sitemap.xml, robots.txt și helpere SEO
// ----------------------------------------------------------------------------
//  Sitemap dinamic din stocul real: acasă, stoc, contact, legale + fiecare
//  mașină publicată. `lastmod` din data reală de actualizare.
//
//  robots.txt trimite crawlerii către sitemap și blochează /admin.
// ============================================================================

const esc = (s) => String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// data ISO scurtă (YYYY-MM-DD) pentru lastmod
const isoDate = (s) => {
    try { return new Date(s || Date.now()).toISOString().slice(0, 10); }
    catch { return new Date().toISOString().slice(0, 10); }
};

/**
 * Construiește sitemap.xml.
 * @param {string} origin  https://vanzariautopark.ro
 * @param {Array}  cars    [{ slug, updated_at }]
 */
export const buildSitemap = (origin, cars = []) => {
    const staticPages = [
        { loc: '/', priority: '1.0', freq: 'daily' },
        { loc: '/stoc', priority: '0.9', freq: 'daily' },
        { loc: '/contact', priority: '0.6', freq: 'monthly' },
        { loc: '/termeni', priority: '0.2', freq: 'yearly' },
        { loc: '/confidentialitate', priority: '0.2', freq: 'yearly' },
        { loc: '/cookies', priority: '0.2', freq: 'yearly' },
    ];

    const urls = [];

    for (const p of staticPages) {
        urls.push(
            `  <url>\n    <loc>${esc(origin + p.loc)}</loc>\n` +
            `    <changefreq>${p.freq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`
        );
    }

    for (const car of cars) {
        if (!car.slug) continue;
        urls.push(
            `  <url>\n    <loc>${esc(origin + '/masina/' + car.slug)}</loc>\n` +
            `    <lastmod>${isoDate(car.updated_at)}</lastmod>\n` +
            `    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`
        );
    }

    return `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        urls.join('\n') + `\n</urlset>`;
};

/** robots.txt — permite tot, blochează /admin, trimite la sitemap. */
export const buildRobots = (origin) =>
    `User-agent: *\n` +
    `Allow: /\n` +
    `Disallow: /admin\n` +
    `Disallow: /api/\n\n` +
    `Sitemap: ${origin}/sitemap.xml\n`;

export default { buildSitemap, buildRobots };
