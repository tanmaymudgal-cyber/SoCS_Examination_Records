import React, { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../hooks/useApi';
import flatpickr from 'flatpickr';

const STATS_CONFIG = [
  { key: 'total_exams', icon: '🏫', label: 'Total Exams', color: 'blue' },
  { key: 'total_students', icon: '👥', label: 'Students Enrolled', color: 'green' },
  { key: 'total_sheets', icon: '📄', label: 'Sheets Collected', color: 'orange' },
  { key: 'total_ufm', icon: '⚠️', label: 'UFM Cases', color: 'red' },
];

function AnimatedNumber({ value }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === undefined || value === null) return;
    let start = 0;
    const end = parseInt(value);
    const step = Math.ceil(end / 40) || 1;
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
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const fpRef = useRef(null);
  const fpInst = useRef(null);

  const fetchStats = (start = '', end = '') => {
    setLoading(true);
    let url = `${API_BASE()}/stats`;
    if (start && end) url += `?start_date=${start}&end_date=${end}`;

    fetch(url, { headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` } })
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false); })
      .catch(() => { toast.error('Load Failed', 'Could not fetch statistics.'); setLoading(false); });
  };

  useEffect(() => {
    fetchStats();

    if (fpRef.current) {
      fpInst.current = flatpickr(fpRef.current, {
        mode: 'range',
        dateFormat: 'Y-m-d',
        onClose: (selectedDates) => {
          if (selectedDates.length === 2) {
            const start = selectedDates[0].toISOString().split('T')[0];
            const end = selectedDates[1].toISOString().split('T')[0];
            setDateRange({ start, end });
            fetchStats(start, end);
          }
        }
      });
    }

    return () => {
      if (fpInst.current) fpInst.current.destroy();
    };
  }, []);

  const clearFilters = () => {
    if (fpInst.current) fpInst.current.clear();
    setDateRange({ start: '', end: '' });
    fetchStats();
  };

  return (
    <div className="page-section">
      <header className="view-header">
        <div>
          <h1>Insights & Analytics</h1>
          <p>Operational overview of the examination cycle</p>
        </div>
        <div className="view-filters" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div className="date-range-filter" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--card-bg)', padding: '4px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>🗓️ Period:</span>
            <input
              ref={fpRef}
              className="date-picker-input"
              placeholder="Select date range..."
              style={{ background: 'transparent', border: 'none', color: 'var(--text)', outline: 'none', fontSize: '0.9rem', width: '180px' }}
            />
            {dateRange.start && (
              <button onClick={clearFilters} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '1.2rem', padding: '0 4px' }}>✕</button>
            )}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => fetchStats(dateRange.start, dateRange.end)}>🔄</button>
        </div>
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
