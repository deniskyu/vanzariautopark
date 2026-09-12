// ============================================================================
//  src/pages/CarForm.jsx — adăugare și editare mașină
// ----------------------------------------------------------------------------
//  Aceeași pagină pentru „nou" și „editare" (distinge după :id din rută).
//  Opțiunile pentru dropdown-uri vin de la /admin/options (listele hardcodate).
//  Validarea se face și în client (feedback imediat) și pe server (autoritate).
//
//  La adăugare, pozele se urcă sub un draft_id temporar; la salvare, lista de
//  media se trimite în anunț. La editare, draft_id = id-ul mașinii.
// ============================================================================

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { AdminLayout, Loading, Toast } from '../components/ui.jsx';
import PhotoUploader from '../components/PhotoUploader.jsx';

const API_BASE = import.meta.env.VITE_API_URL || '';

// id temporar de draft pentru pozele unei mașini noi
const newDraftId = () => 'draft_' + Math.random().toString(36).slice(2, 10);

export default function CarForm() {
    const { id } = useParams();
    const isEdit = id && id !== 'nou';
    const navigate = useNavigate();

    const [options, setOptions] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState([]);
    const [toast, setToast] = useState(null);
    const [media, setMedia] = useState([]);
    const draftId = useRef(isEdit ? id : newDraftId()).current;

    // valorile formularului
    const [f, setF] = useState({
        title: '', brand: '', production_year: '', price: '', negotiable: false,
        mileage: '', fuel: '', engine_capacity: '', horsepower: '',
        pollution_standard: '', body_type: '', color: '', transmission: '',
        drivetrain: '', steering_wheel: 'left', vin: '', registration_status: '',
        for_dismantling: false, description: '', phone: '', status: 'published',
    });
    const set = (k, v) => setF((prev) => ({ ...prev, [k]: v }));

    // încărcăm opțiunile + (la editare) mașina
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const opt = await api.options();
                if (!alive) return;
                setOptions(opt.options);

                if (isEdit) {
                    const r = await api.getCar(id);
                    if (!alive) return;
                    const c = r.car;
                    setF({
                        title: c.title || '', brand: c.brand || '',
                        production_year: c.production_year || '', price: c.price || '',
                        negotiable: !!c.negotiable, mileage: c.mileage || '',
                        fuel: c.fuel || '', engine_capacity: c.engine_capacity || '',
                        horsepower: c.horsepower || '', pollution_standard: c.pollution_standard || '',
                        body_type: c.body_type || '', color: c.color || '',
                        transmission: c.transmission || '', drivetrain: c.drivetrain || '',
                        steering_wheel: c.steering_wheel || 'left', vin: c.vin || '',
                        registration_status: c.registration_status || '',
                        for_dismantling: !!c.for_dismantling, description: c.description || '',
                        phone: c.phone || '', status: c.status || 'published',
                    });
                    setMedia((c.media || []).map((m) => ({ id: m.id, ext: m.ext, w: m.w, h: m.h, dir: m.dir })));
                }
            } catch (err) {
                setToast({ type: 'err', message: err.message });
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const limits = options?.limits || { title: 80, description: 4000 };

    // combustibil electric ⇔ capacitate „Fără (Electric)"
    const onFuelChange = (v) => {
        set('fuel', v);
        if (v === 'Electric') set('engine_capacity', 'Fără (Electric)');
        else if (f.engine_capacity === 'Fără (Electric)') set('engine_capacity', '');
    };
    const onCapChange = (v) => {
        set('engine_capacity', v);
        if (v === 'Fără (Electric)') set('fuel', 'Electric');
    };

    // validare în client (aceleași reguli ca serverul, pentru feedback rapid)
    const validate = () => {
        const e = [];
        if (!f.title.trim()) e.push('Titlul este obligatoriu.');
        else if (f.title.length > limits.title) e.push(`Titlul depășește ${limits.title} de caractere.`);
        if (!f.brand) e.push('Alege marca.');
        if (!f.production_year) e.push('Alege anul.');
        if (!f.price || Number(f.price) <= 0) e.push('Prețul trebuie să fie pozitiv.');
        if (f.mileage === '' || Number(f.mileage) < 0) e.push('Completează kilometrajul.');
        if (!f.fuel) e.push('Alege combustibilul.');
        if (!f.engine_capacity) e.push('Alege capacitatea motorului.');
        if (!f.pollution_standard) e.push('Alege norma de poluare.');
        if (!f.body_type) e.push('Alege caroseria.');
        if (!f.color) e.push('Alege culoarea.');
        if (!f.transmission) e.push('Alege cutia de viteze.');
        if (!f.drivetrain) e.push('Alege tracțiunea.');
        if (!f.registration_status) e.push('Alege starea înmatriculării.');
        if (f.description.length > limits.description) e.push(`Descrierea depășește ${limits.description} de caractere.`);
        return e;
    };

    const submit = async (e) => {
        e.preventDefault();
        if (saving) return;
        const errs = validate();
        if (errs.length) {
            setErrors(errs);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        setErrors([]);
        setSaving(true);
        try {
            const payload = { ...f, media };
            if (isEdit) {
                await api.updateCar(id, payload);
                setToast({ type: 'ok', message: 'Mașina a fost salvată.' });
            } else {
                await api.createCar(payload);
                setToast({ type: 'ok', message: 'Mașina a fost adăugată.' });
            }
            setTimeout(() => navigate('/'), 700);
        } catch (err) {
            setErrors(err.errors && err.errors.length ? err.errors : [err.message]);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <AdminLayout><Loading /></AdminLayout>;

    const Sel = ({ label, k, list, onChange, required }) => (
        <label className="field">
            <span>{label}{required && ' *'}</span>
            <select value={f[k]} onChange={(ev) => (onChange || ((v) => set(k, v)))(ev.target.value)}>
                <option value="">Alege…</option>
                {(list || []).map((o) =>
                    typeof o === 'string' || typeof o === 'number'
                        ? <option key={o} value={o}>{o}</option>
                        : <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        </label>
    );

    return (
        <AdminLayout>
            <div className="page-head">
                <h1>{isEdit ? 'Editează mașina' : 'Adaugă mașină'}</h1>
                <button className="btn btn--ghost" type="button" onClick={() => navigate('/')}>Înapoi</button>
            </div>

            {errors.length > 0 && (
                <div className="form-error" style={{ marginBottom: '1.2rem' }}>
                    <strong>Verifică:</strong>
                    <ul style={{ margin: '.4rem 0 0 1.2rem' }}>
                        {errors.map((er, i) => <li key={i}>{er}</li>)}
                    </ul>
                </div>
            )}

            <form onSubmit={submit} className="car-form" noValidate>

                {/* ── Poze ── */}
                <section className="form-section">
                    <h2>Fotografii</h2>
                    <PhotoUploader draftId={draftId} initial={media} onChange={setMedia} apiBase={API_BASE} />
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
                        <Sel label="Marcă" k="brand" list={options.brands} required />
                        <Sel label="An fabricație" k="production_year" list={options.years} required />
                    </div>
                    <div className="form-row">
                        <label className="field">
                            <span>Preț (€) *</span>
                            <input type="number" inputMode="numeric" min="0" value={f.price}
                                   onChange={(e) => set('price', e.target.value)} placeholder="ex. 18500" />
                        </label>
                        <label className="field">
                            <span>Kilometraj *</span>
                            <input type="number" inputMode="numeric" min="0" value={f.mileage}
                                   onChange={(e) => set('mileage', e.target.value)} placeholder="ex. 143000" />
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
                        <Sel label="Combustibil" k="fuel" list={options.fuel_types} onChange={onFuelChange} required />
                        <Sel label="Capacitate motor" k="engine_capacity" list={options.engine_capacities} onChange={onCapChange} required />
                    </div>
                    <div className="form-row">
                        <label className="field">
                            <span>Putere (CP)</span>
                            <input type="number" inputMode="numeric" min="0" max="2000" value={f.horsepower}
                                   onChange={(e) => set('horsepower', e.target.value)} placeholder="opțional" />
                        </label>
                        <Sel label="Normă poluare" k="pollution_standard" list={options.pollution_standards} required />
                    </div>
                </section>

                {/* ── Caroserie și mecanică ── */}
                <section className="form-section">
                    <h2>Caroserie și mecanică</h2>
                    <div className="form-row">
                        <Sel label="Caroserie" k="body_type" list={options.body_types} required />
                        <Sel label="Culoare" k="color" list={options.colors} required />
                    </div>
                    <div className="form-row">
                        <Sel label="Cutie de viteze" k="transmission" list={options.transmissions} required />
                        <Sel label="Tracțiune" k="drivetrain" list={options.drivetrains} required />
                    </div>
                    <div className="form-row">
                        <Sel label="Volan" k="steering_wheel" list={options.steering} />
                        <Sel label="Înmatriculare" k="registration_status" list={options.registration_status} required />
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
                        <input value={f.phone} onChange={(e) => set('phone', e.target.value)}
                               placeholder="Lasă gol pentru numărul principal al parcului" />
                    </label>
                </section>

                <div className="form-actions">
                    <button className="btn btn--ghost" type="button" onClick={() => navigate('/')}>Anulează</button>
                    <button className="btn btn--primary" type="submit" disabled={saving}>
                        {saving ? 'Se salvează…' : isEdit ? 'Salvează modificările' : 'Adaugă mașina'}
                    </button>
                </div>
            </form>

            {toast && <Toast type={toast.type} message={toast.message} />}
        </AdminLayout>
    );
}
