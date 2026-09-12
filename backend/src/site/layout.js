// ============================================================================
//  src/site/layout.js — shell-ul HTML comun tuturor paginilor
// ----------------------------------------------------------------------------
//  Tot <head>-ul într-un singur loc: meta, Open Graph, canonical, CSS.
//  CSS-ul e servit ca fișier extern cacheabil (/assets/site.<v>.css), dar
//  variabilele nu — sunt deja în fișier. Aici doar îl legăm.
// ============================================================================

import { html, raw, toHtml } from './html.js';
import { CSS_VERSION } from './styles.js';

/**
 * @param {object} o
 *   site        — datele din settings
 *   title       — titlul paginii (fără sufixul de brand)
 *   description — meta description
 *   canonical   — URL absolut canonical
 *   body        — conținutul (rezultat html`...`)
 *   current     — cheia paginii active (pt. header)
 *   ogImage     — imagine pentru share (opțional)
 *   head        — HTML suplimentar în <head> (ex. JSON-LD)
 */
export const Layout = (o) => {
    const site = o.site || {};
    const fullTitle = o.title
        ? `${o.title} · ${site.display_name || 'Vanzari Auto Park'}`
        : (site.display_name || 'Vanzari Auto Park');
    const desc = (o.description || '').slice(0, 160);

    return toHtml(html`<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${fullTitle}</title>
${desc ? html`<meta name="description" content="${desc}">` : ''}
${o.canonical ? html`<link rel="canonical" href="${o.canonical}">` : ''}
${o.noindex ? raw('<meta name="robots" content="noindex, nofollow">') : ''}

<meta property="og:type" content="website">
<meta property="og:title" content="${fullTitle}">
${desc ? html`<meta property="og:description" content="${desc}">` : ''}
${o.canonical ? html`<meta property="og:url" content="${o.canonical}">` : ''}
${o.ogImage ? html`<meta property="og:image" content="${o.ogImage}">` : ''}
<meta name="theme-color" content="#0a0a0a">

<link rel="icon" href="/assets/logo.png">
<link rel="preconnect" href="/media">
<link rel="stylesheet" href="/assets/site.${CSS_VERSION}.css">
${o.head ? o.head : ''}
</head>
<body>
${o.body}
</body>
</html>`);
};

export default { Layout };
