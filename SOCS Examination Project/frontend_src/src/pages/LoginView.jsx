import React, { useState } from 'react';
import upesLogo from '../assets/logo.png';
import { useGlobalToast } from '../App';
import { API_BASE } from '../hooks/useApi';

export default function LoginView({ onLoginSuccess }) {
    const toast = useGlobalToast();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPwd, setShowPwd] = useState(false);
    const [loading, setLoading] = useState(false);

    // Forgot-password modal state
    const [showForgot, setShowForgot] = useState(false);
    const [forgotUsername, setForgotUsername] = useState('');
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotError, setForgotError] = useState('');

    /* ── Login ── */
    const handleLogin = async (e) => {
        e.preventDefault();
        const trimmedUser = username.trim();
        if (!trimmedUser) { toast.add('Please enter your username.', 'error'); return; }
        if (!password) { toast.add('Please enter your password.', 'error'); return; }

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE()}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: trimmedUser, password }),
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Login failed');

            localStorage.setItem('auth_token', data.token);
            localStorage.setItem('user_role', data.role);
            localStorage.setItem('user_username', data.username);
            toast.add(`Welcome back, ${data.username}!`, 'success');
            onLoginSuccess(data.role, data.username, data.token);
        } catch (err) {
            toast.add('❌ ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    /* ── Forgot Password ── */
    const handleForgot = async (e) => {
        e.preventDefault();
        setForgotError('');
        if (!forgotUsername.trim()) { setForgotError('Please enter your username.'); return; }
        if (!forgotEmail.trim()) { setForgotError('Please enter your registered email.'); return; }

        setForgotLoading(true);
        try {
            const res = await fetch(`${API_BASE()}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: forgotUsername.trim(), email: forgotEmail.trim().toLowerCase() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Verification failed');
            // Redirect to standalone reset page with token in URL
            window.location.href = `reset-password.html?token=${encodeURIComponent(data.token)}`;
        } catch (err) {
            setForgotError(err.message || 'Something went wrong.');
        } finally {
            setForgotLoading(false);
        }
    };

    const closeForgot = () => { setShowForgot(false); setForgotUsername(''); setForgotEmail(''); setForgotError(''); };

    return (
        <>
            {/* ── Forgot-Password Modal ── */}
            {showForgot && (
                <div className="modal-overlay" onClick={closeForgot}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
                        <div className="modal-header">
                            <h3>🔑 Reset Password</h3>
                            <button className="modal-close" onClick={closeForgot}>✕</button>
                        </div>
                        <div className="modal-body">
                            {forgotError && (
                                <div style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', fontWeight: '600', marginBottom: '14px' }}>
                                    ❌ {forgotError}
                                </div>
                            )}
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.6' }}>
                                Enter your <strong>username</strong> and <strong>registered email</strong> to verify your identity.
                            </p>
                            <form onSubmit={handleForgot}>
                                <div className="input-row">
                                    <label>Username</label>
                                    <input
                                        className="modal-input"
                                        type="text"
                                        placeholder="Enter your username"
                                        value={forgotUsername}
                                        onChange={e => { setForgotUsername(e.target.value); setForgotError(''); }}
                                        autoFocus
                                    />
                                </div>
                                <div className="input-row" style={{ marginTop: '12px' }}>
                                    <label>Registered Email</label>
                                    <input
                                        className="modal-input"
                                        type="email"
                                        placeholder="e.g. admin@upes.ac.in"
                                        value={forgotEmail}
                                        onChange={e => { setForgotEmail(e.target.value); setForgotError(''); }}
                                    />
                                </div>
                                <button type="submit" className="btn btn-primary btn-lg" disabled={forgotLoading} style={{ marginTop: '16px' }}>
                                    {forgotLoading ? <span className="spinner-sm" /> : '🔍 Verify & Continue'}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Login Page ── */}
            <div className="login-page-wrapper page-section">
                <div className="login-container">

                    {/* Logo Block */}
                    <div className="logo-block">
                        <img className="college-logo" src={upesLogo} alt="UPES Logo" />
                        <h2>SoCS Exam Hub</h2>
                        <p>UPES Dehradun — School of Computer Science</p>
                    </div>

                    {/* Card */}
                    <div className="login-card">
                        <div className="login-header">
                            <div className="login-header-icon">🔐</div>
                            <div className="login-header-text">
                                <h3>Sign In to Continue</h3>
                                <p>Restricted — Staff &amp; Admin access only</p>
                            </div>
                        </div>

                        <div className="login-body">
                            <form onSubmit={handleLogin} noValidate>
                                <div className="form-group">
                                    <label>Username</label>
                                    <div className="input-wrapper">
                                        <span className="input-icon">👤</span>
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="e.g. admin"
                                            value={username}
                                            onChange={e => setUsername(e.target.value)}
                                            autoComplete="username"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Password</label>
                                    <div className="input-wrapper">
                                        <span className="input-icon">🔑</span>
                                        <input
                                            type={showPwd ? 'text' : 'password'}
                                            className="form-input"
                                            placeholder="Enter your password"
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            autoComplete="current-password"
                                            required
                                        />
                                        <button type="button" className="pwd-toggle" onClick={() => setShowPwd(!showPwd)}>
                                            {showPwd ? '🙈' : '👁️'}
                                        </button>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '18px', marginTop: '-10px' }}>
                                    <button
                                        type="button"
                                        style={{
                                            fontSize: '12px',
                                            fontWeight: '600',
                                            color: 'var(--primary)',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: '4px 0',
                                            textDecoration: 'none'
                                        }}
                                        onClick={() => setShowForgot(true)}
                                    >
                                        Forgot password?
                                    </button>
                                </div>

                                <button type="submit" className="btn-login" disabled={loading}>
                                    {loading ? <span className="spinner-sm" /> : '🔓 Sign In'}
                                </button>
                            </form>

                            {/* Default credentials hint */}
                            <div style={{ marginTop: '16px', padding: '10px 14px', background: 'var(--primary-xlight)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                <strong>Default credentials:</strong> admin / admin123 &nbsp;|&nbsp; invigilator / invig123 &nbsp;|&nbsp; coordinator / coord123
                            </div>
                        </div>

                        <div className="login-footer-note">
                            Having trouble? Contact <a href="mailto:socs-admin@upes.ac.in" style={{ color: 'var(--primary)', fontWeight: '700', textDecoration: 'none' }}>socs-admin@upes.ac.in</a>
                        </div>
                    </div>

                </div>
            </div>
        </>
    );
}
