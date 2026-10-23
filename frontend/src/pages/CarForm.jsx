// ============================================================================
//  src/pages/CarForm.jsx — adăugare și editare mașină
// ----------------------------------------------------------------------------
//  Aceeași pagină pentru „nou" și „editare" (distinge după :id din rută).
//  Opțiunile pentru dropdown-uri vin de la /admin/options (listele hardcodate).
//  Validarea se face și în client (feedback imediat) și pe server (autoritate).
//
//  La adăugare, pozele se urcă sub un draft_id temporar; la salvare, lista de
//  media se trimite în anunț. La editare, draft_id = id-ul mașinii.
//
//  Ce protejează formularul:
//   • nu se poate salva cât timp se mai urcă poze sau există poze cu eroare;
//   • prețul/kilometrajul se arată exact cum vor apărea pe site (fără zecimale
//     ascunse: „4300.50" nu mai devine 430.050 €);
//   • un anunț nou nesalvat rămâne ca ciornă pe dispozitiv (localStorage) —
//     dacă închizi tabul sau expiră sesiunea, îl continui de unde ai rămas;
//   • la ieșire cu modificări nesalvate cere confirmare;
//   • dacă sesiunea expiră la salvare, te autentifici pe loc, fără să pierzi nimic;
//   • dacă mașina a fost salvată între timp din alt tab, nu o suprascrie.
// ============================================================================

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { AdminLayout, Loading, Toast } from '../components/ui.jsx';
import PhotoUploader from '../components/PhotoUploader.jsx';
import {
    parseWholeNumber, fmtNumber, normalizePhone, isValidPhone, formatPhoneDisplay,
} from '../lib/format.js';

const API_BASE = import.meta.env.VITE_API_URL || '';
const DRAFT_KEY = 'vap_car_draft_v1';
const MAX_PRICE = 5000000;
const MAX_MILEAGE = 2000000;

// id temporar de draft pentru pozele unei mașini noi
const newDraftId = () => 'draft_' + Math.random().toString(36).slice(2, 10);

const EMPTY = {
    title: '', brand: '', production_year: '', price: '', negotiable: false,
    mileage: '', fuel: '', engine_capacity: '', horsepower: '',
    pollution_standard: '', body_type: '', color: '', transmission: '',
    drivetrain: '', steering_wheel: 'left', vin: '', registration_status: '',
    for_dismantling: false, description: '', phone: '', status: 'published',
};

// 0 rămâne „0" (înainte, `c.mileage || ''` transforma 0 km în câmp gol)
const str = (v) => (v === null || v === undefined ? '' : String(v));

// ── Ciorna locală (doar pentru anunțuri noi) ────────────────────────────────
//  localStorage poate lipsi sau arunca (navigare privată) — totul e protejat.
const readDraft = () => {
    try {
        const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
        return d && d.f ? d : null;
    } catch { return null; }
};
const writeDraft = (d) => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* fără ciornă */ } };
const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch { /* nimic */ } };

const IGNORED_FOR_CONTENT = new Set(['steering_wheel', 'status', 'negotiable', 'for_dismantling']);
const hasContent = (f, media) =>
    (media && media.length > 0) ||
    Object.entries(f).some(([k, v]) => !IGNORED_FOR_CONTENT.has(k) && String(v ?? '').trim() !== '');

const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

