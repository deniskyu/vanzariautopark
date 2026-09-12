// ============================================================================
//  src/lib/carUtils.js
// ----------------------------------------------------------------------------
//  Utilitare partajate: generare slug, normalizare telefon, validarea completă
//  a unui anunț. Rulează în Cloudflare Workers (fără API-uri Node.js).
// ============================================================================

import {
    BRANDS, ENGINE_CAPACITIES, FUEL_TYPES, BODY_TYPES, TRANSMISSIONS,
    DRIVETRAINS, POLLUTION_STANDARDS, COLORS, REGISTRATION_STATUS, STEERING,
    LIMITS, isAllowed, MIN_YEAR 
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
export const normalizePhone = (raw) => {
    let d = String(raw || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.startsWith('0040')) d = d.slice(2);
    else if (d.startsWith('40') && d.length >= 11) { /* deja ok */ }
    else if (d.startsWith('0')) d = '40' + d.slice(1);
    else if (d.length === 9) d = '40' + d;
    return d;
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
const toInt = (v) => {
    const n = parseInt(String(v ?? '').replace(/[^0-9-]/g, ''), 10);
    return Number.isFinite(n) ? n : null;
};

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

    // Numere
    const price = toInt(body.price);
    const mileage = toInt(body.mileage);
    const year = toInt(body.production_year);
    const hp = toInt(body.horsepower);

    if (price === null || price <= 0) e.push('Prețul trebuie să fie un număr pozitiv.');
    if (mileage === null || mileage < 0) e.push('Kilometrajul trebuie să fie un număr.');
    if (year === null || year < MIN_YEAR || year > currentYear + 1)
        e.push(`Anul trebuie să fie între ${MIN_YEAR} și ${currentYear + 1}.`);
    if (hp !== null && (hp < 0 || hp > 2000)) e.push('Puterea are o valoare nevalidă.');

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
    if (phone && (phone.length < 10 || phone.length > 15))
        e.push('Numărul de telefon are un format nevalid.');

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
    slugify, generateCarSlug, normalizePhone, formatPhoneDisplay, telHref,
    clean, validateCar,
};
