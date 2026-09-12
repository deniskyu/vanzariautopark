// ============================================================================
//  src/pages/Login.jsx
// ----------------------------------------------------------------------------
//  O singură parolă. Mesaj identic la eșec (backend-ul întârzie 400ms), fără
//  să dezvăluie dacă parola e „aproape corectă".
// ============================================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        if (busy) return;
        setError('');
        setBusy(true);
        try {
            await login(password);
            navigate('/', { replace: true });
        } catch (err) {
            setError(err.message || 'Parolă incorectă.');
            setPassword('');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="login">
            <form className="login-card" onSubmit={submit}>
                <div className="login-logo">
                    <img src="/assets/logo.png" alt="Vanzari Auto Park"
                         onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    <h1>Panou administrare</h1>
                </div>

                {error && <div className="form-error">{error}</div>}

                <div className="field">
                    <label htmlFor="pw">Parolă</label>
                    <input id="pw" type="password" value={password} autoFocus
                           autoComplete="current-password"
                           onChange={(e) => setPassword(e.target.value)}
                           placeholder="Introdu parola" />
                </div>

                <button className="btn btn--primary btn--block" type="submit" disabled={busy || !password}>
                    {busy ? 'Se verifică…' : 'Intră în cont'}
                </button>
            </form>
        </div>
    );
}
