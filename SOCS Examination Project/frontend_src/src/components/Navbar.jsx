import React, { useEffect, useState, useCallback } from 'react';
import ThemeToggle from './ThemeToggle';
import { API_BASE } from '../hooks/useApi';
import upesLogo from '../assets/logo.png';

const NAV_ITEMS = [
  { id: 'exams', label: 'Exams', icon: '📋' },
  { id: 'upload', label: 'Upload', icon: '📤' },
  { id: 'insights', label: 'Insights', icon: '📊' },
  { id: 'activity', label: 'Activity', icon: '🛡️' },
];

export default function Navbar({ activeView, onViewChange, isAuthenticated, userRole, userUsername, onSignOut }) {
  const [online, setOnline] = useState(false);

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE()}/health`);
      setOnline(res.ok);
    } catch {
      setOnline(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const id = setInterval(checkHealth, 5000);
    return () => clearInterval(id);
  }, [checkHealth]);

  return (
    <nav className="main-nav">
      <div className="nav-container">

        {/* Brand */}
        <div className="nav-brand">
          <div className="logo-wrap">
            <img src={upesLogo} alt="UPES Logo" style={{ height: '32px', width: 'auto' }} />
          </div>
          <div>
            <h3>SoCS Exam Hub</h3>
            <p>
              UPES Dehradun <span className="version-tag">v2.2-STABLE</span>
            </p>
          </div>
        </div>

        {/* Nav Links — only when authenticated */}
        <div className="nav-links">
          {isAuthenticated && NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`nav-btn${activeView === item.id ? ' active' : ''}`}
              onClick={() => onViewChange(item.id)}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>

        {/* Right side */}
        <div className="nav-right">
          <ThemeToggle />
          <div className="nav-status">
            <div className={`status-dot ${online ? 'online' : 'offline'}`} />
            <span>{online ? 'Backend Live' : 'Disconnected'}</span>
          </div>
        </div>

        {/* Profile — shifted outside for better mobile layout control */}
        {isAuthenticated && (
          <div className="nav-profile">
            <div className="user-info">
              <span>👤</span>
              <span style={{ textTransform: 'capitalize' }}>
                {userUsername || userRole}
              </span>
              <span style={{ opacity: 0.6, fontSize: '10px', textTransform: 'capitalize' }}>
                ({userRole})
              </span>
            </div>
            <button className="btn-signout" onClick={onSignOut} title="Sign Out">
              Sign Out
            </button>
          </div>
        )}

      </div>
    </nav>
  );
}
