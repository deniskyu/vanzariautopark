// ============================================================================
// src/pages/Settings.jsx — editarea setărilor site-ului
// ============================================================================
// Patronul editează: numele afișat, cele două numere (cu etichete), WhatsApp,
// email, textele de pe acasă (hero, servicii, despre) și intro-ul de contact.
//
// Ce NU poate edita de aici: adresa, coordonatele, programul, datele de firmă.
// Acelea rămân fixe — se schimbă din cod. Fiecare câmp are contor de caractere.
// ============================================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { api } from '../api/client.js';
import { AdminLayout, Loading, Toast } from '../components/ui.jsx';

// ============================================================================
// Câmp text reutilizabil
//
// IMPORTANT:
// Field este definit în afara componentei Settings.
// Dacă ar fi definit în Settings, React ar crea o componentă nouă la fiecare
// re-render, iar inputul și-ar pierde focusul după fiecare caracter.
// ============================================================================

function Field({
    label,
    value,
    onChange,
    max,
    ph,
    textarea,
    rows,
}) {
    return (
        <label className="field">
            <span>
                {label}

                {max && (
                    <em className="ch">
                        {(value || '').length}/{max}
                    </em>
                )}
            </span>

            {textarea ? (
                <textarea
                    rows={rows || 4}
                    value={value || ''}
                    maxLength={max}
                    onChange={onChange}
                    placeholder={ph}
                />
            ) : (
                <input
                    value={value || ''}
                    maxLength={max}
                    onChange={onChange}
                    placeholder={ph}
                />
            )}
        </label>
    );
}

// ============================================================================
// Settings
// ============================================================================

