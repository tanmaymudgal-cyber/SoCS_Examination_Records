import React, { lazy, Suspense, useState, useCallback, createContext, useContext, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Toast from './components/Toast';
import { Spinner } from './components/Spinner';
import { useToast } from './hooks/useToast';
import { API_BASE } from './hooks/useApi';

const ExamsView = lazy(() => import('./pages/ExamsView'));
const UploadView = lazy(() => import('./pages/UploadView'));
const InsightsView = lazy(() => import('./pages/InsightsView'));
const ActivityView = lazy(() => import('./pages/ActivityView'));
const LoginView = lazy(() => import('./pages/LoginView'));

export const ToastCtx = createContext(null);
export const useGlobalToast = () => useContext(ToastCtx);

// How many ms of idle before the token is verified / session expires
// 25 minutes: ping the server to extend. If server rejects → logout.
const IDLE_CHECK_MS = 25 * 60 * 1000;

function PageFallback() {
  return (
    <div style={{ padding: '80px 24px' }}>
      <Spinner label="Loading page…" />
    </div>
  );
}

export default function App() {
  const [view, setView] = useState('exams');
  const [isAuthenticated, setIsAuth] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [userUsername, setUserUsername] = useState(null);
  const [authChecking, setAuthChecking] = useState(true); // true while verifying stored token
  const toast = useToast();
  const idleTimer = useRef(null);

  /* ── Verify token with backend ── */
  const verifyToken = useCallback(async (token) => {
    try {
      const res = await fetch(`${API_BASE()}/auth/verify`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        return data; // { valid, role, username, expires_at }
      }
    } catch (_) { }
    return null;
  }, []);

  /* ── Sign out ── */
  const handleSignOut = useCallback(async (silent = false) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      try {
        await fetch(`${API_BASE()}/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        });
      } catch (_) { }
    }
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_username');
    setIsAuth(false);
    setUserRole(null);
    setUserUsername(null);
    if (!silent) toast.add('You have been signed out.', 'info');
    clearTimeout(idleTimer.current);
  }, [toast]);

  /* ── Start the idle timer ── */
  const startIdleTimer = useCallback((token) => {
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(async () => {
      const result = await verifyToken(token);
      if (result) {
        // Session extended — restart timer
        startIdleTimer(token);
      } else {
        toast.add('⏱️ Your session has expired. Please sign in again.', 'warning');
        handleSignOut(true);
      }
    }, IDLE_CHECK_MS);
  }, [verifyToken, handleSignOut, toast]);

  /* ── On mount: restore session if a valid token is saved ── */
  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    const savedRole = localStorage.getItem('user_role');
    const savedUsername = localStorage.getItem('user_username');

    if (!savedToken || !savedRole) {
      setAuthChecking(false);
      return;
    }

    (async () => {
      const result = await verifyToken(savedToken);
      if (result) {
        setIsAuth(true);
        setUserRole(result.role || savedRole);
        setUserUsername(result.username || savedUsername);
        startIdleTimer(savedToken);
      } else {
        // Token stale — clear it silently
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_role');
        localStorage.removeItem('user_username');
      }
      setAuthChecking(false);
    })();
  }, [verifyToken, startIdleTimer]);

  /* ── After login ── */
  const handleLoginSuccess = useCallback((role, username, token) => {
    setIsAuth(true);
    setUserRole(role);
    setUserUsername(username);
    setView('exams');
    startIdleTimer(token);
  }, [startIdleTimer]);

  const handleViewChange = useCallback((id) => {
    setView(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const renderView = () => {
    if (!isAuthenticated) return <LoginView onLoginSuccess={handleLoginSuccess} />;
    const props = { toast };
    switch (view) {
      case 'exams': return <ExamsView    {...props} />;
      case 'upload': return <UploadView   {...props} />;
      case 'insights': return <InsightsView {...props} />;
      case 'activity': return <ActivityView {...props} />;
      default: return <ExamsView    {...props} />;
    }
  };

  if (authChecking) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <Spinner label="Restoring session…" />
      </div>
    );
  }

  return (
    <ToastCtx.Provider value={toast}>
      <Navbar
        activeView={view}
        onViewChange={handleViewChange}
        isAuthenticated={isAuthenticated}
        userRole={userRole}
        userUsername={userUsername}
        onSignOut={() => handleSignOut(false)}
      />
      <main className="site-content">
        <Suspense fallback={<PageFallback />}>
          {renderView()}
        </Suspense>
      </main>
      <Footer />
      <Toast toasts={toast.toasts} remove={toast.remove} />
    </ToastCtx.Provider>
  );
}
