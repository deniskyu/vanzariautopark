// ============================================================================
//  src/api/client.js — clientul API al panoului de admin
// ----------------------------------------------------------------------------
//  Un singur loc care vorbește cu Worker-ul. Toate cererile trimit cookie-ul
//  de sesiune (credentials: 'include'), fiindcă panoul e pe alt domeniu decât
//  Worker-ul, iar autentificarea e pe cookie.
//
//  În dev, cererile merg prin proxy-ul Vite către localhost:8787 (vezi
//  vite.config.js), deci calea relativă /api funcționează fără CORS.
//  În producție, folosim VITE_API_URL (domeniul Worker-ului).
// ============================================================================

const BASE = import.meta.env.VITE_API_URL || '';

// Eroare cu detalii, ca UI-ul să poată afișa mesajul corect și lista de erori.
//  `data` = corpul complet al răspunsului (ex. `missing_media` la 409).
export class ApiError extends Error {
    constructor(message, status, errors, data) {
        super(message);
        this.status = status;
        this.errors = errors || null;
        this.data = data || null;
    }
}

async function request(path, { method = 'GET', body, isForm = false } = {}) {
    const opts = {
        method,
        credentials: 'include',   // trimite cookie-ul de sesiune
        headers: {},
    };
    if (body !== undefined) {
        if (isForm) {
            opts.body = body;   // FormData / raw — nu punem content-type manual
        } else {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(body);
        }
    }

    let res;
    try {
        res = await fetch(`${BASE}/api${path}`, opts);
    } catch {
        throw new ApiError('Nu s-a putut contacta serverul. Verifică conexiunea.', 0);
    }

    let data = null;
    try { data = await res.json(); } catch { /* răspuns fără corp */ }

    if (!res.ok || (data && data.ok === false)) {
        const msg = (data && (data.error || data.message)) || `Eroare ${res.status}`;
        throw new ApiError(msg, res.status, data && data.errors, data);
    }
    return data;
}

// ── Autentificare ────────────────────────────────────────────────────────────
export const api = {
    login: (password) => request('/admin/login', { method: 'POST', body: { password } }),
    logout: () => request('/admin/logout', { method: 'POST' }),
    me: () => request('/admin/me'),
    options: () => request('/admin/options'),

    // ── Mașini ──
    listCars: (params = {}) => {
        const qs = new URLSearchParams();
        for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
        const s = qs.toString();
        return request(`/admin/cars${s ? '?' + s : ''}`);
    },
    getCar: (id) => request(`/admin/cars/${id}`),
    createCar: (data) => request('/admin/cars', { method: 'POST', body: data }),
    updateCar: (id, data) => request(`/admin/cars/${id}`, { method: 'PUT', body: data }),
    setCarStatus: (id, status) => request(`/admin/cars/${id}/status`, { method: 'PATCH', body: { status } }),
    deleteCar: (id) => request(`/admin/cars/${id}`, { method: 'DELETE' }),

    // ── Setări site ──
    getSettings: () => request('/admin/settings'),
    updateSettings: (data) => request('/admin/settings', { method: 'PUT', body: data }),

    // ── Media: upload cu progres real ──
    //  XMLHttpRequest, nu fetch: fetch NU expune progresul de upload. Fără
    //  procent real, un upload de 20 de poze pare o pagină blocată.
    uploadMedia: (blob, { draftId, w, h, onProgress } = {}) => {
        const qs = new URLSearchParams();
        if (draftId) qs.set('draft_id', draftId);
        if (w) qs.set('w', w);
        if (h) qs.set('h', h);

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `${BASE}/api/admin/media?${qs.toString()}`);
            xhr.withCredentials = true;           // trimite cookie-ul de sesiune
            xhr.setRequestHeader('Content-Type', blob.type || 'image/jpeg');

            if (onProgress && xhr.upload) {
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
                };
            }
            xhr.onload = () => {
                let data = null;
                try { data = JSON.parse(xhr.responseText); } catch { /* fără corp */ }
                if (xhr.status >= 200 && xhr.status < 300 && data && data.ok !== false) {
                    resolve(data);
                } else {
                    const msg = (data && (data.error || data.message)) || `Eroare ${xhr.status}`;
                    reject(new ApiError(msg, xhr.status, data && data.errors));
                }
            };
            xhr.onerror = () => reject(new ApiError('Eroare de rețea la încărcare.', 0));
            xhr.send(blob);
        });
    },

    // ── Media: ștergere imediată a unei singure poze ──
    //  Apelat din PhotoUploader la „✕", înainte chiar de Salvează — previne
    //  poze orfane în B2 (vezi comentariul din media.js, Stratul 1).
    deleteMedia: (dir, filename) => request(`/admin/media/${dir}/${filename}`, { method: 'DELETE' }),
};

export default api;