export default function Settings() {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [limits, setLimits] = useState({});
    const [errors, setErrors] = useState([]);
    const [toast, setToast] = useState(null);

    const [f, setF] = useState({
        display_name: '',

        phone_primary: '',
        phone_secondary: '',
        phone_primary_label: '',
        phone_secondary_label: '',
        whatsapp: '',
        email: '',

        hero_title: '',
        hero_subtitle: '',

        services_title: '',

        about_title: '',
        about_text: '',

        contact_intro: '',

        services: [
            { title: '', text: '' },
            { title: '', text: '' },
            { title: '', text: '' },
        ],
    });

    // ------------------------------------------------------------------------
    // Setare câmp simplu
    // ------------------------------------------------------------------------

    const set = (k, v) => {
        setF((p) => ({
            ...p,
            [k]: v,
        }));
    };

    // ------------------------------------------------------------------------
    // Setare serviciu
    // ------------------------------------------------------------------------

    const setSvc = (i, k, v) => {
        setF((p) => {
            const services = p.services.map((s, idx) =>
                idx === i
                    ? { ...s, [k]: v }
                    : s
            );

            return {
                ...p,
                services,
            };
        });
    };

    // ------------------------------------------------------------------------
    // Citire setări
    // ------------------------------------------------------------------------

    useEffect(() => {
        let alive = true;

        api.getSettings()
            .then((r) => {
                if (!alive) return;

                setLimits(r.limits || {});

                const s = r.settings;

                const svc =
                    Array.isArray(s.services) && s.services.length === 3
                        ? s.services
                        : [
                            { title: '', text: '' },
                            { title: '', text: '' },
                            { title: '', text: '' },
                        ];

                setF({
                    display_name: s.display_name || '',

                    phone_primary: local(s.phone_primary),
                    phone_secondary: local(s.phone_secondary),

                    phone_primary_label:
                        s.phone_primary_label || '',

                    phone_secondary_label:
                        s.phone_secondary_label || '',

                    whatsapp: local(s.whatsapp),

                    email: s.email || '',

                    hero_title: s.hero_title || '',
                    hero_subtitle: s.hero_subtitle || '',

                    services_title: s.services_title || '',

                    about_title: s.about_title || '',
                    about_text: s.about_text || '',

                    contact_intro: s.contact_intro || '',

                    services: svc,
                });
            })
            .catch((err) => {
                if (!alive) return;

                setToast({
                    type: 'err',
                    message: err.message,
                });
            })
            .finally(() => {
                if (alive) {
                    setLoading(false);
                }
            });

        return () => {
            alive = false;
        };
    }, []);

    // ------------------------------------------------------------------------
    // Salvare
    // ------------------------------------------------------------------------

    const submit = async (e) => {
        e.preventDefault();

        if (saving) return;

        setErrors([]);

        // Dacă toate serviciile sunt goale, trimitem [].
        // Astfel secțiunea de servicii poate fi dezactivată.

        const filledSvc = f.services.filter(
            (s) => s.title.trim() || s.text.trim()
        );

        const services =
            filledSvc.length === 0
                ? []
                : f.services;

        setSaving(true);

        try {
            await api.updateSettings({
                ...f,
                services,
            });

            setToast({
                type: 'ok',
                message: 'Setările au fost salvate.',
            });
        } catch (err) {
            setErrors(
                err.errors && err.errors.length
                    ? err.errors
                    : [err.message]
            );

            window.scrollTo({
                top: 0,
                behavior: 'smooth',
            });
        } finally {
            setSaving(false);
        }
    };

    // ------------------------------------------------------------------------
    // Loading
    // ------------------------------------------------------------------------

    if (loading) {
        return (
            <AdminLayout>
                <Loading />
            </AdminLayout>
        );
    }

    // ------------------------------------------------------------------------
    // Render
    // ------------------------------------------------------------------------

    return (
        <AdminLayout>

            <div className="page-head">
                <h1>Setări site</h1>

                <button
                    className="btn btn--ghost"
                    type="button"
                    onClick={() => navigate('/')}
                >
                    Înapoi
                </button>
            </div>

            {errors.length > 0 && (
                <div
                    className="form-error"
                    style={{ marginBottom: '1.2rem' }}
                >
                    <strong>Verifică:</strong>

                    <ul
                        style={{
                            margin: '.4rem 0 0 1.2rem',
                        }}
                    >
                        {errors.map((er, i) => (
                            <li key={i}>{er}</li>
                        ))}
                    </ul>
                </div>
            )}

            <form
                onSubmit={submit}
                className="car-form"
                noValidate
            >

                {/* ============================================================
                   IDENTITATE
                ============================================================ */}

                <section className="form-section">
                    <h2>Identitate</h2>

                    <Field
                        label="Nume afișat"
                        value={f.display_name}
                        max={limits.display_name}
                        onChange={(e) =>
                            set('display_name', e.target.value)
                        }
                        ph="Vanzari Auto Park"
                    />

                    <p className="field-hint">
                        Apare în antet, footer și pe toate paginile.
                    </p>
                </section>

                {/* ============================================================
                   TELEFOANE
                ============================================================ */}

                <section className="form-section">
                    <h2>Telefoane</h2>

                    <div className="form-row">
                        <Field
                            label="Telefon principal"
                            value={f.phone_primary}
                            onChange={(e) =>
                                set(
                                    'phone_primary',
                                    e.target.value
                                )
                            }
                            ph="0753637151"
                        />

                        <Field
                            label="Nume persoană"
                            value={f.phone_primary_label}
                            max={limits.phone_primary_label}
                            onChange={(e) =>
                                set(
                                    'phone_primary_label',
                                    e.target.value
                                )
                            }
                            ph="Bogdan"
                        />
                    </div>

                    <div className="form-row">
                        <Field
                            label="Telefon secundar"
                            value={f.phone_secondary}
                            onChange={(e) =>
                                set(
                                    'phone_secondary',
                                    e.target.value
                                )
                            }
                            ph="0725644944"
                        />

                        <Field
                            label="Nume persoană"
                            value={f.phone_secondary_label}
                            max={limits.phone_secondary_label}
                            onChange={(e) =>
                                set(
                                    'phone_secondary_label',
                                    e.target.value
                                )
                            }
                            ph="Florin"
                        />
                    </div>

                    <div className="form-row">
                        <Field
                            label="WhatsApp"
                            value={f.whatsapp}
                            onChange={(e) =>
                                set(
                                    'whatsapp',
                                    e.target.value
                                )
                            }
                            ph="0753637151"
                        />

                        <Field
                            label="Email"
                            value={f.email}
                            onChange={(e) =>
                                set(
                                    'email',
                                    e.target.value
                                )
                            }
                            ph="contact@..."
                        />
                    </div>

                    <p className="field-hint">
                        Numărul principal se completează automat la anunțuri noi.
                    </p>
                </section>

                {/* ============================================================
                   PAGINA DE START
                ============================================================ */}

                <section className="form-section">
                    <h2>Pagina de start</h2>

                    <Field
                        label="Titlu principal (hero)"
                        value={f.hero_title}
                        max={limits.hero_title}
                        onChange={(e) =>
                            set(
                                'hero_title',
                                e.target.value
                            )
                        }
                        ph="Mașini verificate, pentru drumuri perfecte"
                    />

                    <Field
                        label="Subtitlu (hero)"
                        value={f.hero_subtitle}
                        max={limits.hero_subtitle}
                        onChange={(e) =>
                            set(
                                'hero_subtitle',
                                e.target.value
                            )
                        }
                        textarea
                        rows={2}
                        ph="Parc auto la intrarea în Botoșani…"
                    />
                </section>

                {/* ============================================================
                   SERVICII
                ============================================================ */}

                <section className="form-section">
                    <h2>Servicii</h2>

                    <Field
                        label="Titlu secțiune"
                        value={f.services_title}
                        max={limits.services_title}
                        onChange={(e) =>
                            set(
                                'services_title',
                                e.target.value
                            )
                        }
                        ph="Servicii care fac diferența"
                    />

                    <p className="field-hint">
                        Completează toate trei, sau lasă-le goale ca să ascunzi secțiunea.
                    </p>

                    {f.services.map((s, i) => (
                        <div
                            className="svc-edit"
                            key={i}
                        >
                            <label className="field">
                                <span>
                                    Serviciu {i + 1} — titlu

                                    <em className="ch">
                                        {s.title.length}/
                                        {limits.svc_title || 40}
                                    </em>
                                </span>

                                <input
                                    value={s.title}
                                    maxLength={
                                        limits.svc_title || 40
                                    }
                                    onChange={(e) =>
                                        setSvc(
                                            i,
                                            'title',
                                            e.target.value
                                        )
                                    }
                                    placeholder={
                                        [
                                            'Rate prin TBI Bank',
                                            'Mașini la comandă',
                                            'Verificate, cu încredere',
                                        ][i]
                                    }
                                />
                            </label>

                            <label
                                className="field"
                                style={{ marginBottom: 0 }}
                            >
                                <span>
                                    Descriere

                                    <em className="ch">
                                        {s.text.length}/
                                        {limits.svc_text || 200}
                                    </em>
                                </span>

                                <textarea
                                    rows={2}
                                    value={s.text}
                                    maxLength={
                                        limits.svc_text || 200
                                    }
                                    onChange={(e) =>
                                        setSvc(
                                            i,
                                            'text',
                                            e.target.value
                                        )
                                    }
                                />
                            </label>
                        </div>
                    ))}
                </section>

                {/* ============================================================
                   DESPRE NOI ȘI CONTACT
                ============================================================ */}

                <section className="form-section">
                    <h2>Despre noi și contact</h2>

                    <Field
                        label='Titlu „Despre noi”'
                        value={f.about_title}
                        max={limits.about_title}
                        onChange={(e) =>
                            set(
                                'about_title',
                                e.target.value
                            )
                        }
                        ph="Cine suntem"
                    />

                    <Field
                        label='Text „Despre noi”'
                        value={f.about_text}
                        max={limits.about_text}
                        onChange={(e) =>
                            set(
                                'about_text',
                                e.target.value
                            )
                        }
                        textarea
                        rows={5}
                        ph="Câteva cuvinte despre parc…"
                    />

                    <Field
                        label="Intro pagina de contact"
                        value={f.contact_intro}
                        max={limits.contact_intro}
                        onChange={(e) =>
                            set(
                                'contact_intro',
                                e.target.value
                            )
                        }
                        textarea
                        rows={3}
                        ph="Ne găsești la intrarea în Botoșani…"
                    />
                </section>

                {/* ============================================================
                   BUTOANE
                ============================================================ */}

                <div className="form-actions">
                    <button
                        className="btn btn--ghost"
                        type="button"
                        onClick={() => navigate('/')}
                    >
                        Anulează
                    </button>

                    <button
                        className="btn btn--primary"
                        type="submit"
                        disabled={saving}
                    >
                        {saving
                            ? 'Se salvează…'
                            : 'Salvează setările'}
                    </button>
                </div>

            </form>

            {toast && (
                <Toast
                    type={toast.type}
                    message={toast.message}
                />
            )}

        </AdminLayout>
    );
}

// ============================================================================
//  40761930497 → 0761930497
//  Pentru afișarea numerelor în formular.
// ============================================================================

function local(v) {
    const d = String(v || '').replace(/\D/g, '');

    if (d.startsWith('40') && d.length === 11) {
        return '0' + d.slice(2);
    }

    return v || '';
}