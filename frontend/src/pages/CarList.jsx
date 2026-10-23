// ============================================================================
//  src/pages/CarList.jsx — lista de mașini din panou
// ----------------------------------------------------------------------------
//  Toate mașinile (publicate, ciorne, vândute), cu căutare, filtru pe stare,
//  paginare, marcare rapidă ca vândută / republicare și ștergere cu confirmare.
//  Butonul de adăugare duce la formular.
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { AdminLayout, Loading, ConfirmModal, Toast, Pager } from '../components/ui.jsx';

const SITE = import.meta.env.VITE_API_URL || '';
const fmt = (n) => new Intl.NumberFormat('de-DE').format(n);

const STATUS_LABEL = { published: 'Publicat', draft: 'Ciornă', sold: 'Vândut' };
const FILTERS = [
    { value: '', label: 'Toate' },
    { value: 'published', label: 'Publicate' },
    { value: 'draft', label: 'Ciorne' },
    { value: 'sold', label: 'Vândute' },
];

export default function CarList() {
    const [cars, setCars] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [toDelete, setToDelete] = useState(null);   // mașina de șters
    const [deleting, setDeleting] = useState(false);
    const [busyId, setBusyId] = useState(null);       // mașina căreia îi schimbăm starea
    const [toast, setToast] = useState(null);

    const flash = (type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 2600);
    };

    const load = useCallback(async (opts = {}) => {
        setLoading(true);
        try {
            const p = opts.page ?? page;
            const r = await api.listCars({ page: p, search, status });
            setCars(r.cars || []);
            setTotal(r.total || 0);
            setPages(r.pages || 1);
            setPage(p);
        } catch (err) {
            flash('err', err.message);
        } finally {
            setLoading(false);
        }
    }, [page, search, status]);

    // Încărcare inițială + la schimbarea filtrelor (cu debounce pe căutare).
    useEffect(() => {
        const timer = setTimeout(() => load({ page: 1 }), search ? 350 : 0);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, status]);

    const confirmDelete = async () => {
        if (!toDelete) return;
        setDeleting(true);
        try {
            await api.deleteCar(toDelete.id);
            setToDelete(null);
            flash('ok', 'Mașina a fost ștearsă.');
            // reîncărcăm; dacă pagina rămâne goală, mergem înapoi una
            const nextPage = cars.length === 1 && page > 1 ? page - 1 : page;
            load({ page: nextPage });
        } catch (err) {
            flash('err', err.message);
        } finally {
            setDeleting(false);
        }
    };

    const changeStatus = async (car, next) => {
        if (busyId) return;
        setBusyId(car.id);
        try {
            await api.setCarStatus(car.id, next);
            flash('ok', next === 'sold' ? 'Marcată ca vândută — scoasă din stoc.'
                : next === 'published' ? 'Anunțul e din nou pe site.' : 'Mutată la ciorne.');
            load();
        } catch (err) {
            flash('err', err.message);
        } finally {
            setBusyId(null);
        }
    };

    return (
        <AdminLayout>
            <div className="page-head">
                <h1>Mașini {total > 0 && <span style={{ color: 'var(--muted)', fontWeight: 400 }}>({total})</span>}</h1>
                <Link className="btn btn--primary" to="/masina/nou">+ Adaugă mașină</Link>
            </div>

            <div className="list-tools">
                <div className="list-search">
                    <input type="search" placeholder="Caută după titlu sau marcă…"
                           value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <div className="list-filter" role="group" aria-label="Filtru după stare">
                    {FILTERS.map((o) => (
                        <button key={o.value} type="button"
                                className={status === o.value ? 'is-active' : ''}
                                aria-pressed={status === o.value}
                                onClick={() => setStatus(o.value)}>{o.label}</button>
                    ))}
                </div>
            </div>

            {loading ? (
                <Loading />
            ) : cars.length === 0 ? (
                <div className="empty">
                    <h2>{search || status ? 'Nicio mașină găsită' : 'Nicio mașină încă'}</h2>
                    <p>{search || status ? 'Încearcă alt termen sau alt filtru.' : 'Adaugă prima mașină din butonul de sus.'}</p>
                </div>
            ) : (
                <>
                    <div className="car-list">
                        {cars.map((car) => {
                            const cover = car.media?.[0]
                                ? `${SITE}/media/cars/${car.media[0].dir || car.id}/${car.media[0].id}.${car.media[0].ext || 'jpg'}`
                                : null;
                            const st = car.status || 'published';
                            const busy = busyId === car.id;
                            return (
                                <article className="acar" key={car.id}>
                                    <div className="acar-media">
                                        {cover
                                            ? <img src={cover} alt={car.title} loading="lazy" />
                                            : <div className="acar-noimg">Fără poze</div>}
                                        <span className={`acar-status ${st}`}>{STATUS_LABEL[st] || st}</span>
                                        <span className="acar-views" title="Vizualizări">👁 {car.views ?? 0}</span>
                                    </div>
                                    <div className="acar-body">
                                        <h3 className="acar-title">{car.title}</h3>
                                        <div className="acar-meta">
                                            <span>{car.production_year}</span>
                                            <span>{fmt(car.mileage)} km</span>
                                            <span>{car.fuel}</span>
                                        </div>
                                        <div className="acar-price">{fmt(car.price)} €</div>
                                        <div className="acar-quick">
                                            {st === 'published' && (
                                                <button type="button" className="btn btn--ghost btn--sm" disabled={busy}
                                                        onClick={() => changeStatus(car, 'sold')}>Vândută</button>
                                            )}
                                            {st !== 'published' && (
                                                <button type="button" className="btn btn--ghost btn--sm" disabled={busy}
                                                        onClick={() => changeStatus(car, 'published')}>Publică din nou</button>
                                            )}
                                            {st !== 'draft' && SITE && (
                                                <a className="btn btn--ghost btn--sm" href={`${SITE}/masina/${car.slug}`}
                                                   target="_blank" rel="noopener noreferrer">Vezi pe site</a>
                                            )}
                                        </div>
                                        <div className="acar-actions">
                                            <Link className="btn btn--ghost btn--sm" to={`/masina/${car.id}`}>Editează</Link>
                                            <button className="icon-btn" title="Șterge"
                                                    onClick={() => setToDelete(car)} aria-label="Șterge">✕</button>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                    <Pager page={page} pages={pages} onPage={(p) => load({ page: p })} />
                </>
            )}

            {toDelete && (
                <ConfirmModal
                    title="Ștergi această mașină?"
                    message="Acțiunea e definitivă. Se șterg și toate fotografiile:"
                    carName={toDelete.title}
                    hint={toDelete.status === 'published'
                        ? 'Dacă mașina s-a vândut, folosește mai bine „Vândută": anunțul iese din stoc, dar linkul și pozele rămân.'
                        : null}
                    onConfirm={confirmDelete}
                    onCancel={() => setToDelete(null)}
                    busy={deleting}
                />
            )}

            {toast && <Toast type={toast.type} message={toast.message} />}
        </AdminLayout>
    );
}
