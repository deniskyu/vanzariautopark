// ============================================================================
//  src/site/pages/contact.js — pagina de contact
// ----------------------------------------------------------------------------
//  Date de contact, program (cu ziua curentă evidențiată), hartă Google
//  încorporată, și galeria parcului (cele 8 poze g1-g8 din assets).
//
//  Ziua curentă se calculează în funcție de timezone-ul României, nu de
//  timezone-ul serverului Cloudflare (care e UTC). Fără asta, seara târziu
//  s-ar evidenția ziua greșită.
// ============================================================================

import { html, raw } from '../html.js';
import { icon } from '../icons.js';
import { Layout } from '../layout.js';
import { Header, Footer, StickyWhatsApp, waLink, DEFAULT_SCHEDULE } from '../components.js';
import { formatPhoneDisplay, telHref } from '../../lib/carUtils.js';

const DAYS = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];

// Ziua curentă în timezone România (UTC+2/+3). Aproximăm cu offset +2/+3 în
// funcție de lună (DST: ultima duminică din martie – ultima din octombrie).
// Pentru evidențierea zilei e suficient de precis.
const romaniaDay = () => {
    const now = new Date();
    const month = now.getUTCMonth(); // 0-11
    // aproximare DST: aprilie-septembrie sigur +3, restul +2; martie/oct la limită
    const offset = (month > 2 && month < 9) ? 3 : 2;
    const ro = new Date(now.getTime() + offset * 3600 * 1000);
    return ro.getUTCDay(); // 0=duminică
};

// Cele 8 poze ale parcului din assets.
const GALLERY = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8']
    .map((n) => `/assets/${n}.jpeg`);

export const renderContact = (site) => {
    const schedule = Array.isArray(site.schedule) && site.schedule.length
        ? site.schedule : DEFAULT_SCHEDULE;
    const today = romaniaDay();

    // Coordonatele parcului (din specificație). Le ținem în settings dacă
    // există, altfel folosim valorile din specificație.
    const lat = site.lat || 47.7358;
    const lng = site.lng || 26.6345;
    const mapSrc = `https://www.google.com/maps?q=${lat},${lng}&z=17&output=embed`;

    const body = html`
${Header(site, 'contact')}

<main class="section">
  <div class="wrap">

    <div class="section-head">
      <p class="eyebrow">Contact</p>
      <h1>Vino să ne vizitezi</h1>
      <p class="lead">${site.contact_intro || DEFAULT_CONTACT_INTRO}</p>
    </div>

    <div class="contact-layout">

      <!-- Coloana stângă: date + program -->
      <div>
        <div class="contact-card">
          <div class="contact-item">
            <span class="contact-item-icon">${raw(icon('pin', 20))}</span>
            <div class="contact-item-body">
              <div class="contact-item-label">Adresă</div>
              <div class="contact-item-value">${site.address || 'Intrare Botoșani dinspre Suceava, după sensul giratoriu de la Dedeman'}</div>
              <div class="contact-item-sub">${site.city || 'Botoșani'}${site.county ? `, ${site.county}` : ''}</div>
            </div>
          </div>

          <div class="contact-item">
            <span class="contact-item-icon">${raw(icon('phone', 20))}</span>
            <div class="contact-item-body">
              <div class="contact-item-label">Telefon</div>
              <div class="contact-item-value">
                <a href="tel:${telHref(site.phone_primary)}">${formatPhoneDisplay(site.phone_primary)}</a>
                ${site.phone_primary_label ? html`<span class="contact-item-sub"> · ${site.phone_primary_label}</span>` : ''}
              </div>
              ${site.phone_secondary ? html`
              <div class="contact-item-value" style="margin-top:.3rem">
                <a href="tel:${telHref(site.phone_secondary)}">${formatPhoneDisplay(site.phone_secondary)}</a>
                ${site.phone_secondary_label ? html`<span class="contact-item-sub"> · ${site.phone_secondary_label}</span>` : ''}
              </div>` : ''}
            </div>
          </div>

          <div class="contact-item">
            <span class="contact-item-icon">${raw(icon('whatsapp', 20))}</span>
            <div class="contact-item-body">
              <div class="contact-item-label">WhatsApp</div>
              <div class="contact-item-value">
                <a href="${waLink(site.whatsapp)}" target="_blank" rel="noopener">Scrie-ne direct</a>
              </div>
            </div>
          </div>

          ${site.email ? html`
          <div class="contact-item">
            <span class="contact-item-icon">${raw(icon('mail', 20))}</span>
            <div class="contact-item-body">
              <div class="contact-item-label">Email</div>
              <div class="contact-item-value"><a href="mailto:${site.email}">${site.email}</a></div>
            </div>
          </div>` : ''}
        </div>

        <div class="contact-card" style="margin-top:1.2rem">
          <h3 style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem">
            ${raw(icon('clock', 18))} Program
          </h3>
          <div class="hours-table">
            ${schedule.map((d) => html`
            <div class="hours-row${d.closed ? raw(' is-closed') : ''}${d.day === today ? raw(' is-today') : ''}">
              <span class="day">${DAYS[d.day]}${d.day === today ? ' (azi)' : ''}</span>
              <span class="time">${d.closed ? 'Închis' : `${d.open} – ${d.close}`}</span>
            </div>`)}
          </div>
        </div>
      </div>

      <!-- Coloana dreaptă: hartă -->
      <div>
        <div class="map-wrap">
          <iframe src="${mapSrc}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"
                  title="Harta către ${site.display_name}" allowfullscreen></iframe>
        </div>
        <a class="btn btn--primary" style="width:100%;margin-top:1rem"
           href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" rel="noopener">
          ${raw(icon('pin', 18))} Deschide în Google Maps
        </a>
      </div>

    </div>

    <!-- Galeria parcului -->
    <div class="contact-gallery">
      <div class="section-head" style="text-align:center">
        <p class="eyebrow">Galerie</p>
        <h2>Parcul nostru</h2>
      </div>
      <div class="cg-grid" id="cg-grid">
        ${GALLERY.map((src, i) => html`
        <div class="cg-item" data-index="${i}">
          <img src="${src}" alt="Vanzari Auto Park — foto ${i + 1}" width="400" height="300"
               loading="lazy" decoding="async">
        </div>`)}
      </div>
    </div>

  </div>
</main>

<!-- Lightbox pentru galeria parcului -->
<div class="lightbox" id="lightbox" aria-hidden="true">
  <div class="lb-track" id="lb-track">
    ${GALLERY.map((src) => html`<div class="lb-slide"><img src="${src}" alt="" loading="lazy"></div>`)}
  </div>
  <button class="lb-close" id="lb-close" aria-label="Închide">${raw(icon('close', 22))}</button>
  <button class="lb-nav lb-prev" id="lb-prev" aria-label="Anterioara">${raw(icon('arrow', 22))}</button>
  <button class="lb-nav lb-next" id="lb-next" aria-label="Următoarea">${raw(icon('arrow', 22))}</button>
  <span class="lb-counter"><span id="lb-num">1</span> / ${GALLERY.length}</span>
</div>

${Footer(site)}
${StickyWhatsApp(site)}

<script>${raw(CONTACT_GALLERY_SCRIPT)}</script>`;

    return Layout({
        site,
        title: 'Contact',
        description: `Vizitează ${site.display_name} la intrarea în Botoșani dinspre Suceava, după sensul de la Dedeman. Telefon, program și hartă.`,
        canonical: `https://${site.domain}/contact`,
        current: 'contact',
        body,
    });
};

