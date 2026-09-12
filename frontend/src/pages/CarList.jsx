// ============================================================================
//  src/pages/CarList.jsx — lista de mașini din panou
// ----------------------------------------------------------------------------
//  Toate mașinile (draft, published, sold), cu căutare, filtru pe status,
//  paginare și ștergere cu confirmare. Butonul de adăugare duce la formular
//  (Batch 10).
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { AdminLayout, Loading, ConfirmModal, Toast, Pager } from '../components/ui.jsx';

const fmt = (n) => new Intl.NumberFormat('de-DE').format(n);

const STATUS_LABEL = { published: 'Publicat', draft: 'Ciornă', sold: 'Vândut' };

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

    const quickStatus = async (car, newStatus) => {
        try {
            await api.setCarStatus(car.id, newStatus);
            flash('ok', newStatus === 'sold' ? 'Marcată ca vândută.' : 'Stare actualizată.');
            load();
        } catch (err) {
            flash('err', err.message);
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
                <div className="list-filter">
                    <select value={status} onChange={(e) => setStatus(e.target.value)}>
                        <option value="">Toate stările</option>
                        <option value="published">Publicate</option>
                        <option value="draft">Ciorne</option>
                        <option value="sold">Vândute</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <Loading />
            ) : cars.length === 0 ? (
                <div className="empty">
                    <h2>{search || status ? 'Nicio mașină găsită' : 'Nicio mașină încă'}</h2>
                    <p>{search || status ? 'Încearcă alt filtru.' : 'Adaugă prima mașină din butonul de sus.'}</p>
                </div>
            ) : (
                <>
                    <div className="car-list">
                        {cars.map((car) => {
                            const cover = car.media?.[0]
                                ? `${import.meta.env.VITE_API_URL || ''}/media/cars/${car.id}/${car.media[0].id}.${car.media[0].ext || 'jpg'}`
                                : null;
                            return (
                                <article className="acar" key={car.id}>
                                    <div className="acar-media">
                                        {cover
                                            ? <img src={cover} alt={car.title} loading="lazy" />
                                            : <div className="acar-noimg">Fără poze</div>}
                                        <span className={`acar-status ${car.status}`}>{STATUS_LABEL[car.status]}</span>
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
                                        <div className="acar-actions">
                                            <Link className="btn btn--ghost btn--sm" to={`/masina/${car.id}`}>Editează</Link>
                                            {car.status !== 'sold'
                                                ? <button className="btn btn--ghost btn--sm" onClick={() => quickStatus(car, 'sold')}>Vândut</button>
                                                : <button className="btn btn--ghost btn--sm" onClick={() => quickStatus(car, 'published')}>Repune</button>}
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
                    onConfirm={confirmDelete}
                    onCancel={() => setToDelete(null)}
                    busy={deleting}
                />
            )}

            {toast && <Toast type={toast.type} message={toast.message} />}
        </AdminLayout>
    );
}
