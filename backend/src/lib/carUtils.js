// ============================================================================
//  src/lib/carUtils.js
// ----------------------------------------------------------------------------
//  Utilitare partajate: generare slug, normalizare telefon, validarea completă
//  a unui anunț. Rulează în Cloudflare Workers (fără API-uri Node.js).
// ============================================================================

import {
    BRANDS, ENGINE_CAPACITIES, FUEL_TYPES, BODY_TYPES, TRANSMISSIONS,
    DRIVETRAINS, POLLUTION_STANDARDS, COLORS, REGISTRATION_STATUS, STEERING,
    LIMITS, isAllowed, yearNow,
} from '../data/carOptions.js';

// ─── Slug ────────────────────────────────────────────────────────────────────
// 'BMW Seria 3' + 2018 → 'bmw-seria-3-2018-a91c4d'
// Sufixul aleator garantează unicitatea chiar dacă două mașini au același titlu.
// `normalize('NFD')` desparte litera de accent (š → s + caron), apoi ștergem
// semnele diacritice. Acoperă și cazurile din afara românei — Škoda, Citroën —
// pe care o hartă manuală le-ar rata. Diacriticele românești cu virgulă
// (ș/ț) și cele cu sedilă (ş/ţ) sunt tratate ambele de NFD.
export const slugify = (text) =>
    String(text || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')   // taie semnele diacritice combinate
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);

// Sufix scurt din alfabet fără caractere ambigue.
const randSuffix = (n = 6) => {
    const a = 'abcdefghjkmnpqrstuvwxyz23456789';
    let s = '';
    const bytes = crypto.getRandomValues(new Uint8Array(n));
    for (let i = 0; i < n; i++) s += a[bytes[i] % a.length];
    return s;
};

export const generateCarSlug = (title, brand, year) => {
    const base = slugify(title) || slugify(brand) || 'masina';
    const y = year ? `-${year}` : '';
    return `${base}${y}-${randSuffix()}`;
};

// ─── Telefon ─────────────────────────────────────────────────────────────────
// 0753637151 → 40753637151 (format internațional, fără plus, pentru wa.me)
//   +40 0753 637 151 → 40753637151   (0-ul în plus după prefix e scos)
//   0037369123456    → 37369123456   (prefix internațional 00 → fără)
export const normalizePhone = (raw) => {
    let d = String(raw || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.startsWith('00')) d = d.slice(2);                 // 0040…, 00373…
    else if (d.startsWith('40') && d.length >= 11) { /* deja ok */ }
    else if (d.startsWith('0')) d = '40' + d.slice(1);
    else if (d.length === 9) d = '40' + d;
    // „+40 07…" → 4007… : prefixul plus 0-ul național, des întâlnit
    if (d.startsWith('400') && d.length === 12) d = '40' + d.slice(3);
    return d;
};

// Un număr normalizat e valid? Românesc (40…) = exact 11 cifre; străin = 10–15.
export const isValidPhone = (norm) => {
    if (!norm) return false;
    if (norm.startsWith('40')) return norm.length === 11;
    return norm.length >= 10 && norm.length <= 15;
};

// ─── Numere întregi scrise de om ─────────────────────────────────────────────
//  „4300", „4.300", „4,300", „4 300" → 4300. Separatorul de mii e acceptat doar
//  în grupe corecte de câte 3 cifre. „4300.50" sau „4.3" sunt REFUZATE: înainte
//  se scoteau punctele și „4300.50" devenea 430.050 €.
//  @returns { value: number|null, error: boolean } — value null = gol.
export const parseWholeNumber = (v) => {
    if (v === null || v === undefined || v === '') return { value: null, error: false };
    if (typeof v === 'number') {
        return Number.isInteger(v) ? { value: v, error: false } : { value: null, error: true };
    }
    const s = String(v).trim().replace(/[\s ]/g, '');
    if (!s) return { value: null, error: false };
    if (/^-?\d+$/.test(s)) return { value: parseInt(s, 10), error: false };
    // un singur tip de separator, în grupe de 3: 4.300 / 1.250.000 / 4,300
    if (/^\d{1,3}(\.\d{3})+$/.test(s) || /^\d{1,3}(,\d{3})+$/.test(s)) {
        return { value: parseInt(s.replace(/[.,]/g, ''), 10), error: false };
    }
    return { value: null, error: true };
};

// 40753637151 → '0753 637 151' (pentru afișare)
export const formatPhoneDisplay = (raw) => {
    const d = normalizePhone(raw);
    if (d.length !== 11 || !d.startsWith('40')) return String(raw || '');
    const local = '0' + d.slice(2);
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
};

export const telHref = (raw) => {
    const d = normalizePhone(raw);
    return d ? `+${d}` : '';
};

// ─── Curățare text ───────────────────────────────────────────────────────────
export const clean = (t) => (t == null ? '' : String(t).trim());

