// ============================================================================
//  src/site/pages/masina.js — pagina unei mașini
// ----------------------------------------------------------------------------
//  Galerie + specificații complete + descriere + JSON-LD.
//
//  ── GALERIA (piesa critică) ────────────────────────────────────────────────
//  Lightbox-ul e o pistă cu scroll-snap, cu toate pozele în DOM. Navigarea o
//  face BROWSERUL prin derulare nativă. ZERO handlere de touch → e imposibil
//  să existe conflict între swipe și pinch-to-zoom.
//
//  Asta e lecția din sistemul vechi: acolo, la început, handlere proprii de
//  touch se băteau cu pinch-ul — începeai să dai zoom și sărea la altă poză.
//  Cu scroll-snap nativ, swipe-ul e derulare, zoom-ul e cel al browserului,
//  nu se ating.
// ============================================================================

import { html, raw } from '../html.js';
import { icon } from '../icons.js';
import { Layout } from '../layout.js';
import { Header, Footer, StickyWhatsApp, waLink } from '../components.js';
import { labelOf } from '../../data/carOptions.js';
import { REGISTRATION_STATUS, STEERING } from '../../data/carOptions.js';
import { formatPhoneDisplay, telHref } from '../../lib/carUtils.js';

const fmt = (n) => new Intl.NumberFormat('de-DE').format(n);
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const mediaUrl = (carId, m) => `/media/cars/${m.dir || carId}/${m.id}.${m.ext || 'jpg'}`;

