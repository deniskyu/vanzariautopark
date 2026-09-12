// ============================================================================
//  src/site/styles.js — foaia de stil a site-ului public
// ----------------------------------------------------------------------------
//  Servită ca un singur fișier CSS cacheabil (vezi ruta din Batch 5).
//  Versiunea e în nume: o modificare produce un URL nou, fără invalidări.
//
//  ── IDENTITATE VIZUALĂ ────────────────────────────────────────────────────
//  Negru/grafit cu accent galben #E5FB14, din logo. Galbenul e AGRESIV și
//  luminos — funcționează DOAR ca suprafață (cu text negru pe el) sau ca text
//  pe fundal închis. NU poate fi text pe alb (contrast 1.16 — invizibil).
//  De aceea site-ul e întunecat: se potrivește cu logo-ul și pune galbenul în
//  valoare, exact cum e în identitatea parcului.
//
//  ── PRINCIPII ─────────────────────────────────────────────────────────────
//  Mobile-first (toate @media sunt min-width). Tipografie fluidă cu clamp().
//  Zero layout shift (width/height pe imagini + aspect-ratio).
//  prefers-reduced-motion dezactivează tot, la final.
// ============================================================================

export const CSS_VERSION = 'v1';

export const SITE_CSS = `
:root{
  /* Paletă */
  --bg:#0a0a0a;
  --surface:#141414;
  --surface-2:#1c1c1c;
  --border:#262626;
  --border-strong:#333;
  --text:#f5f5f5;
  --muted:#a1a1aa;
  --muted-2:#71717a;

  --accent:#E5FB14;          /* galbenul din logo */
  --accent-dark:#c4d800;     /* pentru hover pe suprafețe galbene */
  --on-accent:#0a0a0a;       /* text pe galben: negru */

  --tbi:#ff6a00;             /* portocaliul benzii TBI */
  --on-tbi:#0a0a0a;          /* text pe portocaliu: negru (albul era prea slab) */

  --ok:#4ade80;
  --danger:#f87171;

  /* Formă */
  --radius:16px;
  --radius-sm:10px;
  --radius-lg:22px;
  --shadow:0 1px 2px rgba(0,0,0,.4), 0 12px 32px rgba(0,0,0,.35);
  --shadow-accent:0 8px 30px rgba(229,251,20,.14);

  /* Tipografie */
  --font:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  --font-display:var(--font);

  /* Animații */
  --t-fast:150ms;
  --t-base:260ms;
  --ease:cubic-bezier(.22,.61,.36,1);
}

*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body,h1,h2,h3,h4,p,figure,dl,dd,ul,ol{margin:0}
ul[class]{list-style:none;padding:0}
img,picture,video{display:block;max-width:100%}
/* SVG NU e block — altfel iconițele inline sar pe rândul de deasupra textului */
svg{display:inline-block;vertical-align:middle;flex-shrink:0}
input,button,textarea,select{font:inherit;color:inherit}
button{cursor:pointer;background:none;border:none;padding:0}
a{color:inherit;text-decoration:none}

body{
  background:var(--bg);
  color:var(--text);
  font-family:var(--font);
  font-size:16px;
  line-height:1.6;
  -webkit-font-smoothing:antialiased;
  overflow-x:hidden;
}

/* Titlurile care conțin o iconiță devin rând flex */
h1:has(>svg),h2:has(>svg),h3:has(>svg),h4:has(>svg){
  display:flex;align-items:center;gap:.5rem;
}

h1,h2,h3,.display{
  font-family:var(--font-display);
  font-weight:800;
  line-height:1.1;
  letter-spacing:-.02em;
}
h1{font-size:clamp(1.9rem,1.2rem + 3.2vw,3.6rem)}
h2{font-size:clamp(1.5rem,1.05rem + 1.9vw,2.4rem)}
h3{font-size:clamp(1.15rem,1rem + .6vw,1.45rem)}

/* ── Layout ────────────────────────────────────────────────────────────── */
.wrap{width:min(1200px,100% - 2rem);margin-inline:auto}
@media(min-width:768px){.wrap{width:min(1200px,100% - 3rem)}}
.section{padding-block:clamp(2.6rem,1.6rem + 4vw,5rem)}
.section--tight{padding-block:clamp(1.8rem,1.2rem + 2.4vw,3.2rem)}
.sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;
  clip:rect(0 0 0 0);white-space:nowrap;border:0}

.eyebrow{
  font-size:.78rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;
  color:var(--accent);margin-bottom:.6rem;
}
.lead{color:var(--muted);font-size:clamp(1rem,.95rem + .25vw,1.15rem);max-width:62ch}
.section-head{margin-bottom:clamp(1.4rem,1rem + 1.4vw,2.4rem)}

/* ── Butoane ───────────────────────────────────────────────────────────── */
.btn{
  display:inline-flex;align-items:center;justify-content:center;gap:.55rem;
  padding:.9rem 1.6rem;border-radius:999px;
  font-weight:700;font-size:.98rem;letter-spacing:.01em;text-align:center;
  border:2px solid transparent;min-height:48px;
  transition:transform var(--t-fast) var(--ease),background var(--t-fast) var(--ease),
             border-color var(--t-fast) var(--ease),box-shadow var(--t-fast) var(--ease);
}
.btn:active{transform:scale(.97)}
/* Butonul principal: galben cu text negru. Semnătura vizuală a site-ului. */
.btn--primary{background:var(--accent);color:var(--on-accent);box-shadow:var(--shadow-accent)}
.btn--primary:hover{background:var(--accent-dark);transform:translateY(-2px)}
.btn--ghost{border-color:var(--border-strong);color:var(--text)}
.btn--ghost:hover{border-color:var(--accent);color:var(--accent)}
.btn--on-dark{background:#fff;color:#0a0a0a}
.btn--wide{width:100%}
@media(min-width:560px){.btn--wide{width:auto}}

/* ── Header ────────────────────────────────────────────────────────────── */
.site-header{
  position:sticky;top:0;z-index:50;
  background:rgba(10,10,10,.9);
  border-bottom:1px solid var(--border);
  backdrop-filter:saturate(160%) blur(12px);
}
.header-inner{display:flex;align-items:center;gap:1rem;min-height:68px}
.brand{display:flex;align-items:center;gap:.7rem;flex:1;min-width:0}
.brand-logo{height:44px;width:auto;flex-shrink:0}
.brand-name{font-family:var(--font-display);font-weight:800;font-size:1.05rem;
  line-height:1.1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

.nav{display:none}
@media(min-width:900px){
  .nav{display:flex;gap:.35rem;align-items:center}
  .nav a{padding:.55rem .95rem;border-radius:var(--radius-sm);font-size:.95rem;
    font-weight:600;position:relative;transition:color var(--t-fast) var(--ease)}
  .nav a::after{content:'';position:absolute;left:.95rem;right:.95rem;bottom:.35rem;
    height:2px;background:var(--accent);transform:scaleX(0);transform-origin:left;
    transition:transform var(--t-base) var(--ease)}
  .nav a:hover::after,.nav a[aria-current]::after{transform:scaleX(1)}
  .nav a[aria-current]{color:var(--accent)}
}
.header-cta{display:flex;align-items:center;gap:.5rem;flex-shrink:0}
.header-phone{
  display:inline-flex;align-items:center;gap:.5rem;
  padding:.6rem 1rem;border-radius:999px;
  background:var(--accent);color:var(--on-accent);
  font-weight:800;font-size:.9rem;min-height:44px;
}
.header-phone span{display:none}
@media(min-width:560px){.header-phone span{display:inline}}

/* Meniu mobil fără JavaScript: checkbox + selector de vecin */
.nav-toggle{display:none}
.nav-btn{display:inline-flex;align-items:center;justify-content:center;
  width:44px;height:44px;border-radius:var(--radius-sm);
  border:1px solid var(--border-strong);color:var(--text)}
@media(min-width:900px){.nav-btn{display:none}}
.nav-mobile{display:none;padding:.5rem 0 1rem;border-top:1px solid var(--border)}
.nav-toggle:checked ~ .nav-mobile{display:block}
.nav-mobile a{display:block;padding:.9rem .25rem;font-weight:600;
  border-bottom:1px solid var(--border)}
.nav-mobile a:last-child{border-bottom:none}
@media(min-width:900px){.nav-mobile{display:none!important}}

/* ── Card de mașină ────────────────────────────────────────────────────── */
.car-grid{display:grid;gap:clamp(.9rem,.7rem + .8vw,1.4rem);grid-template-columns:1fr}
@media(min-width:560px){.car-grid{grid-template-columns:repeat(2,1fr)}}
@media(min-width:960px){.car-grid{grid-template-columns:repeat(3,1fr)}}

.car{
  display:flex;flex-direction:column;height:100%;
  background:var(--surface);border:1px solid var(--border);
  border-radius:var(--radius);overflow:hidden;
  transition:transform var(--t-base) var(--ease),border-color var(--t-base) var(--ease),
             box-shadow var(--t-base) var(--ease);
}
.car:hover{transform:translateY(-4px);border-color:var(--accent);box-shadow:var(--shadow)}
.car-media{position:relative;display:block;aspect-ratio:4/3;background:var(--surface-2);overflow:hidden}
.car-media img{width:100%;height:100%;object-fit:cover;transition:transform var(--t-base) var(--ease)}
.car:hover .car-media img{transform:scale(1.05)}
.car-noimg{width:100%;height:100%;display:flex;align-items:center;justify-content:center;
  color:var(--muted-2);background:linear-gradient(135deg,var(--surface-2),var(--surface))}
/* Prețul: galben, suprapus pe poză, jos-stânga */
.car-price{
  position:absolute;left:.7rem;bottom:.7rem;z-index:1;
  padding:.4rem .8rem;border-radius:var(--radius-sm);
  background:var(--accent);color:var(--on-accent);
  font-weight:800;font-size:1.05rem;letter-spacing:-.01em;
}
.car-badge{position:absolute;right:.7rem;top:.7rem;z-index:1;
  padding:.3rem .6rem;border-radius:999px;font-size:.7rem;font-weight:700;
  background:rgba(0,0,0,.72);color:#fff;backdrop-filter:blur(4px)}
.car-badge--sold{background:var(--danger);color:#fff}
.car-body{padding:.95rem 1rem 1.05rem;display:flex;flex-direction:column;gap:.55rem;flex:1}
.car-title{font-size:1.02rem;font-weight:700;line-height:1.3;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.car-specs{display:flex;flex-wrap:wrap;gap:.3rem .5rem;color:var(--muted);font-size:.84rem}
.car-specs li{display:flex;align-items:center;gap:.3rem}
.car-specs li+li::before{content:'';width:3px;height:3px;border-radius:50%;
  background:currentColor;opacity:.5;margin-right:.2rem}
.car-foot{margin-top:auto;padding-top:.3rem}
.car-wa{
  display:flex;align-items:center;justify-content:center;gap:.5rem;width:100%;
  padding:.7rem;border-radius:var(--radius-sm);min-height:44px;
  border:2px solid var(--accent);color:var(--accent);font-weight:700;font-size:.88rem;
  transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease);
}
.car-wa:hover{background:var(--accent);color:var(--on-accent)}

/* ── Servicii ──────────────────────────────────────────────────────────── */
.svc-grid{display:grid;gap:clamp(.9rem,.7rem + .8vw,1.4rem);grid-template-columns:1fr}
@media(min-width:700px){.svc-grid{grid-template-columns:repeat(3,1fr)}}
.svc{
  padding:clamp(1.3rem,1rem + .9vw,1.9rem);
  background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
  transition:border-color var(--t-base) var(--ease),transform var(--t-base) var(--ease);
}
.svc:hover{border-color:var(--accent);transform:translateY(-3px)}
.svc-icon{
  display:inline-flex;align-items:center;justify-content:center;
  width:52px;height:52px;aspect-ratio:1;flex-shrink:0;
  border-radius:var(--radius-sm);
  background:var(--accent);color:var(--on-accent);margin-bottom:1rem;
}
.svc-icon svg{flex-shrink:0}
.svc h3{margin-bottom:.5rem}
.svc p{color:var(--muted);font-size:.95rem}

/* ── Banda TBI (deasupra serviciilor) ──────────────────────────────────── */
.tbi-strip{background:var(--tbi);color:var(--on-tbi)}
.tbi-strip-in{
  display:flex;align-items:center;justify-content:center;gap:.7rem;flex-wrap:wrap;
  padding-block:.65rem;text-align:center;
}
.tbi-strip img{height:22px;width:auto}
.tbi-strip span{font-weight:800;font-size:.9rem;letter-spacing:.01em}

/* ── Bannerul TBI mare (după servicii) ─────────────────────────────────── */
.tbi-banner{display:flex;justify-content:center;padding-block:clamp(1.5rem,1rem + 2vw,2.8rem)}
.tbi-banner img{
  width:90%;max-width:1100px;height:auto;
  border-radius:var(--radius-lg);
  box-shadow:var(--shadow);
}

/* ── Bandă de contact (CTA) ────────────────────────────────────────────── */
.cta-band{background:var(--accent);color:var(--on-accent);
  padding-block:clamp(2.2rem,1.6rem + 2.4vw,3.6rem)}
.cta-band h2{color:var(--on-accent)}
.cta-band p{opacity:.82;margin-top:.55rem}
.cta-inner{display:flex;flex-direction:column;gap:1.4rem;align-items:flex-start}
@media(min-width:820px){.cta-inner{flex-direction:row;align-items:center;justify-content:space-between}}
.cta-actions{display:flex;flex-wrap:wrap;gap:.7rem}
.cta-phone{display:inline-flex;align-items:center;gap:.5rem;font-weight:800;font-size:1.1rem;
  padding:.85rem 1.5rem;border-radius:999px;min-height:48px;
  background:rgba(0,0,0,.14);border:2px solid rgba(0,0,0,.25)}

/* ── Footer ────────────────────────────────────────────────────────────── */
.site-footer{background:#000;color:var(--muted);
  padding-block:clamp(2.4rem,1.8rem + 2.4vw,3.6rem);border-top:1px solid var(--border)}
.footer-grid{display:grid;gap:2rem;grid-template-columns:1fr}
@media(min-width:700px){.footer-grid{grid-template-columns:1.4fr 1fr 1fr}}
.footer-brand{display:flex;align-items:center;gap:.75rem;margin-bottom:.9rem}
.footer-brand img{height:46px;width:auto}
.site-footer h4{font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;
  color:var(--muted-2);margin-bottom:.85rem;font-weight:800}
.footer-list li{margin-bottom:.55rem;font-size:.93rem}
.footer-list a{transition:color var(--t-fast) var(--ease)}
.footer-list a:hover{color:var(--accent)}
.footer-hours{display:flex;justify-content:space-between;gap:1rem;
  font-size:.88rem;margin-bottom:.4rem}
.footer-hours.is-closed{opacity:.5}
.footer-social{display:flex;gap:.5rem;margin-top:1rem}
.footer-social a{display:inline-flex;align-items:center;justify-content:center;
  width:40px;height:40px;border-radius:50%;border:1px solid var(--border-strong);
  transition:border-color var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}
.footer-social a:hover{border-color:var(--accent);color:var(--accent)}
.footer-legal{margin-top:2.2rem;padding-top:1.4rem;border-top:1px solid var(--border);
  display:flex;flex-direction:column;gap:.8rem}
.footer-firm{font-size:.76rem;color:var(--muted-2);line-height:1.7}
.footer-links{display:flex;flex-wrap:wrap;gap:.4rem 1rem;font-size:.8rem}
.footer-links a:hover{color:var(--accent)}

/* ── Sticky WhatsApp ───────────────────────────────────────────────────── */
.sticky-wa{
  position:fixed;z-index:60;right:1rem;
  bottom:calc(1rem + env(safe-area-inset-bottom,0px));
  display:inline-flex;align-items:center;gap:.55rem;
  padding:.85rem 1.25rem;border-radius:999px;
  background:#25D366;color:#052e16;font-weight:800;font-size:.94rem;
  box-shadow:0 8px 28px rgba(0,0,0,.4);
  transition:transform var(--t-fast) var(--ease);
}
.sticky-wa:active{transform:scale(.96)}
.sticky-wa span{display:none}
@media(min-width:560px){.sticky-wa span{display:inline}}

/* ── Utilitare ─────────────────────────────────────────────────────────── */
.grid-head{display:flex;flex-wrap:wrap;gap:1rem;align-items:flex-end;
  justify-content:space-between;margin-bottom:1.5rem}
.empty-state{padding:3rem 1rem;text-align:center;color:var(--muted);
  border:1px dashed var(--border-strong);border-radius:var(--radius)}
.chip-row{display:flex;flex-wrap:wrap;gap:.5rem}
.chip{display:inline-flex;align-items:center;gap:.4rem;padding:.5rem .9rem;
  border-radius:999px;border:1px solid var(--border-strong);
  font-size:.87rem;font-weight:600;transition:border-color var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}
.chip:hover{border-color:var(--accent);color:var(--accent)}
.chip b{color:var(--muted);font-weight:600}


/* ── Hero (banner cu tranziție între imagini) ──────────────────────────── */
.hero{
  position:relative;min-height:clamp(520px,80svh,760px);
  display:grid;place-items:center;overflow:hidden;isolation:isolate;
  text-align:center;color:#fff;
}
.hero-slides{position:absolute;inset:0;z-index:-2}
.hero-slide{
  position:absolute;inset:0;background-size:cover;background-position:center;
  opacity:0;transition:opacity 1400ms var(--ease);
}
.hero-slide.is-active{opacity:1}
/* zoom lent doar pe slide-ul activ */
@media(prefers-reduced-motion:no-preference){
  .hero-slide.is-active{animation:hero-zoom 6s var(--ease) forwards}
}
@keyframes hero-zoom{from{transform:scale(1)}to{transform:scale(1.08)}}
.hero-scrim{position:absolute;inset:0;z-index:-1;
  background:linear-gradient(180deg,rgba(10,10,10,.55),rgba(10,10,10,.4) 40%,rgba(10,10,10,.82))}
.hero-inner{
  position:relative;width:100%;max-width:840px;margin-inline:auto;
  padding-inline:clamp(1.1rem,.5rem + 3vw,2.5rem);
  padding-block:clamp(3.5rem,7vh,6rem);
  display:flex;flex-direction:column;align-items:center;gap:1.3rem;
}
.hero h1{color:#fff;text-shadow:0 2px 30px rgba(0,0,0,.5)}
.hero-sub{color:rgba(255,255,255,.92);font-size:clamp(1rem,.95rem + .35vw,1.2rem);
  max-width:56ch;text-shadow:0 1px 16px rgba(0,0,0,.5)}
.hero-actions{display:flex;flex-wrap:wrap;gap:.8rem;justify-content:center;margin-top:.4rem}
.hero-dots{position:absolute;bottom:clamp(1rem,3vh,1.8rem);left:50%;transform:translateX(-50%);
  display:flex;gap:.55rem;z-index:1}
.hero-dot{width:9px;height:9px;border-radius:50%;padding:0;
  border:1px solid rgba(255,255,255,.7);background:transparent;
  transition:background var(--t-fast) var(--ease),transform var(--t-fast) var(--ease)}
.hero-dot.is-active{background:var(--accent);border-color:var(--accent);transform:scale(1.3)}
@media(max-width:560px){.hero-actions{flex-direction:column;width:100%}.hero-actions .btn{width:100%}}

/* ── Secțiune cu titlu centrat (servicii, stoc pe acasă) ───────────────── */
.section-center{text-align:center}
.section-center .section-head{margin-inline:auto}
.section-center .lead{margin-inline:auto}
.svc-head-icon{display:inline-flex;color:var(--accent);margin-bottom:.4rem}
.svc-head-icon svg{width:26px;height:26px}

/* ── Rândul „vezi tot stocul" ──────────────────────────────────────────── */
.stock-cta{display:flex;justify-content:center;margin-top:clamp(1.6rem,1rem + 2vw,2.6rem)}


/* ── Filtre stoc ───────────────────────────────────────────────────────── */
.filters{
  background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
  padding:clamp(1rem,.8rem + 1vw,1.5rem);margin-bottom:clamp(1.5rem,1rem + 2vw,2.4rem);
}
.filters-grid{display:grid;gap:.9rem;grid-template-columns:1fr}
@media(min-width:600px){.filters-grid{grid-template-columns:1fr 1fr}}
@media(min-width:960px){.filters-grid{grid-template-columns:repeat(3,1fr)}}
.f-field{display:flex;flex-direction:column;gap:.4rem}
.f-field label{font-size:.8rem;font-weight:700;color:var(--muted);letter-spacing:.02em}
.f-field select,.f-field input{
  width:100%;padding:.7rem .8rem;min-height:46px;
  background:var(--surface-2);border:1px solid var(--border-strong);border-radius:var(--radius-sm);
  color:var(--text);font-size:16px;
}
.f-field select:focus,.f-field input:focus{outline:none;border-color:var(--accent)}
.f-pair{display:flex;gap:.5rem}
.f-pair input{min-width:0}
.filters-actions{display:flex;flex-wrap:wrap;gap:.6rem;margin-top:1rem;align-items:center}
.filters-actions .btn{flex:1;min-width:150px}
@media(min-width:600px){.filters-actions .btn{flex:0 0 auto}}

/* ── Paginare ──────────────────────────────────────────────────────────── */
.pagination{display:flex;flex-wrap:wrap;gap:.4rem;justify-content:center;align-items:center;
  margin-top:clamp(2rem,1.5rem + 2vw,3rem)}
.pagination a,.pagination span{
  min-width:44px;height:44px;padding:0 .8rem;
  display:inline-flex;align-items:center;justify-content:center;
  border-radius:var(--radius-sm);font-weight:700;font-size:.95rem;
  border:1px solid var(--border-strong);
  transition:border-color var(--t-fast) var(--ease),background var(--t-fast) var(--ease),color var(--t-fast) var(--ease);
}
.pagination a:hover{border-color:var(--accent);color:var(--accent)}
.pagination .is-current{background:var(--accent);color:var(--on-accent);border-color:var(--accent)}
.pagination .is-disabled{opacity:.4;pointer-events:none}
.pagination .gap{border:none;min-width:auto;padding:0 .3rem;color:var(--muted-2)}

/* ── Antetul listei (număr rezultate + sortare) ────────────────────────── */
.stock-bar{display:flex;flex-wrap:wrap;gap:.8rem;align-items:center;
  justify-content:space-between;margin-bottom:1.2rem}
.stock-count{color:var(--muted);font-size:.95rem}
.stock-count b{color:var(--text)}
.stock-sort{display:flex;align-items:center;gap:.5rem}
.stock-sort select{padding:.55rem .8rem;min-height:42px;background:var(--surface-2);
  border:1px solid var(--border-strong);border-radius:var(--radius-sm);color:var(--text);font-size:.9rem}


/* ══ PAGINA UNEI MAȘINI ═══════════════════════════════════════════════════ */
.car-page{padding-block:clamp(1.2rem,.8rem + 1.5vw,2rem)}
.car-breadcrumb{display:flex;flex-wrap:wrap;gap:.4rem;align-items:center;
  font-size:.85rem;color:var(--muted-2);margin-bottom:1.2rem}
.car-breadcrumb a:hover{color:var(--accent)}
.car-breadcrumb .sep{opacity:.5}

.car-layout{display:grid;gap:clamp(1.4rem,1rem + 2vw,2.6rem);grid-template-columns:1fr;
  padding-bottom:clamp(2rem,1.5rem + 2vw,3.5rem)}
@media(min-width:960px){.car-layout{grid-template-columns:1.5fr 1fr;align-items:start}}

/* ── Galerie ───────────────────────────────────────────────────────────── */
.gallery{position:relative}
.gal-main{
  position:relative;aspect-ratio:4/3;background:var(--surface-2);
  border-radius:var(--radius);overflow:hidden;
}
.gal-main img{width:100%;height:100%;object-fit:cover;cursor:zoom-in}
.gal-noimg{width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--muted-2)}
/* săgeți navigare */
.gal-nav{position:absolute;top:50%;transform:translateY(-50%);z-index:2;
  width:44px;height:44px;border-radius:50%;
  background:rgba(0,0,0,.6);color:#fff;backdrop-filter:blur(4px);
  display:flex;align-items:center;justify-content:center;
  transition:background var(--t-fast) var(--ease)}
.gal-nav:hover{background:var(--accent);color:var(--on-accent)}
.gal-prev{left:.7rem}.gal-next{right:.7rem;transform:translateY(-50%) scaleX(-1)}
.gal-counter{position:absolute;bottom:.7rem;right:.7rem;z-index:2;
  padding:.3rem .7rem;border-radius:999px;background:rgba(0,0,0,.7);color:#fff;
  font-size:.8rem;font-weight:700;backdrop-filter:blur(4px)}
.gal-badge{position:absolute;top:.7rem;left:.7rem;z-index:2;
  padding:.35rem .75rem;border-radius:999px;font-size:.78rem;font-weight:700;
  background:var(--danger);color:#fff}
/* thumbnail-uri */
.gal-thumbs{display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));
  gap:.5rem;margin-top:.7rem}
.gal-thumb{aspect-ratio:4/3;border-radius:var(--radius-sm);overflow:hidden;
  border:2px solid transparent;background:var(--surface-2);cursor:pointer;padding:0}
.gal-thumb img{width:100%;height:100%;object-fit:cover}
.gal-thumb.is-active{border-color:var(--accent)}

/* ── Lightbox (zoom) ───────────────────────────────────────────────────── */
.lightbox{position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.95);
  display:none;align-items:center;justify-content:center}
.lightbox.is-open{display:flex}
.lb-track{display:flex;height:100%;width:100%;overflow-x:auto;
  scroll-snap-type:x mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.lb-track::-webkit-scrollbar{display:none}
.lb-slide{flex:0 0 100%;height:100%;scroll-snap-align:center;
  display:flex;align-items:center;justify-content:center;padding:1rem}
.lb-slide img{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain}
.lb-close,.lb-nav{position:fixed;z-index:2;width:48px;height:48px;border-radius:50%;
  background:rgba(255,255,255,.15);color:#fff;display:flex;align-items:center;justify-content:center;
  backdrop-filter:blur(6px);transition:background var(--t-fast) var(--ease)}
.lb-close:hover,.lb-nav:hover{background:rgba(255,255,255,.3)}
.lb-close{top:1rem;right:1rem}
.lb-prev{left:1rem;top:50%;transform:translateY(-50%)}
.lb-next{right:1rem;top:50%;transform:translateY(-50%) scaleX(-1)}
@media(max-width:700px){.lb-nav{display:none}}  /* pe telefon: swipe, nu săgeți */
.lb-counter{position:fixed;bottom:1.2rem;left:50%;transform:translateX(-50%);z-index:2;
  padding:.4rem .9rem;border-radius:999px;background:rgba(255,255,255,.15);color:#fff;
  font-size:.85rem;font-weight:700;backdrop-filter:blur(6px)}

/* ── Panoul de informații ──────────────────────────────────────────────── */
.car-info{position:sticky;top:88px}
@media(max-width:960px){.car-info{position:static}}
.car-info-head h1{font-size:clamp(1.5rem,1.2rem + 1.6vw,2rem);margin-bottom:.6rem}
.car-info-price{display:flex;align-items:baseline;gap:.6rem;margin-bottom:1.2rem;flex-wrap:wrap}
.car-info-price .price{font-size:clamp(1.8rem,1.4rem + 1.5vw,2.4rem);font-weight:800;color:var(--accent)}
.car-info-price .neg{color:var(--muted);font-size:.9rem}
.car-actions{display:flex;flex-direction:column;gap:.6rem;margin-bottom:1.4rem}
.car-actions .btn{width:100%}
.car-actions .btn-call{background:var(--surface-2);border:2px solid var(--border-strong);color:var(--text)}
.car-actions .btn-call:hover{border-color:var(--accent);color:var(--accent)}

/* ── Tabel specificații ────────────────────────────────────────────────── */
.spec-table{background:var(--surface);border:1px solid var(--border);
  border-radius:var(--radius);overflow:hidden;margin-bottom:1.4rem}
.spec-row{display:flex;justify-content:space-between;gap:1rem;
  padding:.75rem 1rem;border-bottom:1px solid var(--border);font-size:.92rem}
.spec-row:last-child{border-bottom:none}
.spec-row .k{color:var(--muted);display:flex;align-items:center;gap:.5rem}
.spec-row .k svg{color:var(--accent)}
.spec-row .v{font-weight:700;text-align:right}
.spec-badges{display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:1.4rem}
.spec-badge{padding:.4rem .8rem;border-radius:999px;font-size:.82rem;font-weight:700;
  background:var(--surface-2);border:1px solid var(--border-strong)}
.spec-badge.warn{background:#3a1a1a;border-color:#5c2e2e;color:#f0a0a0}
.spec-badge.ok{background:#1a2e1a;border-color:#2e5c2e;color:#a0f0a0}

/* ── Descriere ─────────────────────────────────────────────────────────── */
.car-desc{background:var(--surface);border:1px solid var(--border);
  border-left:3px solid var(--accent);border-radius:var(--radius);
  padding:clamp(1.1rem,.9rem + .8vw,1.6rem);margin-top:1.6rem}
.car-desc h2{font-size:1.2rem;margin-bottom:.8rem}
.car-desc p{color:var(--text);line-height:1.7;white-space:pre-wrap}


/* ══ PAGINA DE CONTACT ════════════════════════════════════════════════════ */
.contact-layout{display:grid;gap:clamp(1.5rem,1rem + 2vw,2.8rem);grid-template-columns:1fr}
@media(min-width:900px){.contact-layout{grid-template-columns:1fr 1fr}}

.contact-card{background:var(--surface);border:1px solid var(--border);
  border-radius:var(--radius);padding:clamp(1.3rem,1rem + 1vw,2rem)}
.contact-item{display:flex;gap:.9rem;padding:.9rem 0;border-bottom:1px solid var(--border)}
.contact-item:last-child{border-bottom:none}
.contact-item-icon{flex-shrink:0;width:44px;height:44px;border-radius:var(--radius-sm);
  background:var(--accent);color:var(--on-accent);display:flex;align-items:center;justify-content:center}
.contact-item-body{min-width:0}
.contact-item-label{font-size:.78rem;color:var(--muted-2);text-transform:uppercase;
  letter-spacing:.08em;font-weight:700;margin-bottom:.2rem}
.contact-item-value{font-weight:700;font-size:1.05rem;word-break:break-word}
.contact-item-value a:hover{color:var(--accent)}
.contact-item-sub{color:var(--muted);font-size:.85rem;margin-top:.1rem}

/* Program */
.hours-table{margin-top:.5rem}
.hours-row{display:flex;justify-content:space-between;gap:1rem;padding:.5rem 0;
  border-bottom:1px solid var(--border);font-size:.92rem}
.hours-row:last-child{border-bottom:none}
.hours-row .day{color:var(--muted)}
.hours-row .time{font-weight:700}
.hours-row.is-closed{opacity:.5}
.hours-row.is-today{color:var(--accent)}
.hours-row.is-today .day,.hours-row.is-today .time{color:var(--accent)}

/* Hartă */
.map-wrap{border-radius:var(--radius);overflow:hidden;border:1px solid var(--border);
  aspect-ratio:16/10;background:var(--surface-2)}
.map-wrap iframe{width:100%;height:100%;border:0;display:block;filter:grayscale(.3) contrast(1.05)}

/* Galeria de la contact */
.contact-gallery{margin-top:clamp(2.5rem,2rem + 2vw,4rem)}
.cg-grid{display:grid;gap:.7rem;grid-template-columns:repeat(2,1fr)}
@media(min-width:600px){.cg-grid{grid-template-columns:repeat(3,1fr)}}
@media(min-width:960px){.cg-grid{grid-template-columns:repeat(4,1fr)}}
.cg-item{aspect-ratio:4/3;border-radius:var(--radius-sm);overflow:hidden;
  background:var(--surface-2);cursor:zoom-in}
.cg-item img{width:100%;height:100%;object-fit:cover;transition:transform var(--t-base) var(--ease)}
.cg-item:hover img{transform:scale(1.06)}

/* ══ PAGINI LEGALE ════════════════════════════════════════════════════════ */
.legal{max-width:760px;margin-inline:auto}
.legal h1{margin-bottom:.4rem}
.legal-updated{color:var(--muted-2);font-size:.85rem;margin-bottom:2rem}
.legal h2{font-size:1.25rem;margin:2rem 0 .7rem;color:var(--accent)}
.legal p{color:var(--text);line-height:1.7;margin-bottom:1rem}
.legal ul{margin:0 0 1rem 1.2rem;color:var(--text);line-height:1.7}
.legal li{margin-bottom:.4rem}
.legal a{color:var(--accent);text-decoration:underline}
.legal strong{color:var(--text)}

/* ── Animații de intrare (nu întârzie conținutul) ──────────────────────── */
@media(prefers-reduced-motion:no-preference){
  .site-header{animation:hdr-in var(--t-base) var(--ease) both}
  @keyframes hdr-in{from{opacity:0;transform:translateY(-100%)}to{opacity:1;transform:none}}
}
@supports (animation-timeline: view()){
  @media(prefers-reduced-motion:no-preference) and (min-width:700px){
    .reveal{animation:reveal-in linear both;animation-timeline:view();
      animation-range:entry 6% cover 24%}
    @keyframes reveal-in{from{opacity:.2;transform:translateY(16px)}to{opacity:1;transform:none}}
  }
}

@media(prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;
    transition-duration:.01ms!important;scroll-behavior:auto!important}
}
`;

export default { SITE_CSS, CSS_VERSION };
