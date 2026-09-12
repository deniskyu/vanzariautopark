// ============================================================================
//  src/site/html.js — template tag cu escapare automată
// ----------------------------------------------------------------------------
//  Fundația randării server-side. Escaparea e IMPLICITĂ: orice interpolare într-un
//  `html\`\`` e escapată automat. HTML-ul brut cere un gest explicit — `raw()`.
//
//  De ce contează: în pagini intră text din baza de date (titluri de anunțuri,
//  descrieri scrise de patron). Fără escapare automată, ar trebui să-ți
//  amintești să escapezi la fiecare interpolare — o singură omisiune e o
//  vulnerabilitate XSS.
//
//  Hono are propriul `html`, dar acesta e portabil, testabil izolat și identic
//  cu cel din proiectul vechi, ca să pot porta componentele fără surprize.
// ============================================================================

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const RE = /[&<>"']/g;

export const escapeHtml = (v) => String(v).replace(RE, (c) => ESC[c]);

const RAW = Symbol('raw');
export const raw = (str) => ({ [RAW]: true, value: String(str ?? '') });
export const isRaw = (v) => !!(v && typeof v === 'object' && v[RAW]);

const render = (v) => {
    if (v === null || v === undefined || v === false || v === true) return '';
    if (isRaw(v)) return v.value;
    if (Array.isArray(v)) return v.map(render).join('');
    return escapeHtml(v);
};

export const html = (strings, ...values) => {
    let out = strings[0];
    for (let i = 0; i < values.length; i++) out += render(values[i]) + strings[i + 1];
    return raw(out);
};

// Convertește rezultatul final în șir (pentru c.html()).
export const toHtml = (node) => render(node);

// Atribute condiționale: attrs({ class: x, hidden: cond })
export const attrs = (obj) => {
    const parts = [];
    for (const [k, v] of Object.entries(obj || {})) {
        if (v === false || v === null || v === undefined || v === '') continue;
        if (v === true) { parts.push(escapeHtml(k)); continue; }
        parts.push(`${escapeHtml(k)}="${escapeHtml(v)}"`);
    }
    return raw(parts.join(' '));
};

export const cls = (...names) => names.filter(Boolean).join(' ');

// Conținut de <style> sau <script>: neutralizează doar secvența de închidere.
export const styleContent = (css) =>
    raw(String(css ?? '').replace(/<\/(style|script)/gi, '<\\/$1'));

export default { html, raw, escapeHtml, toHtml, attrs, cls, styleContent, isRaw };