const fmtWhen = (ts) => {
    try {
        return new Date(ts).toLocaleString('ro-RO', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
};

// Select-ul e definit în afara formularului: definit înăuntru, React îl
// recrea la fiecare tastă (pierdea focusul, închidea lista pe telefon).
function Sel({ label, value, list, onChange, required }) {
    return (
        <label className="field">
            <span>{label}{required && ' *'}</span>
            <select value={value} onChange={(ev) => onChange(ev.target.value)}>
                <option value="">Alege…</option>
                {(list || []).map((o) =>
                    typeof o === 'string' || typeof o === 'number'
                        ? <option key={o} value={o}>{o}</option>
                        : <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        </label>
    );
}

// Autentificare pe loc, când sesiunea expiră la salvare — formularul rămâne.
function ReLogin({ onDone }) {
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const go = async () => {
        if (!password || busy) return;
        setBusy(true);
        setErr('');
        try {
            await api.login(password);
            onDone();
        } catch (e) {
            setErr(e.message || 'Parolă greșită.');
            setBusy(false);
        }
    };
    return (
        <div className="relogin">
            <strong>Sesiunea a expirat.</strong>
            <p>Introdu parola ca să continui. Tot ce ai completat rămâne aici.</p>
            <div className="relogin-row">
                <input type="password" value={password} autoComplete="current-password"
                       placeholder="Parola de admin"
                       onChange={(e) => setPassword(e.target.value)}
                       onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } }} />
                <button type="button" className="btn btn--primary" onClick={go} disabled={busy || !password}>
                    {busy ? 'Se verifică…' : 'Autentifică-te și salvează'}
                </button>
            </div>
            {err && <div className="field-hint is-bad">{err}</div>}
        </div>
    );
}

export default function CarForm() {
    const { id } = useParams();
    const isEdit = !!id && id !== 'nou';
    const navigate = useNavigate();

    const [options, setOptions] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [reloadKey, setReloadKey] = useState(0);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState([]);
    const [conflict, setConflict] = useState(false);
    const [needLogin, setNeedLogin] = useState(false);
    const [toast, setToast] = useState(null);

    const [f, setF] = useState(EMPTY);
    const [media, setMedia] = useState([]);
    const [initialMedia, setInitialMedia] = useState([]);
    const [savedIds, setSavedIds] = useState([]);
    // id-urile pozelor pe care serverul le-a raportat ca lipsă din B2 (409)
    const [brokenIds, setBrokenIds] = useState([]);
    const [upload, setUpload] = useState({ pending: 0, failed: 0 });
    const [draftId, setDraftId] = useState(() => (isEdit ? id : newDraftId()));
    const [uploaderKey, setUploaderKey] = useState(0);
    const [offerDraft, setOfferDraft] = useState(null);   // ciornă găsită pe dispozitiv

    const versionRef = useRef(null);   // updated_at al mașinii încărcate
    const baseline = useRef('');       // starea „curată", pentru detectarea modificărilor
    const savingRef = useRef(false);
    const doneRef = useRef(false);     // salvat cu succes — nu mai avertizăm la ieșire

    const set = (k, v) => setF((prev) => ({ ...prev, [k]: v }));

    // La editare, folderul pozelor noi = id-ul mașinii (și dacă ruta se schimbă).
    useEffect(() => { if (isEdit && draftId !== id) setDraftId(id); }, [isEdit, id, draftId]);

    // ── Încărcare: opțiuni + (la editare) mașina ────────────────────────────
    useEffect(() => {
        let alive = true;
        setLoading(true);
        setLoadError('');
        (async () => {
            try {
                const opt = await api.options();
                if (!alive) return;
                setOptions(opt.options);

                if (isEdit) {
                    const r = await api.getCar(id);
                    if (!alive) return;
                    const c = r.car;
                    const nf = {
                        title: str(c.title), brand: str(c.brand),
                        production_year: str(c.production_year), price: str(c.price),
                        negotiable: !!c.negotiable, mileage: str(c.mileage),
                        fuel: str(c.fuel), engine_capacity: str(c.engine_capacity),
                        horsepower: str(c.horsepower), pollution_standard: str(c.pollution_standard),
                        body_type: str(c.body_type), color: str(c.color),
                        transmission: str(c.transmission), drivetrain: str(c.drivetrain),
                        steering_wheel: c.steering_wheel || 'left', vin: str(c.vin),
                        registration_status: str(c.registration_status),
                        for_dismantling: !!c.for_dismantling, description: str(c.description),
                        phone: c.phone ? formatPhoneDisplay(c.phone) : '',
                        status: c.status || 'published',
                    };
                    const m = (c.media || []).map((x) => ({ id: x.id, ext: x.ext, w: x.w, h: x.h, dir: x.dir }));
                    setF(nf);
                    setMedia(m);
                    setInitialMedia(m);
                    setSavedIds(m.map((x) => x.id));
                    setBrokenIds([]);
                    versionRef.current = c.updated_at || null;
                    baseline.current = JSON.stringify({ f: nf, media: m.map((x) => x.id) });
                } else {
                    baseline.current = JSON.stringify({ f: EMPTY, media: [] });
                    const d = readDraft();
                    if (d && hasContent(d.f, d.media)) setOfferDraft(d);
                }
            } catch (err) {
                if (!alive) return;
                setLoadError(err.status === 401
                    ? 'Sesiunea a expirat. Reîncarcă pagina și autentifică-te din nou.'
                    : (err.message || 'Nu am putut încărca formularul.'));
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, reloadKey]);

    // ── Modificări nesalvate ────────────────────────────────────────────────
    const snapshot = JSON.stringify({ f, media: media.map((x) => x.id) });
    const dirty = !loading && !loadError && !offerDraft &&
        (snapshot !== baseline.current || upload.pending > 0);
    const leaveMsg = isEdit
        ? 'Ai modificări nesalvate. Ieși fără să le salvezi?'
        : 'Anunțul nu e salvat încă. Rămâne ca ciornă pe acest dispozitiv și îl poți continua data viitoare. Ieși?';

    // Ciorna locală a anunțului nou, salvată la fiecare modificare.
    useEffect(() => {
        if (isEdit || loading || offerDraft || doneRef.current) return;
        const t = setTimeout(() => {
            if (doneRef.current) return;
            if (hasContent(f, media)) writeDraft({ savedAt: Date.now(), draftId, f, media });
            else clearDraft();
        }, 400);
        return () => clearTimeout(t);
    }, [f, media, isEdit, loading, offerDraft, draftId]);

    // Închiderea tabului / reîncărcarea paginii cu modificări nesalvate.
    useEffect(() => {
        if (!dirty) return;
        const onBeforeUnload = (e) => {
            if (doneRef.current) return;
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [dirty]);

    // Linkurile din meniul panoului (Mașini, Setări) și butonul Ieși.
    useEffect(() => {
        if (!dirty) return;
        const onClick = (e) => {
            if (doneRef.current || e.defaultPrevented || e.button !== 0 ||
                e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            const el = e.target.closest?.('a[href], [data-leave]');
            if (!el || el.target === '_blank') return;
            if (!window.confirm(leaveMsg)) {
                e.preventDefault();
                e.stopPropagation();
            }
        };
        document.addEventListener('click', onClick, true);
        return () => document.removeEventListener('click', onClick, true);
    }, [dirty, leaveMsg]);

    const goBack = () => {
        if (!dirty || doneRef.current || window.confirm(leaveMsg)) navigate('/');
    };

    // ── Ciornă găsită pe dispozitiv ─────────────────────────────────────────
    const restoreDraft = () => {
        const d = offerDraft;
        const m = Array.isArray(d.media) ? d.media : [];
        setF({ ...EMPTY, ...d.f });
        setMedia(m);
        setInitialMedia(m);
        setSavedIds([]);   // pozele ciornei nu sunt încă pe niciun anunț
        setDraftId(d.draftId || newDraftId());
        setUploaderKey((k) => k + 1);
        setOfferDraft(null);
    };
    const discardDraft = () => {
        const d = offerDraft;
        // Pozele ciornei nu sunt pe niciun anunț — le ștergem. (Serverul refuză
        // oricum ștergerea unei poze care face parte dintr-un anunț salvat.)
        for (const m of (Array.isArray(d.media) ? d.media : [])) {
            if (m && m.id) api.deleteMedia(m.dir || d.draftId, `${m.id}.${m.ext || 'jpg'}`).catch(() => {});
        }
        clearDraft();
        setOfferDraft(null);
    };

    // ── Combustibil electric ⇔ capacitate „Fără (Electric)" ────────────────
    const onFuelChange = (v) => {
        set('fuel', v);
        if (v === 'Electric') set('engine_capacity', 'Fără (Electric)');
        else if (f.engine_capacity === 'Fără (Electric)') set('engine_capacity', '');
    };
    const onCapChange = (v) => {
        set('engine_capacity', v);
        if (v === 'Fără (Electric)') set('fuel', 'Electric');
    };

    // ── Validare în client (aceleași reguli ca serverul) ────────────────────
    const limits = options?.limits || { title: 80, description: 4000 };
    const priceP = parseWholeNumber(f.price);
    const kmP = parseWholeNumber(f.mileage);
    const hpP = parseWholeNumber(f.horsepower);
    const phoneNorm = normalizePhone(f.phone);
    const phoneOk = !f.phone.trim() || isValidPhone(phoneNorm);

    const validate = () => {
        const e = [];
        if (!f.title.trim()) e.push('Titlul este obligatoriu.');
        else if (f.title.length > limits.title) e.push(`Titlul depășește ${limits.title} de caractere.`);
        if (!f.brand) e.push('Alege marca.');
        if (!f.production_year) e.push('Alege anul.');

        if (priceP.error) e.push('Prețul: scrie un număr întreg, fără zecimale (ex. 4300 sau 4.300).');
        else if (!priceP.value || priceP.value <= 0) e.push('Completează prețul.');
        else if (priceP.value > MAX_PRICE) e.push('Prețul pare greșit — verifică zerourile.');

        if (kmP.error) e.push('Kilometrajul: scrie un număr întreg, fără zecimale (ex. 266500).');
        else if (kmP.value === null || kmP.value < 0) e.push('Completează kilometrajul.');
        else if (kmP.value > MAX_MILEAGE) e.push('Kilometrajul pare greșit — verifică zerourile.');

        if (hpP.error || (hpP.value !== null && (hpP.value < 0 || hpP.value > 2000))) e.push('Puterea are o valoare nevalidă.');

        if (!f.fuel) e.push('Alege combustibilul.');
        if (!f.engine_capacity) e.push('Alege capacitatea motorului.');
        if (!f.pollution_standard) e.push('Alege norma de poluare.');
        if (!f.body_type) e.push('Alege caroseria.');
        if (!f.color) e.push('Alege culoarea.');
        if (!f.transmission) e.push('Alege cutia de viteze.');
        if (!f.drivetrain) e.push('Alege tracțiunea.');
        if (!f.registration_status) e.push('Alege starea înmatriculării.');
        if (f.description.length > limits.description) e.push(`Descrierea depășește ${limits.description} de caractere.`);
        if (!phoneOk) e.push('Numărul de telefon nu pare corect (ex. 0753 637 151).');

        if (upload.pending > 0) e.push('Așteaptă să se termine încărcarea pozelor.');
        if (upload.failed > 0) e.push(upload.failed === 1
            ? 'O poză nu s-a încărcat. Apasă ↻ pe ea ca să reîncerci, sau ✕ ca s-o scoți.'
            : `${upload.failed} poze nu s-au încărcat. Apasă ↻ pe ele ca să reîncerci, sau ✕ ca să le scoți.`);
        return e;
    };

    const submit = async (e) => {
        e?.preventDefault?.();
        if (savingRef.current || doneRef.current) return;
        const errs = validate();
        if (errs.length) {
            setErrors(errs);
            scrollTop();
            return;
        }
        setErrors([]);
        setConflict(false);
        setNeedLogin(false);
        savingRef.current = true;
        setSaving(true);
        try {
            const payload = {
                ...f,
                price: priceP.value,
                mileage: kmP.value,
                horsepower: hpP.value ?? '',
                media,
            };
            let message;
            if (isEdit) {
                await api.updateCar(id, { ...payload, updated_at: versionRef.current });
                message = 'Mașina a fost salvată.';
            } else {
                const r = await api.createCar(payload);
                message = r?.already ? 'Anunțul era deja salvat.' : 'Mașina a fost adăugată.';
            }
            doneRef.current = true;
            if (!isEdit) clearDraft();
            setToast({ type: 'ok', message });
            // `saving` rămâne activ: butonul nu mai poate fi apăsat până la redirect
            setTimeout(() => navigate('/'), 700);
        } catch (err) {
            savingRef.current = false;
            setSaving(false);
            if (err.status === 401) {
                setNeedLogin(true);
                scrollTop();
                return;
            }
            if (err.data?.conflict) setConflict(true);
            setErrors(err.errors && err.errors.length ? err.errors : [err.message]);
            setBrokenIds(err.data?.missing_media || []);
            scrollTop();
        }
    };

    const reloadFromServer = () => {
        setConflict(false);
        setErrors([]);
        setUploaderKey((k) => k + 1);
        setReloadKey((k) => k + 1);
    };

    // ── Randare ─────────────────────────────────────────────────────────────
    if (loading) return <AdminLayout><Loading /></AdminLayout>;

    if (loadError || !options) {
        return (
            <AdminLayout>
                <div className="page-head">
                    <h1>{isEdit ? 'Editează mașina' : 'Adaugă mașină'}</h1>
                </div>
                <div className="form-error" style={{ marginBottom: '1.2rem' }}>
                    {loadError || 'Nu am putut încărca formularul.'}
                </div>
                <div className="form-actions form-actions--static">
                    <button className="btn btn--ghost" type="button" onClick={() => navigate('/')}>Înapoi la mașini</button>
                    <button className="btn btn--primary" type="button" onClick={() => setReloadKey((k) => k + 1)}>Reîncearcă</button>
                </div>
            </AdminLayout>
        );
    }

    if (offerDraft) {
        const n = Array.isArray(offerDraft.media) ? offerDraft.media.length : 0;
        return (
            <AdminLayout>
                <div className="page-head">
                    <h1>Adaugă mașină</h1>
                </div>
                <div className="draft-offer">
                    <h2>Ai un anunț început și nesalvat</h2>
                    <p>
                        <strong>{offerDraft.f.title?.trim() || 'Fără titlu'}</strong>
                        {' · '}{n === 1 ? '1 poză' : `${n} poze`}
                        {offerDraft.savedAt ? ` · ${fmtWhen(offerDraft.savedAt)}` : ''}
                    </p>
                    <p className="field-hint">Dacă îl continui și unele poze au expirat între timp, le vei vedea marcate și le poți urca din nou.</p>
                    <div className="draft-offer-actions">
                        <button className="btn btn--primary" type="button" onClick={restoreDraft}>Continuă anunțul</button>
                        <button className="btn btn--ghost" type="button" onClick={discardDraft}>Începe unul nou</button>
                    </div>
                </div>
            </AdminLayout>
        );
    }

    const submitLabel = saving ? 'Se salvează…'
        : upload.pending > 0 ? `Se încarcă pozele (${upload.pending})…`
            : isEdit ? 'Salvează modificările'
                : f.status === 'draft' ? 'Salvează ciorna' : 'Publică anunțul';

    return (
        <AdminLayout>
            <div className="page-head">
                <h1>{isEdit ? 'Editează mașina' : 'Adaugă mașină'}</h1>
                <button className="btn btn--ghost" type="button" onClick={goBack}>Înapoi</button>
            </div>

            {needLogin && (
                <ReLogin onDone={() => { setNeedLogin(false); submit(); }} />
            )}

            {errors.length > 0 && (
                <div className="form-error" style={{ marginBottom: '1.2rem' }}>
                    <strong>Verifică:</strong>
                    <ul style={{ margin: '.4rem 0 0 1.2rem' }}>
                        {errors.map((er, i) => <li key={i}>{er}</li>)}
                    </ul>
                    {conflict && (
                        <button type="button" className="btn btn--ghost btn--sm" style={{ marginTop: '.8rem' }}
                                onClick={reloadFromServer}>
                            Reîncarcă anunțul (modificările de aici se pierd)
                        </button>
                    )}
                </div>
            )}

            <form onSubmit={submit} className="car-form" noValidate>

                {/* ── Poze ── */}
                <section className="form-section">
                    <h2>Fotografii</h2>
                    <PhotoUploader key={uploaderKey}
                                   draftId={draftId}
                                   initial={initialMedia}
                                   savedIds={savedIds}
                                   brokenIds={brokenIds}
                                   onChange={setMedia}
                                   onStatusChange={setUpload}
                                   apiBase={API_BASE} />
                </section>

                {/* ── Identificare ── */}
                <section className="form-section">
                    <h2>Detalii principale</h2>
                    <label className="field">
                        <span>Titlu anunț * <em className="ch">{f.title.length}/{limits.title}</em></span>
                        <input value={f.title} maxLength={limits.title}
                               onChange={(e) => set('title', e.target.value)}
                               placeholder="ex. BMW Seria 3 320d xDrive M-Pachet" />
                    </label>
                    <div className="form-row">
                        <Sel label="Marcă" value={f.brand} list={options.brands} onChange={(v) => set('brand', v)} required />
                        <Sel label="An fabricație" value={f.production_year} list={options.years} onChange={(v) => set('production_year', v)} required />
                    </div>
                    <div className="form-row">
                        <label className="field">
                            <span>Preț (€) *</span>
                            <input type="text" inputMode="numeric" autoComplete="off" value={f.price}
                                   onChange={(e) => set('price', e.target.value)} placeholder="ex. 18500" />
                            {f.price.trim() !== '' && (
                                <span className={`field-hint${priceP.error || priceP.value > MAX_PRICE ? ' is-bad' : ''}`}>
                                    {priceP.error ? 'Fără zecimale — ex. 4300 sau 4.300'
                                        : priceP.value > MAX_PRICE ? 'Prea mare — verifică zerourile'
                                            : priceP.value ? `Pe site: ${fmtNumber(priceP.value)} €` : ''}
                                </span>
                            )}
                        </label>
                        <label className="field">
                            <span>Kilometraj *</span>
                            <input type="text" inputMode="numeric" autoComplete="off" value={f.mileage}
                                   onChange={(e) => set('mileage', e.target.value)} placeholder="ex. 143000" />
                            {f.mileage.trim() !== '' && (
                                <span className={`field-hint${kmP.error || kmP.value > MAX_MILEAGE ? ' is-bad' : ''}`}>
                                    {kmP.error ? 'Fără zecimale — ex. 266500 sau 266.500'
                                        : kmP.value > MAX_MILEAGE ? 'Prea mare — verifică zerourile'
                                            : kmP.value !== null ? `Pe site: ${fmtNumber(kmP.value)} km` : ''}
                                </span>
                            )}
                        </label>
                    </div>
                    <label className="check">
                        <input type="checkbox" checked={f.negotiable}
                               onChange={(e) => set('negotiable', e.target.checked)} />
                        <span>Preț negociabil</span>
                    </label>
                </section>

                {/* ── Motor ── */}
                <section className="form-section">
                    <h2>Motor</h2>
                    <div className="form-row">
                        <Sel label="Combustibil" value={f.fuel} list={options.fuel_types} onChange={onFuelChange} required />
                        <Sel label="Capacitate motor" value={f.engine_capacity} list={options.engine_capacities} onChange={onCapChange} required />
                    </div>
                    <div className="form-row">
                        <label className="field">
                            <span>Putere (CP)</span>
                            <input type="text" inputMode="numeric" autoComplete="off" value={f.horsepower}
                                   onChange={(e) => set('horsepower', e.target.value)} placeholder="opțional" />
                        </label>
                        <Sel label="Normă poluare" value={f.pollution_standard} list={options.pollution_standards}
                             onChange={(v) => set('pollution_standard', v)} required />
                    </div>
                </section>

                {/* ── Caroserie și mecanică ── */}
                <section className="form-section">
                    <h2>Caroserie și mecanică</h2>
                    <div className="form-row">
                        <Sel label="Caroserie" value={f.body_type} list={options.body_types} onChange={(v) => set('body_type', v)} required />
                        <Sel label="Culoare" value={f.color} list={options.colors} onChange={(v) => set('color', v)} required />
                    </div>
                    <div className="form-row">
                        <Sel label="Cutie de viteze" value={f.transmission} list={options.transmissions} onChange={(v) => set('transmission', v)} required />
                        <Sel label="Tracțiune" value={f.drivetrain} list={options.drivetrains} onChange={(v) => set('drivetrain', v)} required />
                    </div>
                    <div className="form-row">
                        <Sel label="Volan" value={f.steering_wheel} list={options.steering} onChange={(v) => set('steering_wheel', v)} />
                        <Sel label="Înmatriculare" value={f.registration_status} list={options.registration_status}
                             onChange={(v) => set('registration_status', v)} required />
                    </div>
                    <label className="field">
                        <span>Serie șasiu (VIN)</span>
                        <input value={f.vin} maxLength={17}
                               onChange={(e) => set('vin', e.target.value.toUpperCase())}
                               placeholder="opțional" />
                    </label>
                    <label className="check">
                        <input type="checkbox" checked={f.for_dismantling}
                               onChange={(e) => set('for_dismantling', e.target.checked)} />
                        <span>Pentru dezmembrare</span>
                    </label>
                </section>

                {/* ── Descriere ── */}
                <section className="form-section">
                    <h2>Descriere</h2>
                    <label className="field">
                        <span>Detalii <em className="ch">{f.description.length}/{limits.description}</em></span>
                        <textarea rows="7" value={f.description} maxLength={limits.description}
                                  onChange={(e) => set('description', e.target.value)}
                                  placeholder="Istoric, dotări, stare tehnică, motive de vânzare…" />
                    </label>
                    <label className="field">
                        <span>Telefon pentru acest anunț</span>
                        <input type="tel" inputMode="tel" autoComplete="off" value={f.phone}
                               onChange={(e) => set('phone', e.target.value)}
                               placeholder="Lasă gol pentru numărul principal al parcului" />
                        <span className={`field-hint${phoneOk ? '' : ' is-bad'}`}>
                            {!f.phone.trim()
                                ? 'Gol = se afișează numărul principal din Setări (și se actualizează dacă îl schimbi acolo).'
                                : phoneOk ? `Pe site: ${formatPhoneDisplay(f.phone)}` : 'Număr incomplet sau greșit — ex. 0753 637 151'}
                        </span>
                    </label>
                </section>

                {/* ── Publicare ── */}
                <section className="form-section">
                    <h2>Publicare</h2>
                    <label className="field">
                        <span>Stare anunț</span>
                        <select value={f.status} onChange={(e) => set('status', e.target.value)}>
                            <option value="published">Publicat — apare pe site</option>
                            <option value="draft">Ciornă — nu apare pe site</option>
                            {(isEdit || f.status === 'sold') && <option value="sold">Vândut — scos din stoc, pagina arată „Vândut”</option>}
                        </select>
                    </label>
                </section>

                <div className="form-actions">
                    <button className="btn btn--ghost" type="button" onClick={goBack}>Anulează</button>
                    <button className="btn btn--primary" type="submit" disabled={saving || upload.pending > 0}>
                        {submitLabel}
                    </button>
                </div>
            </form>

            {toast && <Toast type={toast.type} message={toast.message} />}
        </AdminLayout>
    );
}
