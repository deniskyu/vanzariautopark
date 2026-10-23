// ============================================================================
//  src/lib/format.js — numere și telefoane, la fel ca pe server
// ----------------------------------------------------------------------------
//  Aceleași reguli ca backend/src/lib/carUtils.js (parseWholeNumber,
//  normalizePhone, isValidPhone), ca formularul să arate exact ce va apărea pe
//  site ÎNAINTE de salvare. Serverul rămâne autoritatea — dacă le schimbi
//  acolo, schimbă-le și aici.
// ============================================================================

// „4300", „4.300", „4,300", „4 300" → 4300.  „4300.50" / „4.3" → eroare.
export function parseWholeNumber(v) {
    if (v === null || v === undefined || v === '') return { value: null, error: false };
    if (typeof v === 'number') {
        return Number.isInteger(v) ? { value: v, error: false } : { value: null, error: true };
    }
    const s = String(v).trim().replace(/[\s ]/g, '');
    if (!s) return { value: null, error: false };
    if (/^-?\d+$/.test(s)) return { value: parseInt(s, 10), error: false };
    if (/^\d{1,3}(\.\d{3})+$/.test(s) || /^\d{1,3}(,\d{3})+$/.test(s)) {
        return { value: parseInt(s.replace(/[.,]/g, ''), 10), error: false };
    }
    return { value: null, error: true };
}

// 4300 → „4.300"
export const fmtNumber = (n) => new Intl.NumberFormat('de-DE').format(n);

export function normalizePhone(raw) {
    let d = String(raw || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.startsWith('00')) d = d.slice(2);
    else if (d.startsWith('40') && d.length >= 11) { /* deja ok */ }
    else if (d.startsWith('0')) d = '40' + d.slice(1);
    else if (d.length === 9) d = '40' + d;
    if (d.startsWith('400') && d.length === 12) d = '40' + d.slice(3);
    return d;
}

export function isValidPhone(norm) {
    if (!norm) return false;
    if (norm.startsWith('40')) return norm.length === 11;
    return norm.length >= 10 && norm.length <= 15;
}

// 40753637151 → „0753 637 151"; număr străin → „+373 69123456"
export function formatPhoneDisplay(raw) {
    const d = normalizePhone(raw);
    if (!d) return '';
    if (d.length === 11 && d.startsWith('40')) {
        const local = '0' + d.slice(2);
        return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
    }
    return '+' + d;
}
