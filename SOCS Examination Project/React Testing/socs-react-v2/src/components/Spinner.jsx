import React from 'react';

export function Spinner({ size = 'md', label = 'Loading…' }) {
  if (size === 'sm') {
    return <div className="spinner spinner-sm" style={{ borderTopColor: 'var(--primary)' }} />;
  }
  return (
    <div className="spinner-wrap">
      <div className="spinner" />
      <p>{label}</p>
    </div>
  );
}

export function SkeletonRows({ rows = 6, cols = 10 }) {
  return Array.from({ length: rows }).map((_, i) => (
    <tr key={i}>
      {Array.from({ length: cols }).map((_, j) => (
        <td key={j}><div className="skeleton" style={{ height: 16, borderRadius: 4 }} /></td>
      ))}
    </tr>
  ));
}
