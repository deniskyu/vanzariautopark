// ============================================================================
//  src/components/ui.jsx — componente mici partajate în panou
// ============================================================================

import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// ── Layout: header + conținut ────────────────────────────────────────────────
export function AdminLayout({ children }) {
    const { logout } = useAuth();
    return (
        <div className="admin">
            <header className="admin-header">
                <div className="admin-header-in">
                    <div className="admin-brand">
                        <img src="/assets/logo.png" alt=""
                             onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                        <strong>Admin</strong>
                    </div>
                    <nav className="admin-nav">
                        <NavLink to="/" end>Mașini</NavLink>
                        <NavLink to="/setari">Setări</NavLink>
                        <button className="btn btn--ghost btn--sm" onClick={logout}>Ieși</button>
                    </nav>
                </div>
            </header>
            <main className="admin-main">{children}</main>
        </div>
    );
}

// ── Spinner de încărcare ─────────────────────────────────────────────────────
export function Loading({ text = 'Se încarcă…' }) {
    return (
        <div className="loading">
            <div className="spinner" />
            <p>{text}</p>
        </div>
    );
}

// ── Modal de confirmare (pentru ștergere) ────────────────────────────────────
export function ConfirmModal({ title, message, carName, confirmLabel = 'Șterge', onConfirm, onCancel, busy }) {
    return (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
            <div className="modal" role="dialog" aria-modal="true">
                <h3>{title}</h3>
                <p>{message} {carName && <span className="modal-car">{carName}</span>}</p>
                <div className="modal-actions">
                    <button className="btn btn--ghost" onClick={onCancel} disabled={busy}>Anulează</button>
                    <button className="btn btn--danger" onClick={onConfirm} disabled={busy}>
                        {busy ? 'Se șterge…' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Toast (mesaj scurt) ──────────────────────────────────────────────────────
export function Toast({ type = 'ok', message }) {
    if (!message) return null;
    return <div className={`toast ${type}`}>{message}</div>;
}

// ── Paginare ─────────────────────────────────────────────────────────────────
export function Pager({ page, pages, onPage }) {
    if (pages <= 1) return null;
    return (
        <div className="pager">
            <button onClick={() => onPage(page - 1)} disabled={page <= 1}>‹</button>
            {Array.from({ length: pages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 1)
                .map((p, idx, arr) => (
                    <span key={p} style={{ display: 'contents' }}>
                        {idx > 0 && arr[idx - 1] !== p - 1 && <span style={{ color: 'var(--muted-2)' }}>…</span>}
                        <button className={p === page ? 'current' : ''} onClick={() => onPage(p)}>{p}</button>
                    </span>
                ))}
            <button onClick={() => onPage(page + 1)} disabled={page >= pages}>›</button>
        </div>
    );
}
