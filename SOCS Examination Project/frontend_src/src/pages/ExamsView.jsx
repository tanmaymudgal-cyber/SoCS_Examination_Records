import React, { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE, toISODate } from '../hooks/useApi';
import { SkeletonRows } from '../components/Spinner';
import Modal from '../components/Modal';
import flatpickr from 'flatpickr';

/* ── Dropdown ── */
function ActionMenu({ id, onDownload, onAdmin, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="menu-container" ref={ref}>
      <button className="btn-menu" onClick={() => setOpen(o => !o)}>⋮</button>
      {open && (
        <div className="dropdown-menu">
          <button onClick={() => { onDownload(id); setOpen(false); }}>📄 Download Label</button>
          <button onClick={() => { onAdmin(id); setOpen(false); }}>🔐 Admin View</button>
          <button className="del-opt" onClick={() => { onDelete(id); setOpen(false); }}>🗑 Delete</button>
        </div>
      )}
    </div>
  );
}

/* ── Past Exam Card ── */
function ResultCard({ r, onAdmin, onDelete }) {
  const hasSync = r.answer_sheets !== null;
  return (
    <div className="result-card">
      <div className="card-top">
        <div>
          <h3 className="card-title">{r.course_name}</h3>
          <div className="card-meta">📅 {r.exam_date} &nbsp;|&nbsp; 🕒 {r.exam_time}</div>
        </div>
        <span className="card-room">ROOM {r.room_number}</span>
      </div>

      <div className="card-metrics">
        <div className="metric">
          <span className="m-val">{r.answer_sheets ?? '–'}</span>
          <span className="m-lbl">Sheets</span>
        </div>
        <div className="metric">
          <span className="m-val">{r.absent_count ?? '–'}</span>
          <span className="m-lbl">Absent</span>
        </div>
        <div className="metric">
          <span className="m-val" style={{ color: (r.ufm_count > 0) ? 'var(--danger)' : 'inherit' }}>
            {r.ufm_count ?? '–'}
          </span>
          <span className="m-lbl">UFM</span>
        </div>
      </div>

      <div className="card-footer">
        <div className="inv-info">
          <span className="inv-ico">{hasSync ? '👤' : '⏳'}</span>
          <div>
            <div className="inv-name">{r.submitted_by || 'Waiting for Sync'}</div>
            <div className="card-meta" style={{ fontSize: '0.65rem' }}>
              {r.sync_at ? 'Synced: ' + new Date(r.sync_at).toLocaleString() : 'Batch ' + r.program_batch}
            </div>
          </div>
        </div>
        <div className="card-actions">
          <button className="btn-mini" title="View Report" onClick={() => onAdmin(r.id)}>📋</button>
          {!hasSync && (
            <button className="btn-mini del-opt" title="Delete" onClick={() => onDelete(r.id)}>🗑</button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '-6px' }}>
        <span className={`status-check ${hasSync ? 'status-synced' : 'status-pending'}`}>
          {hasSync ? '✅ Data Verified' : '🔘 Pending Input'}
        </span>
        <code style={{ fontSize: '0.7rem', opacity: 0.5 }}>ID: {r.id}</code>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN EXAMS VIEW
═══════════════════════════════════════════════════════════════ */
export default function ExamsView({ toast }) {
  const [records, setRecords]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState('upcoming');
  const [search, setSearch]       = useState('');
  const [pastSearch, setPastSearch] = useState('');
  const [sort, setSort]           = useState({ field: 'exam_date', desc: false });
  const [bulkOpen, setBulkOpen]   = useState(false);
  const [bulkMode, setBulkMode]   = useState('one');
  const [examDates, setExamDates] = useState([]);
  const [generating, setGenerating] = useState(false);

  const fpSingle = useRef(null); const fpStart = useRef(null); const fpEnd = useRef(null);
  const fpSingleInst = useRef(null); const fpStartInst = useRef(null); const fpEndInst = useRef(null);

  const today = new Date().toISOString().split('T')[0];

  /* ── Fetch ── */
  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE()}/examinations`);
      setRecords(await res.json());
    } catch {
      toast.error('Load Failed', 'Could not fetch exam sessions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  /* ── Flatpickr ── */
  const dayCreate = useCallback((_, __, ___, dayElem) => {
    const d = dayElem.dateObj.toISOString().split('T')[0];
    if (examDates.includes(d)) {
      dayElem.classList.add('exam-day');
      dayElem.title = '📅 Exam Scheduled';
    }
  }, [examDates]);

  useEffect(() => {
    if (!bulkOpen) return;
    const cfg = { dateFormat: 'Y-m-d', onDayCreate: dayCreate };
    if (!fpSingleInst.current && fpSingle.current) fpSingleInst.current = flatpickr(fpSingle.current, cfg);
    if (!fpStartInst.current  && fpStart.current)  fpStartInst.current  = flatpickr(fpStart.current, cfg);
    if (!fpEndInst.current    && fpEnd.current)     fpEndInst.current    = flatpickr(fpEnd.current, cfg);
  }, [bulkOpen, dayCreate]);

  useEffect(() => {
    if (!bulkOpen) return;
    fetch(`${API_BASE()}/exam-dates`)
      .then(r => r.json())
      .then(setExamDates)
      .catch(() => {});
  }, [bulkOpen]);

  /* ── Actions ── */
  const handleDownloadPDF = async (id) => {
    try {
      const res = await fetch(`${API_BASE()}/generate-pdf/${id}`);
      const blob = await res.blob();
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `label_${id}.pdf`; a.click();
      toast.success('PDF Ready', `Label for session #${id} downloaded.`);
    } catch {
      toast.error('Download Failed', 'Could not generate PDF.');
    }
  };

  const handleAdminView = (id) => window.open(`admin.html?exam_id=${id}`, '_blank');

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this session?')) return;
    await fetch(`${API_BASE()}/examination/${id}`, { method: 'DELETE' });
    toast.success('Deleted', `Session #${id} removed.`);
    loadRecords();
  };

  const handleBulkDownload = async () => {
    let url = `${API_BASE()}/generate-bulk-pdf`;
    if (bulkMode === 'one') {
      const d = fpSingleInst.current?.selectedDates[0];
      if (!d) { toast.warning('Date Required', 'Please select a date.'); return; }
      url += `?start_date=${d.toISOString().split('T')[0]}`;
    } else {
      const s = fpStartInst.current?.selectedDates[0];
      const e = fpEndInst.current?.selectedDates[0];
      if (!s || !e) { toast.warning('Dates Required', 'Please select start and end dates.'); return; }
      url += `?start_date=${s.toISOString().split('T')[0]}&end_date=${e.toISOString().split('T')[0]}`;
    }
    setGenerating(true);
    try {
      const res = await fetch(url);
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Generation failed.'); }
      const blob = await res.blob();
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `bulk_labels_${today}.pdf`; a.click();
      setBulkOpen(false);
      toast.success('Bulk PDF Ready', 'All labels have been downloaded.');
    } catch (e) {
      toast.error('Generation Failed', e.message);
    } finally {
      setGenerating(false);
    }
  };

  /* ── Derived Data ── */
  const handleSort = (field) => {
    setSort(s => ({ field, desc: s.field === field ? !s.desc : false }));
  };

  const filtered = records
    .filter(r => tab === 'upcoming' ? toISODate(r.exam_date) >= today : toISODate(r.exam_date) < today)
    .filter(r => {
      const q = (tab === 'upcoming' ? search : pastSearch).toLowerCase();
      return !q || Object.values(r).some(v => String(v ?? '').toLowerCase().includes(q));
    })
    .sort((a, b) => {
      if (tab !== 'upcoming') return 0;
      let va = a[sort.field], vb = b[sort.field];
      if (!isNaN(va) && !isNaN(vb) && va !== '' && vb !== '') { va = Number(va); vb = Number(vb); }
      else { va = String(va).toLowerCase(); vb = String(vb).toLowerCase(); }
      return va < vb ? (sort.desc ? 1 : -1) : va > vb ? (sort.desc ? -1 : 1) : 0;
    });

  const SortTh = ({ field, children }) => (
    <th className={`sortable${sort.field === field ? (sort.desc ? ' sort-desc' : ' sort-asc') : ''}`} onClick={() => handleSort(field)}>
      {children} <span className="sort-icon" />
    </th>
  );

  /* ── Render ── */
  return (
    <div className="page-section">
      <header className="view-header">
        <div>
          <h1>Examination Sessions</h1>
          <p>Integrated management console for SoCS exam scheduling</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-pdf" onClick={() => setBulkOpen(true)}>📄 Bulk Labels</button>
          <button className="btn btn-outline" onClick={() => {
            fetch(`${API_BASE()}/template`).then(r => r.blob()).then(b => {
              const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'template.xlsx'; a.click();
            }).catch(() => toast.error('Error', 'Template not available.'));
          }}>⬇ Template</button>
          <button className="btn btn-ghost btn-sm" onClick={loadRecords} title="Refresh">🔄</button>
        </div>
      </header>

      {/* Tabs */}
      <div className="exam-view-tabs">
        <button className={`exam-tab${tab === 'upcoming' ? ' active' : ''}`} onClick={() => setTab('upcoming')}>🗓 Upcoming & Live</button>
        <button className={`exam-tab${tab === 'past' ? ' active' : ''}`} onClick={() => setTab('past')}>✅ Completed & Past</button>
      </div>

      {/* ── UPCOMING TABLE ── */}
      {tab === 'upcoming' && (
        <div className="card">
          <div className="card-header">
            <h2>📋 Live Exam Schedule</h2>
            <div className="table-actions">
              <div className="search-wrap">
                <input
                  className="search-box"
                  placeholder="Search schedule…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <SortTh field="id">ID</SortTh>
                  <SortTh field="exam_title">Exam Title</SortTh>
                  <SortTh field="room_number">Room</SortTh>
                  <SortTh field="exam_date">Date</SortTh>
                  <SortTh field="exam_time">Time</SortTh>
                  <SortTh field="program_batch">Batch</SortTh>
                  <SortTh field="semester">Sem</SortTh>
                  <SortTh field="course_name">Course</SortTh>
                  <SortTh field="course_code">Code</SortTh>
                  <SortTh field="evaluator_name">Evaluator</SortTh>
                  <SortTh field="num_students">Students</SortTh>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={5} cols={12} />
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={12} className="empty-row">No upcoming sessions found.</td></tr>
                ) : filtered.map(r => (
                  <tr key={r.id}>
                    <td><span className="id-badge">{r.id}</span></td>
                    <td><strong>{r.exam_title}</strong></td>
                    <td><span className="room-badge">🏛 {r.room_number}</span></td>
                    <td>{r.exam_date}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{r.exam_time}</td>
                    <td><span className="batch-chip">{r.program_batch}</span></td>
                    <td style={{ textAlign: 'center' }}>{r.semester}</td>
                    <td>{r.course_name}</td>
                    <td><code>{r.course_code}</code></td>
                    <td>{r.evaluator_name}</td>
                    <td style={{ textAlign: 'center' }}><span className="count-chip">{r.num_students}</span></td>
                    <td>
                      <ActionMenu id={r.id} onDownload={handleDownloadPDF} onAdmin={handleAdminView} onDelete={handleDelete} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PAST CARDS ── */}
      {tab === 'past' && (
        <div>
          <div className="past-search-bar">
            <div className="search-wrap">
              <input className="search-box" placeholder="Search past exams…" value={pastSearch} onChange={e => setPastSearch(e.target.value)} />
            </div>
          </div>
          {loading ? (
            <div className="spinner-wrap"><div className="spinner" /><p>Loading past exams…</p></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><span style={{ fontSize: 48 }}>📭</span><p>No archived exam results found.</p></div>
          ) : (
            <div className="past-grid">
              {filtered.map(r => (
                <ResultCard key={r.id} r={r} onAdmin={handleAdminView} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── BULK DOWNLOAD MODAL ── */}
      <Modal show={bulkOpen} onClose={() => setBulkOpen(false)} title="📄 Bulk Labels Download">
        <div className="toggle-group">
          <button className={`toggle-btn${bulkMode === 'one' ? ' active' : ''}`} onClick={() => setBulkMode('one')}>One Day</button>
          <button className={`toggle-btn${bulkMode === 'range' ? ' active' : ''}`} onClick={() => setBulkMode('range')}>Date Range</button>
        </div>

        {bulkMode === 'one' && (
          <div className="input-row">
            <label>Select Date</label>
            <input ref={fpSingle} className="modal-input" placeholder="Select a date from the calendar" readOnly />
          </div>
        )}
        {bulkMode === 'range' && (
          <div className="input-row">
            <div className="dual-input">
              <div><label>From</label><input ref={fpStart} className="modal-input" placeholder="Start Date" readOnly /></div>
              <div><label>Till</label><input ref={fpEnd} className="modal-input" placeholder="End Date" readOnly /></div>
            </div>
          </div>
        )}

        <button className="btn btn-primary btn-lg" onClick={handleBulkDownload} disabled={generating}>
          {generating ? <><div className="spinner spinner-sm" /> Generating…</> : 'Generate & Download PDF'}
        </button>
      </Modal>
    </div>
  );
}
