// ============================================================================
//  src/site/pages/home.js — pagina de acasă
// ----------------------------------------------------------------------------
//  Secțiuni, în ordine:
//    1. Hero — 5 imagini cu tranziție + zoom lent, titlu/subtitlu editabile
//    2. Banda TBI subțire (portocalie) + servicii (3 carduri editabile)
//    3. Bannerul TBI mare (90% lățime)
//    4. Ultimele mașini (dacă există) sau mesaj că nu-s încă urcate
//    5. Bandă de contact
//
//  Hero-ul are un mic script inline (tranziția între imagini). E singurul JS de
//  pe acasă; restul e static. Fără el, prima imagine rămâne afișată — degradare
//  curată.
// ============================================================================

import { html, raw } from '../html.js';
import { icon } from '../icons.js';
import { Layout } from '../layout.js';
import { Header, Footer, StickyWhatsApp, CarCard, waLink } from '../components.js';

// Cele 5 imagini de hero din assets (landing1-5).
const HERO_IMAGES = [
    '/assets/landing1.jpeg',
    '/assets/landing2.jpeg',
    '/assets/landing3.jpeg',
    '/assets/landing4.jpeg',
    '/assets/landing5.jpeg',
];

// Iconițe pentru cele 3 servicii, în ordinea din settings.
const SERVICE_ICONS = ['bank', 'truck', 'shield'];

export const renderHome = (site, cars = []) => {
    const services = Array.isArray(site.services) && site.services.length === 3
        ? site.services
        : DEFAULT_SERVICES;

    const body = html`
${Header(site, 'home')}

<main>

  <!-- ── HERO ──────────────────────────────────────────────────────────── -->
  <section class="hero" aria-label="${site.display_name}">
    <div class="hero-slides" aria-hidden="true" id="hero-slides">
      ${HERO_IMAGES.map((src, i) => html`
      <div class="hero-slide${i === 0 ? raw(' is-active') : ''}" style="background-image:url(${src})"></div>`)}
    </div>
    <div class="hero-scrim"></div>

    <div class="hero-inner">
      <h1>${site.hero_title || DEFAULT_HERO.title}</h1>
      <p class="hero-sub">${site.hero_subtitle || DEFAULT_HERO.subtitle}</p>
      <div class="hero-actions">
        <a class="btn btn--primary" href="/stoc">${raw(icon('road', 18))} Vezi stocul</a>
        <a class="btn btn--ghost" href="/contact" style="border-color:rgba(255,255,255,.6);color:#fff">
          Contactează-ne
        </a>
      </div>
    </div>

    <div class="hero-dots" id="hero-dots">
      ${HERO_IMAGES.map((_, i) => html`
      <button type="button" class="hero-dot${i === 0 ? raw(' is-active') : ''}"
              data-i="${i}" aria-label="Imaginea ${i + 1}"></button>`)}
    </div>
  </section>

  <!-- ── BANDA TBI (subțire) ───────────────────────────────────────────── -->
  <div class="tbi-strip">
    <div class="wrap tbi-strip-in">
      <img src="/assets/tbi_logo.png" alt="TBI Bank">
      <span>Parteneriat oficial · Finanțare în rate prin TBI Bank</span>
    </div>
  </div>

  <!-- ── SERVICII ──────────────────────────────────────────────────────── -->
  <section class="section section-center">
    <div class="wrap">
      <div class="section-head">
        <p class="eyebrow">Ce oferim</p>
        <h2>${site.services_title || 'Servicii care fac diferența'}</h2>
      </div>
      <div class="svc-grid">
        ${services.map((s, i) => html`
        <div class="svc reveal">
          <span class="svc-icon">${raw(icon(SERVICE_ICONS[i] || 'check', 26))}</span>
          <h3>${s.title}</h3>
          <p>${s.text}</p>
        </div>`)}
      </div>
    </div>
  </section>

  <!-- ── BANNER TBI (mare, 90% lățime) ─────────────────────────────────── -->
  <div class="tbi-banner">
    <img src="/assets/tbi_banner.png" alt="Finanțare în rate prin TBI Bank"
         width="1100" height="380" loading="lazy">
  </div>

  <!-- ── ULTIMELE MAȘINI ───────────────────────────────────────────────── -->
  <section class="section section-center">
    <div class="wrap">
      <div class="section-head">
        <p class="eyebrow">Stoc disponibil</p>
        <h2>Cele mai noi mașini</h2>
      </div>

      ${cars.length > 0 ? html`
      <div class="car-grid" style="text-align:left">
        ${cars.map((car) => CarCard(car, site))}
      </div>
      <div class="stock-cta">
        <a class="btn btn--primary" href="/stoc">
          Vezi tot stocul ${raw(icon('arrow', 18))}
        </a>
      </div>` : html`
      <div class="empty-state">
        <p style="font-size:1.1rem;margin-bottom:.5rem">Mașinile se încarcă în curând pe site.</p>
        <p>Până atunci, sună-ne direct pentru oferta disponibilă în parc.</p>
        <div class="stock-cta">
          <a class="btn btn--primary" href="tel:${site.phone_primary}">
            ${raw(icon('phone', 18))} Sună acum
          </a>
        </div>
      </div>`}
    </div>
  </section>

  <!-- ── BANDĂ DE CONTACT ──────────────────────────────────────────────── -->
  <section class="cta-band">
    <div class="wrap cta-inner">
      <div>
        <h2>Ai găsit mașina potrivită?</h2>
        <p>Sună-ne sau scrie-ne pe WhatsApp. Îți răspundem rapid.</p>
      </div>
      <div class="cta-actions">
        <a class="cta-phone" href="tel:${site.phone_primary}">
          ${raw(icon('phone', 20))} ${site.phone_primary}
        </a>
        <a class="btn" style="background:#0a0a0a;color:#E5FB14" href="/contact">
          Detalii contact
        </a>
      </div>
    </div>
  </section>

</main>

${Footer(site)}
${StickyWhatsApp(site)}

<script>${raw(HERO_SCRIPT)}</script>`;

    return Layout({
        site,
        title: '',   // pe acasă, doar numele parcului
        description: site.meta_description
            || `${site.display_name} — parc auto la intrarea în Botoșani dinspre Suceava. Mașini verificate, finanțare în rate prin TBI Bank. Deservim Botoșani, Suceava și împrejurimile.`,
        canonical: `https://${site.domain || 'vanzariautopark.ro'}/`,
        current: 'home',
        ogImage: HERO_IMAGES[0],
        head: raw(`<script type="application/ld+json">${autoDealerLd(site)}</script>`),
        body,
    });
};

