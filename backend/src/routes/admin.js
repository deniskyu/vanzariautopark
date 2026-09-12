// ============================================================================
//  src/routes/admin.js — login, logout, sesiune, citire opțiuni
// ----------------------------------------------------------------------------
//  Rutele de administrare care nu țin de mașini: autentificarea patronului și
//  citirea listelor de opțiuni (pe care panoul le folosește în formular).
//  Editarea setărilor de site (texte, numere) vine în Batch 11.
// ============================================================================

import { Hono } from 'hono';
import {
    createSession, destroySession, checkPassword, readSession,
    requireAuth, cleanupSessions,
} from '../auth.js';
import {
    BRANDS, ENGINE_CAPACITIES, FUEL_TYPES, BODY_TYPES, TRANSMISSIONS,
    DRIVETRAINS, POLLUTION_STANDARDS, COLORS, REGISTRATION_STATUS, STEERING,
    YEARS, LIMITS,
} from '../data/carOptions.js';

const admin = new Hono();

// ── Login ────────────────────────────────────────────────────────────────────
//  O singură parolă, din secret. Rate limiting real vine prin Cloudflare (se
//  configurează din dashboard, nu în cod) — aici punem doar o mică întârziere
//  la eșec, ca să descurajăm încercările rapide.
admin.post('/login', async (c) => {
    let body;
    try { body = await c.req.json(); }
    catch {
        // acceptăm și formular, nu doar JSON
        body = await c.req.parseBody().catch(() => ({}));
    }
    const password = body?.password || '';

    if (!checkPassword(password, c)) {
        // întârziere mică, constantă, la eșec
        await new Promise((r) => setTimeout(r, 400));
        return c.json({ ok: false, error: 'Parolă incorectă.' }, 401);
    }

    // curățăm sesiunile expirate din când în când, aici e un moment bun
    c.executionCtx?.waitUntil?.(cleanupSessions(c.env.DB));

    await createSession(c, c.env.DB);
    return c.json({ ok: true });
});

// ── Logout ───────────────────────────────────────────────────────────────────
admin.post('/logout', async (c) => {
    await destroySession(c, c.env.DB);
    return c.json({ ok: true });
});

// ── Verificare sesiune ───────────────────────────────────────────────────────
//  Panoul o apelează la încărcare, ca să știe dacă să arate login-ul sau nu.
admin.get('/me', async (c) => {
    const session = await readSession(c, c.env.DB);
    return c.json({ ok: true, authenticated: !!session });
});

// ── Opțiunile pentru formular ────────────────────────────────────────────────
//  Protejat: doar patronul logat vede formularul, deci doar el are nevoie de
//  liste. Le trimitem toate într-un singur apel, ca panoul să nu facă zece
//  cereri. Anul se recalculează la fiecare pornire (vezi carOptions.js).
admin.get('/options', requireAuth, (c) => {
    return c.json({
        ok: true,
        options: {
            brands: BRANDS,
            engine_capacities: ENGINE_CAPACITIES,
            fuel_types: FUEL_TYPES,
            body_types: BODY_TYPES,
            transmissions: TRANSMISSIONS,
            drivetrains: DRIVETRAINS,
            pollution_standards: POLLUTION_STANDARDS,
            colors: COLORS,
            registration_status: REGISTRATION_STATUS,
            steering: STEERING,
            years: YEARS,
            limits: LIMITS,
        },
    });
});

export { admin };
