// ============================================================================
//  src/site/blocks.js — blocuri reutilizabile pentru pagina de stoc
// ----------------------------------------------------------------------------
//  Filtrele și paginarea. Ambele sunt pur server-side (formular GET + linkuri),
//  fără JavaScript — funcționează cu URL-uri partajabile și indexabile.
//
//  De ce GET și nu fetch: un filtru aplicat trebuie să fie un URL adevărat
//  (/stoc?brand=BMW&an_min=2018), ca să poată fi dat bookmark, partajat și
//  indexat de Google. Un cursor opac sau un state React ar strica asta.
// ============================================================================

import { html, raw } from './html.js';
import { icon } from './icons.js';
import { BRANDS, POLLUTION_STANDARDS, ENGINE_CAPACITIES, YEARS } from '../data/carOptions.js';

// ── Filtrele de căutare ──────────────────────────────────────────────────────
//  `q` = obiectul cu valorile curente din URL (ce a cerut utilizatorul), ca să
//  le repopulăm în formular după căutare.
export const Filters = (q = {}) => {
    const sel = (v, cur) => (String(v) === String(cur) ? raw(' selected') : '');

    return html`
<form class="filters" method="get" action="/stoc" id="filters">
  <div class="filters-grid">

    <div class="f-field">
      <label for="f-brand">Marcă</label>
      <select id="f-brand" name="brand">
        <option value="">Toate mărcile</option>
        ${BRANDS.map((b) => html`<option value="${b}"${sel(b, q.brand)}>${b}</option>`)}
      </select>
    </div>

    <div class="f-field">
      <label>An fabricație</label>
      <div class="f-pair">
        <select name="an_min" aria-label="An minim">
          <option value="">de la</option>
          ${YEARS.map((y) => html`<option value="${y}"${sel(y, q.an_min)}>${y}</option>`)}
        </select>
        <select name="an_max" aria-label="An maxim">
          <option value="">până la</option>
          ${YEARS.map((y) => html`<option value="${y}"${sel(y, q.an_max)}>${y}</option>`)}
        </select>
      </div>
    </div>

    <div class="f-field">
      <label>Preț (€)</label>
      <div class="f-pair">
        <input type="number" name="pret_min" inputmode="numeric" min="0" placeholder="min"
               value="${q.pret_min || ''}">
        <input type="number" name="pret_max" inputmode="numeric" min="0" placeholder="max"
               value="${q.pret_max || ''}">
      </div>
    </div>

    <div class="f-field">
      <label>Kilometraj</label>
      <div class="f-pair">
        <input type="number" name="km_min" inputmode="numeric" min="0" placeholder="min"
               value="${q.km_min || ''}">
        <input type="number" name="km_max" inputmode="numeric" min="0" placeholder="max"
               value="${q.km_max || ''}">
      </div>
    </div>

    <div class="f-field">
      <label for="f-poll">Normă poluare</label>
      <select id="f-poll" name="pollution">
        <option value="">Oricare</option>
        ${POLLUTION_STANDARDS.map((p) => html`<option value="${p}"${sel(p, q.pollution)}>${p}</option>`)}
      </select>
    </div>

    <div class="f-field">
      <label for="f-cap">Capacitate motor</label>
      <select id="f-cap" name="capacity">
        <option value="">Oricare</option>
        ${ENGINE_CAPACITIES.map((cc) => html`<option value="${cc}"${sel(cc, q.capacity)}>${cc}</option>`)}
      </select>
    </div>

  </div>

  <!-- păstrăm sortarea curentă când se aplică filtrele -->
  ${q.sort ? html`<input type="hidden" name="sort" value="${q.sort}">` : ''}

  <div class="filters-actions">
    <button class="btn btn--primary" type="submit">${raw(icon('gauge', 18))} Caută</button>
    <a class="btn btn--ghost" href="/stoc">Șterge filtrele</a>
  </div>
</form>`;
};

// ── Bara cu număr de rezultate + sortare ─────────────────────────────────────
export const StockBar = (total, q = {}) => {
    const opt = (v, label) =>
        html`<option value="${v}"${String(v) === String(q.sort || 'nou') ? raw(' selected') : ''}>${label}</option>`;

    // formular de sortare care păstrează filtrele curente ca hidden inputs
    const keep = ['brand', 'an_min', 'an_max', 'pret_min', 'pret_max', 'km_min', 'km_max', 'pollution', 'capacity'];

    return html`
<div class="stock-bar">
  <p class="stock-count"><b>${total}</b> ${total === 1 ? 'mașină' : 'mașini'} ${total === 1 ? 'disponibilă' : 'disponibile'}</p>
  <form class="stock-sort" method="get" action="/stoc" id="sort-form">
    ${keep.map((k) => (q[k] ? html`<input type="hidden" name="${k}" value="${q[k]}">` : ''))}
    <label for="sort">Sortează:</label>
    <select id="sort" name="sort" onchange="document.getElementById('sort-form').submit()">
      ${opt('nou', 'Cele mai noi')}
      ${opt('pret_asc', 'Preț crescător')}
      ${opt('pret_desc', 'Preț descrescător')}
      ${opt('an_desc', 'An descrescător')}
      ${opt('km_asc', 'Kilometraj crescător')}
    </select>
  </form>
</div>`;
};

// ── Paginare ─────────────────────────────────────────────────────────────────
//  Construiește URL-uri care păstrează filtrele curente, schimbând doar `page`.
export const Pagination = (page, pages, q = {}) => {
    if (pages <= 1) return '';

    // reconstruiește query string-ul cu un anumit page
    const buildUrl = (p) => {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(q)) {
            if (k === 'page' || v === '' || v == null) continue;
            params.set(k, v);
        }
        if (p > 1) params.set('page', p);
        const qs = params.toString();
        return qs ? `/stoc?${qs}` : '/stoc';
    };

    // Fereastra de pagini: prima, ultima, și ±1 în jurul curentei.
    const items = [];
    const add = (p) => items.push(p);
    const window = 1;
    let last = 0;
    for (let p = 1; p <= pages; p++) {
        if (p === 1 || p === pages || (p >= page - window && p <= page + window)) {
            if (last && p - last > 1) items.push('gap');
            add(p);
            last = p;
        }
    }

    return html`
<nav class="pagination" aria-label="Paginare">
  ${page > 1
        ? html`<a href="${buildUrl(page - 1)}" aria-label="Pagina anterioară">${raw(icon('arrow', 16))}</a>`
        : html`<span class="is-disabled" aria-hidden="true">${raw(icon('arrow', 16))}</span>`}

  ${items.map((it) =>
        it === 'gap'
            ? html`<span class="gap">…</span>`
            : it === page
                ? html`<span class="is-current" aria-current="page">${it}</span>`
                : html`<a href="${buildUrl(it)}">${it}</a>`)}

  ${page < pages
        ? html`<a href="${buildUrl(page + 1)}" aria-label="Pagina următoare" style="transform:scaleX(-1)">${raw(icon('arrow', 16))}</a>`
        : html`<span class="is-disabled" aria-hidden="true" style="transform:scaleX(-1)">${raw(icon('arrow', 16))}</span>`}
</nav>`;
};

export default { Filters, StockBar, Pagination };