// ── Scriptul hero: tranziția între imagini ───────────────────────────────────
const HERO_SCRIPT = `
(function(){
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var slides = document.querySelectorAll('#hero-slides .hero-slide');
  var dots = document.querySelectorAll('#hero-dots .hero-dot');
  if (slides.length < 2) return;
  var active = 0, timer = null;

  function show(n){
    slides[active].classList.remove('is-active');
    if (dots[active]) dots[active].classList.remove('is-active');
    active = (n + slides.length) % slides.length;
    slides[active].classList.add('is-active');
    if (dots[active]) dots[active].classList.add('is-active');
  }
  function start(){ timer = setInterval(function(){ show(active + 1); }, 4000); }
  function reset(){ clearInterval(timer); start(); }

  dots.forEach(function(d){
    d.addEventListener('click', function(){ show(parseInt(d.dataset.i, 10)); reset(); });
  });
  start();
})();`;

// ── TEXTE IMPLICITE (până le editează patronul în admin, Batch 11) ───────────
export const DEFAULT_HERO = {
    title: 'Mașini verificate, pentru drumuri perfecte',
    subtitle: 'Parc auto la intrarea în Botoșani dinspre Suceava. Mașini controlate, finanțare în rate prin TBI Bank și transparență totală la fiecare pas.',
};

export const DEFAULT_SERVICES = [
    {
        title: 'Rate prin TBI Bank',
        text: 'Partener oficial TBI Bank. Îți finanțăm mașina în rate, cu acte rapide și condiții clare, direct la noi în parc.',
    },
    {
        title: 'Mașini la comandă',
        text: 'Nu găsești ce cauți? Îți aducem mașina dorită la comandă, verificată și pe placul tău, din surse de încredere.',
    },
    {
        title: 'Verificate, cu încredere',
        text: 'Fiecare mașină din parc e verificată tehnic înainte de vânzare. Fără surprize, fără istoric ascuns.',
    },
];

// ── JSON-LD AutoDealer ───────────────────────────────────────────────────────
//  Semnalul care spune Google că acesta e un dealer auto local, cu adresă,
//  program și zonă deservită. Esențial pentru „parc auto Botoșani".
const autoDealerLd = (site) => {
    const domain = site.domain || 'vanzariautopark.ro';
    const DAY = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const schedule = Array.isArray(site.schedule) ? site.schedule : [];
    const hours = schedule.filter((d) => !d.closed).map((d) => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: `https://schema.org/${DAY[d.day]}`,
        opens: d.open, closes: d.close,
    }));

    const obj = {
        '@context': 'https://schema.org',
        '@type': 'AutoDealer',
        name: site.display_name,
        url: `https://${domain}/`,
        image: `https://${domain}/assets/logo.png`,
        telephone: '+' + String(site.phone_primary || '').replace(/\D/g, ''),
        email: site.email || undefined,
        address: {
            '@type': 'PostalAddress',
            streetAddress: site.address || 'Intrare Botoșani dinspre Suceava',
            addressLocality: site.city || 'Botoșani',
            addressRegion: site.county || 'Botoșani',
            addressCountry: 'RO',
        },
        geo: (site.lat && site.lng) ? {
            '@type': 'GeoCoordinates', latitude: site.lat, longitude: site.lng,
        } : { '@type': 'GeoCoordinates', latitude: 47.7358, longitude: 26.6345 },
        areaServed: ['Botoșani', 'Suceava'],
        openingHoursSpecification: hours.length ? hours : undefined,
        sameAs: [site.facebook_url, site.instagram_url, site.tiktok_url].filter(Boolean),
    };
    // curăț câmpurile goale
    Object.keys(obj).forEach((k) => obj[k] === undefined && delete obj[k]);
    return JSON.stringify(obj).replace(/</g, '\\u003c');
};

export default { renderHome, DEFAULT_HERO, DEFAULT_SERVICES };
