import { setCookie, getCookie, deleteCookie } from 'hono/cookie';

const COOKIE_NAME = 'vap_sid';
const SESSION_DAYS = 7;
const SESSION_MS = SESSION_DAYS * 24 * 3600 * 1000;

const newToken = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
};

const timingSafeEqual = (a, b) => {
    const enc = new TextEncoder();
    const ba = enc.encode(String(a));
    const bb = enc.encode(String(b));
    if (ba.length !== bb.length) {
        let d = 1;
        for (let i = 0; i < ba.length; i++) d |= ba[i] ^ (bb[i] || 0);
        return false;
    }
    let diff = 0;
    for (let i = 0; i < ba.length; i++) diff |= ba[i] ^ bb[i];
    return diff === 0;
};

export const createSession = async (c, db) => {
    const token = newToken();
    const expires = new Date(Date.now() + SESSION_MS).toISOString();
    
    await db.prepare('INSERT INTO sessions (token, expires_at) VALUES (?, ?)')
        .bind(token, expires).run();

    setSessionCookie(c, token);
    return token;
};

const setSessionCookie = (c, token) => {
    setCookie(c, COOKIE_NAME, token, {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        path: '/',
        domain: '.vanzariautopark.com',
        maxAge: SESSION_DAYS * 24 * 3600,
    });
};

export const readSession = async (c, db) => {
    const token = getCookie(c, COOKIE_NAME);
    if (!token || token.length !== 64) return null;

    const row = await db.prepare('SELECT token, expires_at FROM sessions WHERE token = ?')
        .bind(token).first();
    if (!row) return null;

    if (new Date(row.expires_at).getTime() < Date.now()) {
        await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
        deleteCookie(c, COOKIE_NAME, { path: '/', domain: '.vanzariautopark.com' });
        return null;
    }

    // Sesiune care se prelungește: dacă patronul folosește panoul, nu-l mai
    // scoate afară la fix 7 zile după login (în mijlocul unui anunț). Când a
    // trecut jumătate din durată, o reînnoim la 7 zile întregi.
    const left = new Date(row.expires_at).getTime() - Date.now();
    if (left < SESSION_MS / 2) {
        try {
            const expires = new Date(Date.now() + SESSION_MS).toISOString();
            await db.prepare('UPDATE sessions SET expires_at = ? WHERE token = ?').bind(expires, token).run();
            setSessionCookie(c, token);
        } catch (err) {
            console.warn('[auth] prelungire sesiune:', err.message);
        }
    }
    return { token };
};

export const destroySession = async (c, db) => {
    const token = getCookie(c, COOKIE_NAME);
    if (token) await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    deleteCookie(c, COOKIE_NAME, { path: '/', domain: '.vanzariautopark.com' });
};

export const checkPassword = (submitted, c) => {
    const real = c.env.ADMIN_PASSWORD;
    if (!real) return false;
    return timingSafeEqual(submitted, real);
};

export const requireAuth = async (c, next) => {
    const session = await readSession(c, c.env.DB);
    if (!session) {
        return c.json({ ok: false, error: 'Sesiune expirată. Autentifică-te din nou.' }, 401);
    }
    await next();
};

export const cleanupSessions = async (db) => {
    try {
        await db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
    } catch { }
};

export default {
    createSession, readSession, destroySession, checkPassword,
    requireAuth, cleanupSessions,
};