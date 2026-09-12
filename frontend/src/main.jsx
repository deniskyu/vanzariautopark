// ============================================================================
//  src/main.jsx — punctul de intrare al panoului React
// ----------------------------------------------------------------------------
//  Rutare + protecția rutelor. Formularul de mașină (Batch 10) și setările
//  (Batch 11) au deocamdată placeholder-e, ca aplicația să compileze și să
//  poți naviga.
// ============================================================================

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { Loading } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import CarList from './pages/CarList.jsx';
import CarForm from './pages/CarForm.jsx';
import Settings from './pages/Settings.jsx';
import './styles/admin.css';

// Rută care cere autentificare. Așteaptă verificarea sesiunii înainte să decidă.
function Protected({ children }) {
    const { authed, loading } = useAuth();
    if (loading) return <Loading text="Se verifică sesiunea…" />;
    if (!authed) return <Navigate to="/login" replace />;
    return children;
}

// Login-ul: dacă ești deja autentificat, sari direct în panou.
function LoginRoute() {
    const { authed, loading } = useAuth();
    if (loading) return <Loading />;
    if (authed) return <Navigate to="/" replace />;
    return <Login />;
}

// Placeholder temporar pentru paginile care vin în batch-urile următoare.
function Placeholder({ title, batch }) {
    return (
        <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: '2rem', textAlign: 'center' }}>
            <div>
                <h1 style={{ marginBottom: '.5rem' }}>{title}</h1>
                <p style={{ color: 'var(--muted)', marginBottom: '1.5rem' }}>Vine în {batch}.</p>
                <a className="btn btn--ghost" href="/">Înapoi la mașini</a>
            </div>
        </div>
    );
}

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<LoginRoute />} />
                    <Route path="/" element={<Protected><CarList /></Protected>} />
                    <Route path="/masina/nou" element={<Protected><CarForm /></Protected>} />
                    <Route path="/masina/:id" element={<Protected><CarForm /></Protected>} />
                    <Route path="/setari" element={<Protected><Settings /></Protected>} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}

createRoot(document.getElementById('root')).render(
    <StrictMode><App /></StrictMode>
);
