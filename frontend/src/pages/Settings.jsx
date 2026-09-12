// ============================================================================
//  src/pages/Settings.jsx — editarea setărilor site-ului
// ----------------------------------------------------------------------------
//  Patronul editează: numele afișat, cele două numere (cu etichete), WhatsApp,
//  email, textele de pe acasă (hero, servicii, despre) și intro-ul de contact.
//
//  Ce NU poate edita de aici: adresa, coordonatele, programul, datele de firmă.
//  Acelea rămân fixe — se schimbă din cod. Fiecare câmp are contor de caractere.
// ============================================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { AdminLayout, Loading, Toast } from '../components/ui.jsx';

export default function Settings() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [limits, setLimits] = useState({});
    const [errors, setErrors] = useState([]);
    const [toast, setToast] = useState(null);

    const [f, setF] = useState({
        display_name: '', phone_primary: '', phone_secondary: '',
        phone_primary_label: '', phone_secondary_label: '', whatsapp: '', email: '',
        hero_title: '', hero_subtitle: '', services_title: '',
        about_title: '', about_text: '', contact_intro: '',
        services: [{ title: '', text: '' }, { title: '', text: '' }, { title: '', text: '' }],
    });
    const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
    const setSvc = (i, k, v) => setF((p) => {
        const services = p.services.map((s, idx) => idx === i ? { ...s, [k]: v } : s);
        return { ...p, services };
    });

    useEffect(() => {
        let alive = true;
        api.getSettings()
            .then((r) => {
                if (!alive) return;
                setLimits(r.limits || {});
                const s = r.settings;
                const svc = Array.isArray(s.services) && s.services.length === 3
                    ? s.services
                    : [{ title: '', text: '' }, { title: '', text: '' }, { title: '', text: '' }];
                setF({
                    display_name: s.display_name || '',
                    phone_primary: local(s.phone_primary), phone_secondary: local(s.phone_secondary),
                    phone_primary_label: s.phone_primary_label || '',
                    phone_secondary_label: s.phone_secondary_label || '',
                    whatsapp: local(s.whatsapp), email: s.email || '',
                    hero_title: s.hero_title || '', hero_subtitle: s.hero_subtitle || '',
                    services_title: s.services_title || '',
                    about_title: s.about_title || '', about_text: s.about_text || '',
                    contact_intro: s.contact_intro || '',
                    services: svc,
                });
            })
            .catch((err) => setToast({ type: 'err', message: err.message }))
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, []);

    const submit = async (e) => {
        e.preventDefault();
        if (saving) return;
        setErrors([]);
        // dacă toate serviciile sunt goale, trimitem [] (secțiune dezactivată)
        const filledSvc = f.services.filter((s) => s.title.trim() || s.text.trim());
        const services = filledSvc.length === 0 ? [] : f.services;
        setSaving(true);
        try {
            await api.updateSettings({ ...f, services });
            setToast({ type: 'ok', message: 'Setările au fost salvate.' });
        } catch (err) {
            setErrors(err.errors && err.errors.length ? err.errors : [err.message]);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <AdminLayout><Loading /></AdminLayout>;

    // câmp text cu contor
    const Field = ({ label, k, max, ph, textarea, rows }) => (
        <label className="field">
            <span>{label} {max && <em className="ch">{(f[k] || '').length}/{max}</em>}</span>
            {textarea
                ? <textarea rows={rows || 4} value={f[k]} maxLength={max}
                            onChange={(e) => set(k, e.target.value)} placeholder={ph} />
                : <input value={f[k]} maxLength={max}
                         onChange={(e) => set(k, e.target.value)} placeholder={ph} />}
        </label>
    );

    return (
        <AdminLayout>
            <div className="page-head">
                <h1>Setări site</h1>
                <button className="btn btn--ghost" type="button" onClick={() => navigate('/')}>Înapoi</button>
            </div>

            {errors.length > 0 && (
                <div className="form-error" style={{ marginBottom: '1.2rem' }}>
                    <strong>Verifică:</strong>
                    <ul style={{ margin: '.4rem 0 0 1.2rem' }}>{errors.map((er, i) => <li key={i}>{er}</li>)}</ul>
                </div>
            )}

            <form onSubmit={submit} className="car-form" noValidate>

                <section className="form-section">
                    <h2>Identitate</h2>
                    <Field label="Nume afișat" k="display_name" max={limits.display_name} ph="Vanzari Auto Park" />
                    <p className="field-hint">Apare în antet, footer și pe toate paginile.</p>
                </section>

                <section className="form-section">
                    <h2>Telefoane</h2>
                    <div className="form-row">
                        <Field label="Telefon principal" k="phone_primary" ph="0753637151" />
                        <Field label="Nume persoană" k="phone_primary_label" max={limits.phone_primary_label} ph="Bogdan" />
                    </div>
                    <div className="form-row">
                        <Field label="Telefon secundar" k="phone_secondary" ph="0725644944" />
                        <Field label="Nume persoană" k="phone_secondary_label" max={limits.phone_secondary_label} ph="Florin" />
                    </div>
                    <div className="form-row">
                        <Field label="WhatsApp" k="whatsapp" ph="0753637151" />
                        <Field label="Email" k="email" ph="contact@..." />
                    </div>
                    <p className="field-hint">Numărul principal se completează automat la anunțuri noi.</p>
                </section>

                <section className="form-section">
                    <h2>Pagina de start</h2>
                    <Field label="Titlu principal (hero)" k="hero_title" max={limits.hero_title}
                           ph="Mașini verificate, pentru drumuri perfecte" />
                    <Field label="Subtitlu (hero)" k="hero_subtitle" max={limits.hero_subtitle} textarea rows={2}
                           ph="Parc auto la intrarea în Botoșani…" />
                </section>

                <section className="form-section">
                    <h2>Servicii</h2>
                    <Field label="Titlu secțiune" k="services_title" max={limits.services_title}
                           ph="Servicii care fac diferența" />
                    <p className="field-hint">Completează toate trei, sau lasă-le goale ca să ascunzi secțiunea.</p>
                    {f.services.map((s, i) => (
                        <div className="svc-edit" key={i}>
                            <label className="field">
                                <span>Serviciu {i + 1} — titlu <em className="ch">{s.title.length}/{limits.svc_title || 40}</em></span>
                                <input value={s.title} maxLength={limits.svc_title || 40}
                                       onChange={(e) => setSvc(i, 'title', e.target.value)}
                                       placeholder={['Rate prin TBI Bank', 'Mașini la comandă', 'Verificate, cu încredere'][i]} />
                            </label>
                            <label className="field" style={{ marginBottom: 0 }}>
                                <span>Descriere <em className="ch">{s.text.length}/{limits.svc_text || 200}</em></span>
                                <textarea rows={2} value={s.text} maxLength={limits.svc_text || 200}
                                          onChange={(e) => setSvc(i, 'text', e.target.value)} />
                            </label>
                        </div>
                    ))}
                </section>

                <section className="form-section">
                    <h2>Despre noi și contact</h2>
                    <Field label="Titlu „Despre noi”" k="about_title" max={limits.about_title} ph="Cine suntem" />
                    <Field label="Text „Despre noi”" k="about_text" max={limits.about_text} textarea rows={5}
                           ph="Câteva cuvinte despre parc…" />
                    <Field label="Intro pagina de contact" k="contact_intro" max={limits.contact_intro} textarea rows={3}
                           ph="Ne găsești la intrarea în Botoșani…" />
                </section>

                <div className="form-actions">
                    <button className="btn btn--ghost" type="button" onClick={() => navigate('/')}>Anulează</button>
                    <button className="btn btn--primary" type="submit" disabled={saving}>
                        {saving ? 'Se salvează…' : 'Salvează setările'}
                    </button>
                </div>
            </form>

            {toast && <Toast type={toast.type} message={toast.message} />}
        </AdminLayout>
    );
}

// 40761930497 → 0761930497 (pentru afișare în formular)
function local(v) {
    const d = String(v || '').replace(/\D/g, '');
    if (d.startsWith('40') && d.length === 11) return '0' + d.slice(2);
    return v || '';
}
