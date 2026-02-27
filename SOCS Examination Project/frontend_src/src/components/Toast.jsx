import React from 'react';

const ICONS = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

export default function Toast({ toasts, remove }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`} onClick={() => remove(t.id)} style={{ cursor: 'pointer' }}>
          <span className="toast-icon">{ICONS[t.type]}</span>
          <div className="toast-body">
            <h4>{t.title}</h4>
            {t.message && <p>{t.message}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
