// ============================================================================
//  src/site/components.js — componente partajate între pagini
// ----------------------------------------------------------------------------
//  Header, footer, buton sticky WhatsApp, cardul de mașină. Toate sunt funcții
//  pure: primesc datele site-ului (din tabelul settings) și întorc HTML.
// ============================================================================

import { html, raw } from './html.js';
import { icon } from './icons.js';
import { formatPhoneDisplay, telHref, normalizePhone } from '../lib/carUtils.js';

// Link WhatsApp cu mesaj precompletat. Fără mesaj gol → dealerul primește
// contextul din prima.
export const waLink = (phone, text) => {
    const d = normalizePhone(phone);
    const msg = encodeURIComponent(text || 'Bună ziua! Sunt interesat de o mașină de pe site.');
    return `https://wa.me/${d}?text=${msg}`;
};

// ── Header ───────────────────────────────────────────────────────────────────
export const Header = (site, current = '') => {
    const nav = [
        { href: '/', label: 'Acasă', key: 'home' },
        { href: '/stoc', label: 'Stoc mașini', key: 'stoc' },
        { href: '/contact', label: 'Contact', key: 'contact' },
    ];
    return html`
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="/">
      <img class="brand-logo" src="/assets/logo.png" alt="${site.display_name}"
           width="120" height="44" fetchpriority="high">
    </a>

    <nav class="nav" aria-label="Navigare principală">
      ${nav.map((n) => html`<a href="${n.href}"${current === n.key ? raw(' aria-current="page"') : ''}>${n.label}</a>`)}
    </nav>

    <div class="header-cta">
      <a class="header-phone" href="tel:${telHref(site.phone_primary)}">
        ${raw(icon('phone', 18))}<span>${formatPhoneDisplay(site.phone_primary)}</span>
      </a>
      <label class="nav-btn" for="nav-toggle" aria-label="Meniu">${raw(icon('menu', 22))}</label>
    </div>
  </div>

  <!-- Meniu mobil fără JavaScript: checkbox + selector de vecin -->
  <input type="checkbox" id="nav-toggle" class="nav-toggle" hidden>
  <div class="nav-mobile">
    <div class="wrap">
      ${nav.map((n) => html`<a href="${n.href}">${n.label}</a>`)}
    </div>
  </div>
</header>`;
};

// ── Footer ───────────────────────────────────────────────────────────────────
const DAYS = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];

export const Footer = (site) => {
    const schedule = Array.isArray(site.schedule) ? site.schedule : DEFAULT_SCHEDULE;
    const year = new Date().getFullYear();
    return html`
<footer class="site-footer">
  <div class="wrap">
    <div class="footer-grid">

      <div>
        <div class="footer-brand">
          <img src="/assets/logo.png" alt="${site.display_name}" width="120" height="46">
        </div>
        <p class="lead" style="font-size:.95rem;color:var(--muted)">
          Mașini verificate, la intrarea în Botoșani dinspre Suceava.
          Finanțare în rate prin TBI Bank.
        </p>
        ${site.facebook_url ? html`
        <div class="footer-social">
          <a href="${site.facebook_url}" target="_blank" rel="noopener" aria-label="Facebook">${raw(icon('facebook', 20))}</a>
        </div>` : ''}
      </div>

      <div>
        <h4>Navigare</h4>
        <ul class="footer-list">
          <li><a href="/">Acasă</a></li>
          <li><a href="/stoc">Stoc mașini</a></li>
          <li><a href="/contact">Contact</a></li>
          <li><a href="/termeni">Termeni și condiții</a></li>
          <li><a href="/confidentialitate">Confidențialitate</a></li>
        </ul>
      </div>

      <div>
        <h4>Program</h4>
        ${schedule.map((d) => html`
        <div class="footer-hours${d.closed ? raw(' is-closed') : ''}">
          <span>${DAYS[d.day]}</span>
          <span>${d.closed ? 'Închis' : `${d.open} – ${d.close}`}</span>
        </div>`)}
      </div>

    </div>

    <div class="footer-legal">
      <p class="footer-firm">
        ${site.company_name || 'VANZARI AUTO PARK SRL'} ·
        CUI ${site.company_cui || 'RO31727751'} ·
        ${site.company_reg || 'J07/191/2013'} ·
        ${site.company_address || 'Sat Hudum, com. Curtești, jud. Botoșani'}
      </p>
      <div class="footer-links">
        <span>© ${year} ${site.display_name}. Toate drepturile rezervate.</span>
        <a href="/termeni">Termeni</a>
        <a href="/confidentialitate">Confidențialitate</a>
      </div>
    </div>
  </div>
</footer>`;
};

// Program implicit — folosit dacă settings nu are unul (îl setăm real în Batch 11).
export const DEFAULT_SCHEDULE = [
    { day: 1, open: '08:00', close: '17:00', closed: false },
    { day: 2, open: '08:00', close: '14:30', closed: false },
    { day: 3, open: '08:00', close: '15:00', closed: false },
    { day: 4, open: '08:00', close: '17:00', closed: false },
    { day: 5, open: '08:00', close: '17:00', closed: false },
    { day: 6, open: '08:00', close: '14:00', closed: false },
    { day: 0, open: '', close: '', closed: true },
];

// ── Buton sticky WhatsApp ────────────────────────────────────────────────────
export const StickyWhatsApp = (site) => html`
<a class="sticky-wa" href="${waLink(site.whatsapp)}" target="_blank" rel="noopener"
   aria-label="Scrie-ne pe WhatsApp">
  ${raw(icon('whatsapp', 22))}<span>Scrie-ne pe WhatsApp</span>
</a>`;

// ── Card de mașină ───────────────────────────────────────────────────────────
const fmtPrice = (n) => new Intl.NumberFormat('de-DE').format(n);
const fmtKm = (n) => new Intl.NumberFormat('de-DE').format(n);
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

export const CarCard = (car, site) => {
    const cover = Array.isArray(car.media) && car.media[0]
        ? `/media/cars/${car.id}/${car.media[0].id}.${car.media[0].ext || 'jpg'}`
        : null;
    const isSold = car.status === 'sold';
    const waText = `Bună ziua! Sunt interesat de ${car.title} (${fmtPrice(car.price)} €) de pe site.`;

    return html`
<article class="car reveal">
  <a class="car-media" href="/masina/${car.slug}" aria-label="${car.title}">
    ${cover
        ? html`<img src="${cover}" alt="${car.title}"
                 width="${car.media[0].w || 800}" height="${car.media[0].h || 600}"
                 loading="lazy" decoding="async">`
        : html`<div class="car-noimg">${raw(icon('road', 40))}</div>`}
    <span class="car-price">${fmtPrice(car.price)} €</span>
    ${isSold ? html`<span class="car-badge car-badge--sold">Vândut</span>` : ''}
  </a>
  <div class="car-body">
    <a href="/masina/${car.slug}"><h3 class="car-title">${car.title}</h3></a>
    <ul class="car-specs">
      <li>${car.production_year}</li>
      <li>${fmtKm(car.mileage)} km</li>
      <li>${cap(car.fuel)}</li>
      <li>${car.engine_capacity}</li>
    </ul>
    <div class="car-foot">
      <a class="car-wa" href="${waLink(site.whatsapp, waText)}" target="_blank" rel="noopener">
        ${raw(icon('whatsapp', 18))} Întreabă de această mașină
      </a>
    </div>
  </div>
</article>`;
};

export default { Header, Footer, StickyWhatsApp, CarCard, waLink, DEFAULT_SCHEDULE };