// Același mecanism de lightbox ca la pagina mașinii — scroll-snap, zero touch.
const CONTACT_GALLERY_SCRIPT = `
(function(){
  var lb = document.getElementById('lightbox');
  var track = document.getElementById('lb-track');
  if (!lb || !track) return;
  var slides = track.children;
  var lbNum = document.getElementById('lb-num');

  function goTo(i, smooth){
    var s = slides[Math.max(0, Math.min(slides.length - 1, i))];
    if (s) track.scrollTo({ left: s.offsetLeft, behavior: smooth ? 'smooth' : 'auto' });
  }
  function current(){ return Math.round(track.scrollLeft / Math.max(1, track.clientWidth)); }
  function updateNum(){ if (lbNum) lbNum.textContent = current() + 1; }
  function open(i){
    lb.classList.add('is-open'); lb.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function(){ goTo(i, false); updateNum(); });
  }
  function close(){
    lb.classList.remove('is-open'); lb.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('#cg-grid .cg-item').forEach(function(it){
    it.addEventListener('click', function(){ open(parseInt(it.dataset.index, 10)); });
  });
  var c = document.getElementById('lb-close'); if (c) c.addEventListener('click', close);
  var p = document.getElementById('lb-prev'); if (p) p.addEventListener('click', function(){ goTo(current()-1, true); });
  var n = document.getElementById('lb-next'); if (n) n.addEventListener('click', function(){ goTo(current()+1, true); });

  var st = null;
  track.addEventListener('scroll', function(){ if (st) clearTimeout(st); st = setTimeout(updateNum, 80); }, { passive:true });
  lb.addEventListener('click', function(e){ if (e.target === lb || e.target === track) close(); });
  document.addEventListener('keydown', function(e){
    if (!lb.classList.contains('is-open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') goTo(current()-1, true);
    if (e.key === 'ArrowRight') goTo(current()+1, true);
  });
})();`;

export const DEFAULT_CONTACT_INTRO =
    'Ne găsești la intrarea în Botoșani dinspre Suceava, imediat după sensul giratoriu de la Dedeman. Vino să vezi mașinile pe viu sau sună-ne pentru orice întrebare.';

export default { renderContact, DEFAULT_CONTACT_INTRO };
