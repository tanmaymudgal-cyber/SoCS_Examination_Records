import React, { useState, useEffect } from 'react';
import { API_BASE } from '../hooks/useApi';

const STATS_CONFIG = [
  { key: 'total_exams',    icon: '🏫', label: 'Total Exams',       color: 'blue'   },
  { key: 'total_students', icon: '👥', label: 'Students Enrolled', color: 'green'  },
  { key: 'total_sheets',   icon: '📄', label: 'Sheets Collected',  color: 'orange' },
  { key: 'total_ufm',      icon: '⚠️', label: 'UFM Cases',         color: 'red'    },
];

function AnimatedNumber({ value }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!value) return;
    let start = 0;
    const end = parseInt(value);
    const step = Math.ceil(end / 40);
    const timer = setInterval(() => {
      start = Math.min(start + step, end);
      setDisplay(start);
      if (start >= end) clearInterval(timer);
    }, 20);
    return () => clearInterval(timer);
  }, [value]);
  return <>{display.toLocaleString()}</>;
}

export default function InsightsView({ toast }) {
  const [stats, setStats]   = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE()}/stats`)
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false); })
      .catch(() => { toast.error('Load Failed', 'Could not fetch statistics.'); setLoading(false); });
  }, []);

  return (
    <div className="page-section">
      <header className="view-header">
        <div>
          <h1>Insights & Analytics</h1>
          <p>Operational overview of the examination cycle</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => {
          setLoading(true);
          fetch(`${API_BASE()}/stats`).then(r => r.json()).then(d => { setStats(d); setLoading(false); }).catch(() => setLoading(false));
        }}>🔄 Refresh</button>
      </header>

      <div className="stats-grid" style={{ marginBottom: 32 }}>
        {STATS_CONFIG.map(({ key, icon, label, color }) => (
          <div className="stat-card" key={key}>
            <div className={`stat-ico ${color}`}>{icon}</div>
            <div className="stat-val">
              {loading ? '–' : <AnimatedNumber value={stats[key] ?? 0} />}
            </div>
            <div className="stat-lbl">{label}</div>
          </div>
        ))}
      </div>

      {/* Extra info card */}
      <div className="card">
        <div className="card-header"><h2>📈 Quick Metrics</h2></div>
        <div className="card-body">
          {loading ? (
            <div className="spinner-wrap"><div className="spinner" /></div>
          ) : (
            <table>
              <thead>
                <tr><th>Metric</th><th>Value</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>Average students per session</td>
                  <td><strong>{stats.total_exams > 0 ? Math.round(stats.total_students / stats.total_exams) : '—'}</strong></td>
                </tr>
                <tr>
                  <td>Sheet collection rate</td>
                  <td><strong>
                    {stats.total_students > 0
                      ? `${Math.round((stats.total_sheets / stats.total_students) * 100)}%`
                      : '—'}
                  </strong></td>
                </tr>
                <tr>
                  <td>UFM rate (per exam)</td>
                  <td><strong style={{ color: stats.total_ufm > 0 ? 'var(--danger)' : 'inherit' }}>
                    {stats.total_exams > 0
                      ? (stats.total_ufm / stats.total_exams).toFixed(2)
                      : '—'}
                  </strong></td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
