import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../hooks/useApi';

export default function ActivityView({ toast }) {
  const [logs, setLogs]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE()}/logs`);
      setLogs(await r.json());
    } catch {
      toast.error('Load Failed', 'Could not fetch activity logs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = logs.filter(l =>
    !search || [l.action, l.details].some(v => String(v ?? '').toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="page-section">
      <header className="view-header">
        <div>
          <h1>Activity Monitoring</h1>
          <p>System-wide logs and audit trail</p>
        </div>
        <div className="header-actions">
          <div className="search-wrap">
            <input className="search-box" placeholder="Filter logs…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-ghost btn-sm" onClick={load}>🔄 Refresh</button>
        </div>
      </header>

      <div className="card">
        <div className="card-header">
          <h2>🛡️ Event Log</h2>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
            {filtered.length} event{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="card-body" style={{ padding: '12px 16px' }}>
          {loading ? (
            <div className="spinner-wrap"><div className="spinner" /></div>
          ) : (
            <div className="logs-list">
              {filtered.length === 0 ? (
                <div className="empty-row">No activity logs found.</div>
              ) : (
                filtered.map((l, i) => (
                  <div className="log-item" key={i}>
                    <div className="log-time">🕒 {new Date(l.timestamp).toLocaleString()}</div>
                    <div className="log-action">{l.action}</div>
                    <div className="log-details">{l.details}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
