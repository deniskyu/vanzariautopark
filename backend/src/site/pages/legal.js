// ============================================================================
//  src/site/pages/legal.js — termeni, confidențialitate, cookies
// ----------------------------------------------------------------------------
//  Șabloane SCURTE, de catalog de prezentare. Site-ul NU vinde online, NU
//  acceptă plăți, NU încheie contracte la distanță — tranzacția reală are loc
//  la parc. De aceea lipsesc corect: dreptul de retragere în 14 zile, termenii
//  de livrare/plată, politica de retur.
//
//  Un șablon copiat de la un magazin online ar promite lucruri false — risc
//  legal mai mare decât un text scurt și corect.
//
//  Datele firmei se injectează din settings. O singură sursă de adevăr.
//
//  ⚠️ Punct de plecare rezonabil, NU consultanță juridică. Înainte de primul
//  client plătitor, textele merită trecute pe la un avocat.
// ============================================================================

import { html, raw } from '../html.js';
import { Layout } from '../layout.js';
import { Header, Footer, StickyWhatsApp } from '../components.js';

const firm = (site) => ({
    name: site.company_name || 'VANZARI AUTO PARK SRL',
    cui: site.company_cui || 'RO31727751',
    reg: site.company_reg || 'J07/191/2013',
    addr: site.company_address || 'Sat Hudum, com. Curtești, jud. Botoșani',
    email: site.email || 'vanzari_auto_park@yahoo.com',
    domain: site.domain || 'vanzariautopark.com',
});

const wrapLegal = (site, title, description, inner) => {
    const body = html`
${Header(site)}
<main class="section">
  <div class="wrap">
    <article class="legal">
      ${inner}
    </article>
  </div>
</main>
${Footer(site)}
${StickyWhatsApp(site)}`;
    return Layout({
        site, title, description,
        canonical: `https://${site.domain}/${title === 'Termeni și condiții' ? 'termeni' : title === 'Politica de confidențialitate' ? 'confidentialitate' : 'cookies'}`,
        body,
    });
};

// ── TERMENI ȘI CONDIȚII ──────────────────────────────────────────────────────
export const renderTermeni = (site) => {
    const f = firm(site);
    return wrapLegal(site, 'Termeni și condiții',
        `Termenii de utilizare a site-ului ${site.display_name}.`,
        html`
        <h1>Termeni și condiții</h1>
        <p class="legal-updated">Ultima actualizare: ${new Date().toLocaleDateString('ro-RO', { year: 'numeric', month: 'long' })}</p>

        <p>Acest site este administrat de <strong>${f.name}</strong>, CUI ${f.cui},
        înregistrată la Registrul Comerțului sub nr. ${f.reg}, cu sediul în ${f.addr}.
        Prin accesarea site-ului <strong>${f.domain}</strong>, ești de acord cu termenii de mai jos.</p>

        <h2>1. Rolul site-ului</h2>
        <p>Site-ul are rol exclusiv de <strong>prezentare</strong> a stocului de autovehicule
        disponibile în parcul auto. Nu se realizează vânzări online, plăți sau rezervări prin
        intermediul site-ului. Orice tranzacție se încheie direct la sediul nostru, în urma
        vizionării autovehiculului.</p>

        <h2>2. Informațiile despre autovehicule</h2>
        <p>Ne străduim să prezentăm informații corecte și actuale despre fiecare autovehicul
        (an, kilometraj, dotări, preț). Cu toate acestea, prețurile și disponibilitatea se pot
        modifica fără notificare prealabilă. Detaliile finale, starea tehnică și prețul se
        confirmă la fața locului, înainte de achiziție.</p>
        <p>Fotografiile au caracter informativ. Îți recomandăm să vezi autovehiculul personal
        înainte de a lua o decizie.</p>

        <h2>3. Prețuri</h2>
        <p>Prețurile afișate sunt exprimate în euro (€) și pot fi negociabile, după caz.
        Finanțarea în rate este disponibilă prin partenerul nostru TBI Bank, în condițiile
        stabilite de acesta.</p>

        <h2>4. Proprietate intelectuală</h2>
        <p>Conținutul site-ului (texte, fotografii, logo) aparține ${f.name} și nu poate fi
        preluat sau reprodus fără acordul nostru.</p>

        <h2>5. Limitarea răspunderii</h2>
        <p>Nu răspundem pentru eventuale erori de afișare sau pentru deciziile luate exclusiv
        pe baza informațiilor de pe site. Relația contractuală se stabilește doar prin
        documentele semnate la achiziție.</p>

        <h2>6. Contact</h2>
        <p>Pentru orice întrebare legată de acești termeni, ne poți contacta la
        <a href="mailto:${f.email}">${f.email}</a>.</p>
        `);
};