// ─── Validarea unui anunț ────────────────────────────────────────────────────
//  Se apelează pe SERVER, la creare și editare.
//  @returns { ok, errors, data } — data e forma curată, gata de scris în D1.
export const validateCar = (body = {}) => {
    const e = [];

    // Câmpuri text obligatorii
    const title = clean(body.title);
    const brand = clean(body.brand);
    const description = clean(body.description);

    if (!title) e.push('Titlul este obligatoriu.');
    else if (title.length > LIMITS.title) e.push(`Titlul depășește ${LIMITS.title} de caractere.`);

    if (!brand) e.push('Marca este obligatorie.');
    else if (!isAllowed(brand, BRANDS)) e.push('Marca aleasă nu este validă.');

    if (description.length > LIMITS.description)
        e.push(`Descrierea depășește ${LIMITS.description} de caractere.`);

    // Numere — întregi, fără zecimale (vezi parseWholeNumber).
    const p = parseWholeNumber(body.price);
    const km = parseWholeNumber(body.mileage);
    const yr = parseWholeNumber(body.production_year);
    const hpP = parseWholeNumber(body.horsepower);
    const price = p.value, mileage = km.value, year = yr.value, hp = hpP.value;

    if (p.error) e.push('Prețul trebuie scris ca număr întreg, fără zecimale (ex. 4300 sau 4.300).');
    else if (price === null || price <= 0) e.push('Prețul trebuie să fie un număr pozitiv.');
    else if (price > LIMITS.max_price) e.push(`Prețul pare greșit (peste ${LIMITS.max_price.toLocaleString('ro-RO')} €).`);

    if (km.error) e.push('Kilometrajul trebuie scris ca număr întreg, fără zecimale (ex. 266500).');
    else if (mileage === null || mileage < 0) e.push('Kilometrajul trebuie să fie un număr.');
    else if (mileage > LIMITS.max_mileage) e.push('Kilometrajul pare greșit (prea mare).');

    const maxYear = yearNow() + 1;
    if (yr.error || year === null) e.push('Alege anul de fabricație.');
    else if (year < 1900 || year > maxYear) e.push('Anul de fabricație nu este valid.');

    if (hpP.error || (hp !== null && (hp < 0 || hp > 2000))) e.push('Puterea are o valoare nevalidă.');

    // Liste
    const checks = [
        ['fuel', body.fuel, FUEL_TYPES, 'Combustibilul'],
        ['engine_capacity', body.engine_capacity, ENGINE_CAPACITIES, 'Capacitatea motorului'],
        ['body_type', body.body_type, BODY_TYPES, 'Caroseria'],
        ['transmission', body.transmission, TRANSMISSIONS, 'Cutia de viteze'],
        ['drivetrain', body.drivetrain, DRIVETRAINS, 'Tracțiunea'],
        ['pollution_standard', body.pollution_standard, POLLUTION_STANDARDS, 'Norma de poluare'],
        ['color', body.color, COLORS, 'Culoarea'],
        ['registration_status', body.registration_status, REGISTRATION_STATUS, 'Starea înmatriculării'],
    ];
    for (const [, val, list, label] of checks) {
        if (!isAllowed(clean(val), list)) e.push(`${label} are o valoare nevalidă.`);
    }

    // Coerența electric: combustibil electric ⇔ capacitate „Fără (Electric)"
    const isElFuel = clean(body.fuel) === 'Electric';
    const isElCap = clean(body.engine_capacity) === 'Fără (Electric)';
    if (isElFuel !== isElCap)
        e.push('Pentru combustibil electric, capacitatea trebuie să fie „Fără (Electric)" — și invers.');

    // Telefon: dacă e gol, se completează în rută cu numărul parcului.
    const phone = normalizePhone(body.phone);
    if (phone && !isValidPhone(phone))
        e.push('Numărul de telefon are un format nevalid (ex. 0753 637 151).');

    const steering = clean(body.steering_wheel) === 'right' ? 'right' : 'left';

    if (e.length) return { ok: false, errors: e };

    return {
        ok: true,
        errors: [],
        data: {
            title,
            brand,
            production_year: year,
            price,
            negotiable: (body.negotiable === true || body.negotiable === 'true' || body.negotiable === 'on' || body.negotiable === 1) ? 1 : 0,
            mileage,
            fuel: clean(body.fuel),
            engine_capacity: clean(body.engine_capacity),
            horsepower: hp && hp > 0 ? hp : null,
            pollution_standard: clean(body.pollution_standard),
            body_type: clean(body.body_type),
            color: clean(body.color),
            transmission: clean(body.transmission),
            drivetrain: clean(body.drivetrain),
            steering_wheel: steering,
            vin: clean(body.vin).toUpperCase().slice(0, 17),
            registration_status: clean(body.registration_status),
            for_dismantling: (body.for_dismantling === true || body.for_dismantling === 'true' || body.for_dismantling === 'on' || body.for_dismantling === 1) ? 1 : 0,
            description,
            phone,   // poate fi '' — rutei îi revine să pună numărul parcului
        },
    };
};

export default {
    slugify, generateCarSlug, normalizePhone, isValidPhone, parseWholeNumber,
    formatPhoneDisplay, telHref, clean, validateCar,
};