export const renderMasina = (site, car) => {
    const media = Array.isArray(car.media) ? car.media : [];
    const hasImg = media.length > 0;
    const isSold = car.status === 'sold';

    const waText = `Bună ziua! Sunt interesat de ${car.title} (${fmt(car.price)} €) de pe site. Mai este disponibilă?`;

    // ── Galeria ──────────────────────────────────────────────────────────
    const gallery = html`
<div class="gallery">
  <div class="gal-main" id="gal-main">
    ${hasImg ? html`
      <img id="gal-current" src="${mediaUrl(car.id, media[0])}" alt="${car.title}"
           width="${media[0].w || 800}" height="${media[0].h || 600}"
           fetchpriority="high" data-index="0">
      ${media.length > 1 ? html`
        <button class="gal-nav gal-prev" id="gal-prev" aria-label="Poza anterioară">${raw(icon('arrow', 20))}</button>
        <button class="gal-nav gal-next" id="gal-next" aria-label="Poza următoare">${raw(icon('arrow', 20))}</button>
        <span class="gal-counter"><span id="gal-num">1</span> / ${media.length}</span>
      ` : ''}
    ` : html`<div class="gal-noimg">${raw(icon('road', 56))}</div>`}
    ${isSold ? html`<span class="gal-badge">Vândut</span>` : ''}
  </div>

  ${media.length > 1 ? html`
  <div class="gal-thumbs" id="gal-thumbs">
    ${media.map((m, i) => html`
    <button class="gal-thumb${i === 0 ? raw(' is-active') : ''}" data-index="${i}" aria-label="Poza ${i + 1}">
      <img src="${mediaUrl(car.id, m)}" alt="" width="72" height="54" loading="lazy">
    </button>`)}
  </div>` : ''}
</div>

${hasImg ? html`
<!-- Lightbox: pistă cu scroll-snap, fără handlere de touch -->
<div class="lightbox" id="lightbox" aria-hidden="true">
  <div class="lb-track" id="lb-track">
    ${media.map((m) => html`
    <div class="lb-slide"><img src="${mediaUrl(car.id, m)}" alt="${car.title}" loading="lazy"></div>`)}
  </div>
  <button class="lb-close" id="lb-close" aria-label="Închide">${raw(icon('close', 22))}</button>
  ${media.length > 1 ? html`
    <button class="lb-nav lb-prev" id="lb-prev" aria-label="Anterioara">${raw(icon('arrow', 22))}</button>
    <button class="lb-nav lb-next" id="lb-next" aria-label="Următoarea">${raw(icon('arrow', 22))}</button>
    <span class="lb-counter"><span id="lb-num">1</span> / ${media.length}</span>
  ` : ''}
</div>` : ''}`;

    // ── Specificațiile ───────────────────────────────────────────────────
    const specs = [
        ['calendar', 'An fabricație', car.production_year],
        ['gauge', 'Kilometraj', `${fmt(car.mileage)} km`],
        ['fuel', 'Combustibil', cap(car.fuel)],
        ['road', 'Capacitate', car.engine_capacity],
        car.horsepower ? ['gauge', 'Putere', `${car.horsepower} CP`] : null,
        ['transmission', 'Cutie de viteze', cap(car.transmission)],
        ['road', 'Tracțiune', car.drivetrain],
        ['tag', 'Caroserie', cap(car.body_type)],
        ['palette', 'Culoare', cap(car.color)],
        ['shield', 'Normă poluare', car.pollution_standard],
        ['steering', 'Volan', labelOf(car.steering_wheel, STEERING)],
        ['check', 'Înmatriculare', labelOf(car.registration_status, REGISTRATION_STATUS)],
        car.vin ? ['tag', 'Serie șasiu (VIN)', car.vin] : null,
    ].filter(Boolean);

    // ── JSON-LD pentru Google ────────────────────────────────────────────
    const ld = buildVehicleLd(site, car, media);

    const body = html`
${Header(site, 'stoc')}

<main class="wrap car-page">

  <nav class="car-breadcrumb" aria-label="Cale">
    <a href="/">Acasă</a><span class="sep">/</span>
    <a href="/stoc">Stoc</a><span class="sep">/</span>
    <span>${car.title}</span>
  </nav>

  <div class="car-layout">

    <div>${gallery}</div>

    <div class="car-info">
      <div class="car-info-head">
        <h1>${car.title}</h1>
        <div class="car-info-price">
          <span class="price">${fmt(car.price)} €</span>
          <span class="neg">${car.negotiable ? 'Negociabil' : 'Preț fix'}</span>
        </div>
      </div>

      <div class="car-actions">
        <a class="btn btn--primary" href="${waLink(site.whatsapp, waText)}" target="_blank" rel="noopener">
          ${raw(icon('whatsapp', 18))} Scrie pe WhatsApp
        </a>
        <a class="btn btn-call" href="tel:${telHref(car.phone || site.phone_primary)}">
          ${raw(icon('phone', 18))} ${formatPhoneDisplay(car.phone || site.phone_primary)}
        </a>
      </div>

      ${car.for_dismantling ? html`
      <div class="spec-badges">
        <span class="spec-badge warn">${raw(icon('shield', 16))} Pentru dezmembrare</span>
      </div>` : ''}

      <div class="spec-table">
        ${specs.map(([ic, k, v]) => html`
        <div class="spec-row">
          <span class="k">${raw(icon(ic, 16))} ${k}</span>
          <span class="v">${v}</span>
        </div>`)}
      </div>
    </div>

  </div>

  ${car.description ? html`
  <div class="car-desc">
    <h2>Descriere</h2>
    <p>${car.description}</p>
  </div>` : ''}

</main>

${Footer(site)}
${StickyWhatsApp(site)}

${hasImg && media.length >= 1 ? html`<script>${raw(GALLERY_SCRIPT)}</script>` : ''}`;

    return Layout({
        site,
        title: car.title,
        description: `${car.title}, ${car.production_year}, ${fmt(car.mileage)} km, ${fmt(car.price)} € la ${site.display_name}, Botoșani. ${cap(car.fuel)}, ${car.engine_capacity}.`.slice(0, 160),
        canonical: `https://${site.domain}/masina/${car.slug}`,
        ogImage: hasImg ? `https://${site.domain}${mediaUrl(car.id, media[0])}` : undefined,
        current: 'stoc',
        head: raw(`<script type="application/ld+json">${ld}</script>`),
        body,
    });
};

