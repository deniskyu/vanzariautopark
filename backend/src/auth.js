// ============================================================================
//  src/auth.js — autentificarea patronului
// ----------------------------------------------------------------------------
//  Un singur utilizator: patronul. Parola vine din secret (ADMIN_PASSWORD),
//  nu din baza de date — nu există înregistrare, nu există „useri".
//
//  Sesiuni în D1, nu JWT pur. Motivul: se pot invalida. Ștergi rândul din
//  `sessions` și accesul dispare instant (parolă compromisă, logout de pe alt
//  dispozitiv). Cu JWT ar rămâne valabil până expiră, orice ai face.
//
//  Cookie-ul conține doar un token opac. Nicio informație nu circulă prin el.
// ============================================================================

import { setCookie, getCookie, deleteCookie } from 'hono/cookie';

const COOKIE_NAME = 'vap_sid';
const SESSION_DAYS = 7;
const SESSION_MS = SESSION_DAYS * 24 * 3600 * 1000;

// ── Token opac, 32 de octeți din generatorul criptografic ────────────────────
const newToken = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
};

// ── Comparație de parolă în timp constant ────────────────────────────────────
// O comparație normală (===) se oprește la primul caracter diferit, iar
// diferența de timp poate scurge lungimea/prefixul parolei. Asta compară tot,
// mereu în același timp.
const timingSafeEqual = (a, b) => {
    const enc = new TextEncoder();
    const ba = enc.encode(String(a));
    const bb = enc.encode(String(b));
    if (ba.length !== bb.length) {
        // Tot facem o comparație, ca durata să nu difere pe lungime.
        let d = 1;
        for (let i = 0; i < ba.length; i++) d |= ba[i] ^ (bb[i] || 0);
        return false;
    }
    let diff = 0;
    for (let i = 0; i < ba.length; i++) diff |= ba[i] ^ bb[i];
    return diff === 0;
};

/**
 * Creează o sesiune în D1 și pune cookie-ul.
 * @param {D1Database} db
 */
export const createSession = async (c, db) => {
    const token = newToken();

    const expires = new Date(
        Date.now() + SESSION_MS
    ).toISOString();

    await db
        .prepare(
            'INSERT INTO sessions (token, expires_at) VALUES (?, ?)'
        )
        .bind(token, expires)
        .run();

    setCookie(c, COOKIE_NAME, token, {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        path: '/',
        maxAge: SESSION_DAYS * 24 * 3600,
    });


    return token;
};


export const readSession = async (c, db) => {
    const token = getCookie(c, COOKIE_NAME);

    console.log(
        '[AUTH]',
        token
            ? `cookie PRESENT (${token.length})`
            : 'cookie MISSING'
    );

    if (!token || token.length !== 64) return null;

    const row = await db
        .prepare('SELECT token, expires_at FROM sessions WHERE token = ?')
        .bind(token)
        .first();

    console.log('[AUTH] D1 row:', !!row);

    if (!row) return null;

    if (new Date(row.expires_at).getTime() < Date.now()) {
        console.log('[AUTH] EXPIRED');
        await db.prepare(
            'DELETE FROM sessions WHERE token = ?'
        ).bind(token).run();

        deleteCookie(c, COOKIE_NAME, {
            path: '/',
        });

        return null;
    }

    console.log('[AUTH] VALID');
    return { token };
};


export const destroySession = async (c, db) => {
    const token = getCookie(c, COOKIE_NAME);
    if (token) await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    deleteCookie(c, COOKIE_NAME, { path: '/'});
};

/** Verifică parola trimisă contra secretului. */
export const checkPassword = (submitted, c) => {
    const real = c.env.ADMIN_PASSWORD;
    if (!real) {
        console.error('[auth] ADMIN_PASSWORD lipsește din secrets!');
        return false;
    }
    return timingSafeEqual(submitted, real);
};

/**
 * Middleware Hono. Blochează rutele de admin dacă sesiunea nu e validă.
 * Folosire: app.use('/api/admin/*', requireAuth)
 */
export const requireAuth = async (c, next) => {
    const session = await readSession(c, c.env.DB);
    if (!session) {
        return c.json({ ok: false, error: 'Sesiune expirată. Autentifică-te din nou.' }, 401);
    }
    await next();
};

/** Curăță sesiunile expirate. De apelat rar (ex. la login), best-effort. */
export const cleanupSessions = async (db) => {
    try {
        await db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
    } catch { /* irelevant */ }
};

export default {
    createSession, readSession, destroySession, checkPassword,
    requireAuth, cleanupSessions,
};
