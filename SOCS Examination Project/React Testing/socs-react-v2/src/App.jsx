import React, { lazy, Suspense, useState, useCallback, createContext, useContext } from 'react';
import Navbar from './components/Navbar';
import Toast from './components/Toast';
import { Spinner } from './components/Spinner';
import { useToast } from './hooks/useToast';

// ════════════════════════════════════════════════════════
//  REACT.LAZY — Each view is code-split into its own chunk
//  Only downloaded when the user first navigates to it.
// ════════════════════════════════════════════════════════
const ExamsView    = lazy(() => import('./pages/ExamsView'));
const UploadView   = lazy(() => import('./pages/UploadView'));
const InsightsView = lazy(() => import('./pages/InsightsView'));
const ActivityView = lazy(() => import('./pages/ActivityView'));

// Toast context so any page can fire toasts
export const ToastCtx = createContext(null);
export const useGlobalToast = () => useContext(ToastCtx);

// Suspense fallback
function PageFallback() {
  return (
    <div style={{ padding: '80px 24px' }}>
      <Spinner label="Loading page…" />
    </div>
  );
}

export default function App() {
  const [view, setView] = useState('exams');
  const toast = useToast();

  const handleViewChange = useCallback((id) => {
    setView(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const renderView = () => {
    const props = { toast };
    switch (view) {
      case 'exams':    return <ExamsView    {...props} />;
      case 'upload':   return <UploadView   {...props} />;
      case 'insights': return <InsightsView {...props} />;
      case 'activity': return <ActivityView {...props} />;
      default:         return <ExamsView    {...props} />;
    }
  };

  return (
    <ToastCtx.Provider value={toast}>
      {/* ── Persistent Navbar ── */}
      <Navbar activeView={view} onViewChange={handleViewChange} />

      {/* ── Main Content with Suspense boundary ── */}
      <main className="site-content">
        <Suspense fallback={<PageFallback />}>
          {renderView()}
        </Suspense>
      </main>

      {/* ── Global Toast Notifications ── */}
      <Toast toasts={toast.toasts} remove={toast.remove} />
    </ToastCtx.Provider>
  );
}