// ── JSON-LD Vehicle + Offer ──────────────────────────────────────────────────
const buildVehicleLd = (site, car, media) => {
    const obj = {
        '@context': 'https://schema.org',
        '@type': 'Car',
        name: car.title,
        brand: { '@type': 'Brand', name: car.brand },
        vehicleModelDate: String(car.production_year),
        mileageFromOdometer: { '@type': 'QuantitativeValue', value: car.mileage, unitCode: 'KMT' },
        fuelType: car.fuel,
        vehicleTransmission: car.transmission,
        color: car.color,
        ...(car.vin ? { vehicleIdentificationNumber: car.vin } : {}),
        offers: {
            '@type': 'Offer',
            price: car.price,
            priceCurrency: 'EUR',
            availability: car.status === 'sold'
                ? 'https://schema.org/SoldOut'
                : 'https://schema.org/InStock',
            seller: { '@type': 'AutoDealer', name: site.display_name },
        },
    };
    if (media.length) {
        obj.image = media.map((m) => `https://${site.domain}${mediaUrl(car.id, m)}`);
    }
    // escapăm < ca un </script> din descriere să nu închidă tag-ul devreme
    return JSON.stringify(obj).replace(/</g, '\\u003c');
};

// ── Scriptul galeriei ────────────────────────────────────────────────────────
//  Poza mare: săgeți + thumbnail-uri schimbă imaginea afișată.
//  Click pe poza mare → deschide lightbox-ul la poza curentă.
//  Lightbox: derulare nativă cu scroll-snap. Zero touch handlers.
const GALLERY_SCRIPT = `
(function(){
  var main = document.getElementById('gal-current');
  if (!main) return;
  var thumbs = document.querySelectorAll('#gal-thumbs .gal-thumb');
  var slides = [];
  thumbs.forEach(function(t){ slides.push(t.querySelector('img').src); });
  if (slides.length === 0) slides.push(main.src);
  var idx = 0;

  var numEl = document.getElementById('gal-num');
  function setMain(i){
    idx = (i + slides.length) % slides.length;
    main.src = slides[idx];
    main.dataset.index = idx;
    if (numEl) numEl.textContent = idx + 1;
    thumbs.forEach(function(t, n){ t.classList.toggle('is-active', n === idx); });
  }

  var prev = document.getElementById('gal-prev');
  var next = document.getElementById('gal-next');
  if (prev) prev.addEventListener('click', function(e){ e.stopPropagation(); setMain(idx - 1); });
  if (next) next.addEventListener('click', function(e){ e.stopPropagation(); setMain(idx + 1); });
  thumbs.forEach(function(t){
    t.addEventListener('click', function(){ setMain(parseInt(t.dataset.index, 10)); });
  });

  // ── Lightbox ──
  var lb = document.getElementById('lightbox');
  var track = document.getElementById('lb-track');
  if (!lb || !track) return;
  var lbSlides = track.children;
  var lbNum = document.getElementById('lb-num');

  function goTo(i, smooth){
    var s = lbSlides[Math.max(0, Math.min(lbSlides.length - 1, i))];
    if (s) track.scrollTo({ left: s.offsetLeft, behavior: smooth ? 'smooth' : 'auto' });
  }
  function current(){ return Math.round(track.scrollLeft / Math.max(1, track.clientWidth)); }
  function updateNum(){ if (lbNum) lbNum.textContent = current() + 1; }

  function open(i){
    lb.classList.add('is-open');
    lb.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function(){ goTo(i, false); updateNum(); });
  }
  function close(){
    lb.classList.remove('is-open');
    lb.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  main.addEventListener('click', function(){ open(idx); });

  var lbClose = document.getElementById('lb-close');
  var lbPrev = document.getElementById('lb-prev');
  var lbNext = document.getElementById('lb-next');
  if (lbClose) lbClose.addEventListener('click', close);
  if (lbPrev) lbPrev.addEventListener('click', function(){ goTo(current() - 1, true); });
  if (lbNext) lbNext.addEventListener('click', function(){ goTo(current() + 1, true); });

  var st = null;
  track.addEventListener('scroll', function(){
    if (st) clearTimeout(st);
    st = setTimeout(updateNum, 80);
  }, { passive: true });

  lb.addEventListener('click', function(e){ if (e.target === lb || e.target === track) close(); });
  document.addEventListener('keydown', function(e){
    if (!lb.classList.contains('is-open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') goTo(current() - 1, true);
    if (e.key === 'ArrowRight') goTo(current() + 1, true);
  });
})();`;

export default { renderMasina };
