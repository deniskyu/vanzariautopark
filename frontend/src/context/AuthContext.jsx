// ============================================================================
//  src/context/AuthContext.jsx — starea de autentificare
// ----------------------------------------------------------------------------
//  Verifică sesiunea la pornire (GET /me) și expune login/logout. Rutele
//  protejate așteaptă `loading` să se termine înainte să decidă redirect —
//  altfel ar clipi spre login înainte să afle că ești deja autentificat.
// ============================================================================

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [authed, setAuthed] = useState(false);
    const [loading, setLoading] = useState(true);

    // La montare, întrebăm serverul dacă avem sesiune validă.
    useEffect(() => {
        let alive = true;
        api.me()
            .then((r) => { if (alive) setAuthed(!!r.authenticated); })
            .catch(() => { if (alive) setAuthed(false); })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, []);

    const login = useCallback(async (password) => {
        await api.login(password);   // aruncă ApiError dacă parola e greșită
        setAuthed(true);
    }, []);

    const logout = useCallback(async () => {
        try { await api.logout(); } catch { /* oricum ieșim */ }
        setAuthed(false);
    }, []);

    return (
        <AuthContext.Provider value={{ authed, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth trebuie folosit în interiorul AuthProvider');
    return ctx;
}

export default AuthContext;
