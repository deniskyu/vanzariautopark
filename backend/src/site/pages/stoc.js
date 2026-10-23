// ============================================================================
//  src/site/pages/stoc.js — pagina de stoc cu filtre și paginare
// ----------------------------------------------------------------------------
//  Randare 100% server-side: filtrele sunt un formular GET, paginarea sunt
//  linkuri. Fiecare combinație de filtre e un URL propriu, partajabil și
//  indexabil.
//
//  Titlul se adaptează la filtre („BMW de vânzare" când filtrezi pe BMW) —
//  bun pentru SEO pe căutări de tip „bmw botoșani".
// ============================================================================

import { html, raw } from '../html.js';
import { Layout } from '../layout.js';
import { Header, Footer, StickyWhatsApp, CarCard } from '../components.js';
import { Filters, StockBar, Pagination } from '../blocks.js';
import { telHref } from '../../lib/carUtils.js';

export const renderStoc = (site, { cars, total, page, pages, q, availableBrands }) => {
    // Titlu adaptat la filtrul de marcă, pentru SEO.
    const brandFilter = q.brand ? ` ${q.brand}` : '';
    const heading = q.brand
        ? `${q.brand} de vânzare`
        : 'Toate mașinile din stoc';

    const metaDesc = q.brand
        ? `Mașini ${q.brand} de vânzare la ${site.display_name}, Botoșani. Prețuri și detalii complete, finanțare în rate prin TBI Bank.`
        : `Stocul complet de mașini la ${site.display_name}, la intrarea în Botoșani dinspre Suceava. Filtrează după marcă, an, preț și kilometraj.`;

    // Canonical: pe pagini filtrate, canonical către /stoc curat (evită
    // conținut duplicat pe zeci de combinații de filtre).
    const hasFilters = Object.keys(q).some((k) => k !== 'page' && q[k]);
    const canonical = `https://${site.domain}/stoc`;

    const body = html`
${Header(site, 'stoc')}

<main class="section">
  <div class="wrap">

    <div class="section-head">
      <p class="eyebrow">Stoc disponibil</p>
      <h1>Mașini${brandFilter} de vânzare în Botoșani</h1>
    </div>

    ${Filters(q, availableBrands)}

    ${total > 0 ? html`
      ${StockBar(total, q)}
      <div class="car-grid">
        ${cars.map((car) => CarCard(car, site))}
      </div>
      ${Pagination(page, pages, q)}
    ` : html`
      <div class="empty-state">
        ${hasFilters ? html`
          <p style="font-size:1.1rem;margin-bottom:.5rem">Nicio mașină nu corespunde filtrelor.</p>
          <p style="margin-bottom:1.2rem">Încearcă să lărgești criteriile de căutare.</p>
          <a class="btn btn--primary" href="/stoc">Vezi toate mașinile</a>
        ` : html`
          <p style="font-size:1.1rem;margin-bottom:.5rem">Mașinile se încarcă în curând pe site.</p>
          <p>Sună-ne pentru oferta disponibilă acum în parc.</p>
          <div class="stock-cta">
            <a class="btn btn--primary" href="tel:${telHref(site.phone_primary)}">Sună acum</a>
          </div>
        `}
      </div>
    `}

  </div>
</main>

${Footer(site)}
${StickyWhatsApp(site)}`;

    return Layout({
        site,
        title: q.brand ? heading : 'Stoc mașini',
        description: metaDesc,
        canonical,
        // Paginile filtrate NU se indexează separat — doar /stoc curat.
        noindex: hasFilters,
        current: 'stoc',
        body,
    });
};

export default { renderStoc };