// ── CONFIDENȚIALITATE ────────────────────────────────────────────────────────
export const renderConfidentialitate = (site) => {
    const f = firm(site);
    return wrapLegal(site, 'Politica de confidențialitate',
        `Cum protejăm datele tale pe site-ul ${site.display_name}.`,
        html`
        <h1>Politica de confidențialitate</h1>
        <p class="legal-updated">Ultima actualizare: ${new Date().toLocaleDateString('ro-RO', { year: 'numeric', month: 'long' })}</p>

        <p><strong>${f.name}</strong> (CUI ${f.cui}, sediu în ${f.addr}) respectă
        confidențialitatea vizitatorilor. Această politică explică ce date prelucrăm și cum.</p>

        <h2>1. Ce date colectăm prin site</h2>
        <p><strong>Site-ul nu colectează date personale prin formulare.</strong> Nu există
        formulare de contact, cont de utilizator sau abonare pe acest site. Contactul se
        realizează direct, prin telefon sau WhatsApp, la inițiativa ta.</p>
        <p>Site-ul nu folosește instrumente de analiză a traficului care să te identifice
        personal și nu plasează cookie-uri de urmărire sau publicitate.</p>

        <h2>2. Când ne contactezi</h2>
        <p>Dacă ne suni sau ne scrii pe WhatsApp, vei furniza numărul tău de telefon și
        informațiile pe care alegi să le comunici. Le folosim exclusiv pentru a-ți răspunde
        și a-ți oferi detalii despre autovehiculele de interes. Nu le transmitem terților în
        scopuri de marketing.</p>

        <h2>3. Finanțare prin TBI Bank</h2>
        <p>Dacă optezi pentru finanțare în rate, datele necesare dosarului sunt prelucrate
        direct de TBI Bank, în calitate de operator independent, conform politicii proprii de
        confidențialitate. Noi doar facilităm legătura.</p>

        <h2>4. Drepturile tale (GDPR)</h2>
        <p>Conform Regulamentului (UE) 2016/679, ai dreptul de acces, rectificare, ștergere,
        restricționare și opoziție cu privire la datele tale. Pentru exercitarea acestor
        drepturi, scrie-ne la <a href="mailto:${f.email}">${f.email}</a>.</p>
        <p>Ai, de asemenea, dreptul de a depune o plângere la Autoritatea Națională de
        Supraveghere a Prelucrării Datelor cu Caracter Personal (ANSPDCP).</p>

        <h2>5. Contact</h2>
        <p>Pentru orice întrebare privind datele tale: <a href="mailto:${f.email}">${f.email}</a>.</p>
        `);
};

// ── COOKIES ──────────────────────────────────────────────────────────────────
export const renderCookies = (site) => {
    const f = firm(site);
    return wrapLegal(site, 'Politica de cookies',
        `Politica de cookies pentru site-ul ${site.display_name}.`,
        html`
        <h1>Politica de cookies</h1>
        <p class="legal-updated">Ultima actualizare: ${new Date().toLocaleDateString('ro-RO', { year: 'numeric', month: 'long' })}</p>

        <p>Un cookie este un fișier text mic, stocat de browser la vizitarea unui site.</p>

        <h2>Ce cookie-uri folosim</h2>
        <p><strong>Acest site nu folosește cookie-uri de urmărire, analiză sau publicitate.</strong>
        Nu monitorizăm comportamentul vizitatorilor și nu partajăm date cu rețele de reclame.</p>

        <p>Singurele cookie-uri care pot apărea sunt cele <strong>strict necesare</strong>
        funcționării, de exemplu la încărcarea hărții Google încorporate în pagina de contact.
        Acestea sunt gestionate de Google, conform politicii proprii.</p>

        <h2>Cum controlezi cookie-urile</h2>
        <p>Poți șterge sau bloca cookie-urile din setările browserului tău. Blocarea lor nu
        afectează funcționarea site-ului, cu excepția eventualei afișări a hărții.</p>

        <h2>Contact</h2>
        <p>Întrebări despre cookies: <a href="mailto:${f.email}">${f.email}</a>.</p>
        `);
};

export default { renderTermeni, renderConfidentialitate, renderCookies };
