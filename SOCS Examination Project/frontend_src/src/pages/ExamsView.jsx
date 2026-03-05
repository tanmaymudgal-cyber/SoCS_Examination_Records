import React, { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE, toISODate } from '../hooks/useApi';
import { SkeletonRows } from '../components/Spinner';
import Modal from '../components/Modal';
import flatpickr from 'flatpickr';
import 'flatpickr/dist/flatpickr.min.css';
import 'flatpickr/dist/themes/airbnb.css';

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
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('upcoming');
  const [search, setSearch] = useState('');
  const [pastSearch, setPastSearch] = useState('');
  const [sort, setSort] = useState({ field: 'exam_date', desc: false });
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState('one');
  const [examDates, setExamDates] = useState([]);
  const examDatesRef = useRef([]);   // stable ref — avoids Flatpickr re-init loop
  const [generating, setGenerating] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState('one');
  const [isDeleting, setIsDeleting] = useState(false);

  const fpSingle = useRef(null); const fpRange = useRef(null);
  const fpSingleInst = useRef(null); const fpRangeInst = useRef(null);

  const fpDelSingle = useRef(null); const fpDelRange = useRef(null);
  const fpDelSingleInst = useRef(null); const fpDelRangeInst = useRef(null);

  const [exportOpen, setExportOpen] = useState(false);
  const [exportMode, setExportMode] = useState('all');
  const [isExporting, setIsExporting] = useState(false);
  const fpExSingle = useRef(null); const fpExRange = useRef(null);
  const fpExSingleInst = useRef(null); const fpExRangeInst = useRef(null);

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
  // Keep examDatesRef in sync so the stable dayCreate callback can read the latest dates
  useEffect(() => { examDatesRef.current = examDates; }, [examDates]);

  // STABLE callback — does NOT go into the Flatpickr useEffect dep array
  const dayCreate = useRef((_, __, ___, dayElem) => {
    const y = dayElem.dateObj.getFullYear();
    const m = String(dayElem.dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dayElem.dateObj.getDate()).padStart(2, '0');
    const isoDate = `${y}-${m}-${d}`;
    if (examDatesRef.current.includes(isoDate)) {
      dayElem.classList.add('exam-day');
      dayElem.title = '📅 Exam Scheduled';
    }
  }).current;

  useEffect(() => {
    if (!bulkOpen && !deleteOpen && !exportOpen) return;
    const cfg = { dateFormat: 'Y-m-d', onDayCreate: dayCreate, static: true };
    const rangeCfg = { ...cfg, mode: 'range' };

    if (bulkOpen) {
      if (fpSingle.current) fpSingleInst.current = flatpickr(fpSingle.current, cfg);
      if (fpRange.current) fpRangeInst.current = flatpickr(fpRange.current, rangeCfg);
    }
    if (deleteOpen) {
      if (fpDelSingle.current) fpDelSingleInst.current = flatpickr(fpDelSingle.current, cfg);
      if (fpDelRange.current) fpDelRangeInst.current = flatpickr(fpDelRange.current, rangeCfg);
    }
    if (exportOpen) {
      if (fpExSingle.current) fpExSingleInst.current = flatpickr(fpExSingle.current, cfg);
      if (fpExRange.current) fpExRangeInst.current = flatpickr(fpExRange.current, rangeCfg);
    }

    return () => {
      [fpSingleInst, fpRangeInst, fpDelSingleInst, fpDelRangeInst, fpExSingleInst, fpExRangeInst].forEach(ref => {
        if (ref.current) { ref.current.destroy(); ref.current = null; }
      });
    };
  }, [bulkOpen, deleteOpen, exportOpen, bulkMode, deleteMode, exportMode]);
  // ↑ dayCreate is intentionally omitted from deps — it is now a stable ref

  useEffect(() => {
    if (!bulkOpen && !deleteOpen && !exportOpen) return;
    fetch(`${API_BASE()}/exam-dates`)
      .then(r => r.json())
      .then(dates => {
        const iso = dates.map(toISODate);
        setExamDates(iso);
        examDatesRef.current = iso;
        [fpSingleInst, fpRangeInst, fpDelSingleInst, fpDelRangeInst, fpExSingleInst, fpExRangeInst].forEach(ref => {
          if (ref.current) ref.current.redraw();
        });
      })
      .catch(() => { });
  }, [bulkOpen, deleteOpen, exportOpen]);

  /* ── Actions ── */
  const handleDownloadPDF = async (id) => {
    try {
      const res = await fetch(`${API_BASE()}/generate-pdf/${id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      const blob = await res.blob();
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `label_${id}.pdf`; a.click();
      toast.success('PDF Ready', `Label for session #${id} downloaded.`);
    } catch {
      toast.error('Download Failed', 'Could not generate PDF.');
    }
  };

  const [reportOpen, setReportOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);

  const handleAdminView = (id) => {
    const rec = records.find(r => r.id === id);
    if (rec) {
      setSelectedReport(rec);
      setReportOpen(true);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this session?')) return;
    await fetch(`${API_BASE()}/examination/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
    });
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
      const dates = fpRangeInst.current?.selectedDates || [];
      if (dates.length < 2) { toast.warning('Range Required', 'Please select a start and end date.'); return; }
      url += `?start_date=${dates[0].toISOString().split('T')[0]}&end_date=${dates[1].toISOString().split('T')[0]}`;
    }
    setGenerating(true);
    try {
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
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

  const handleExportStats = async () => {
    let url = `${API_BASE()}/export-stats`;
    if (exportMode === 'one') {
      const d = fpExSingleInst.current?.selectedDates[0];
      if (!d) { toast.warning('Date Required', 'Please select a date.'); return; }
      url += `?start_date=${d.toISOString().split('T')[0]}`;
    } else if (exportMode === 'range') {
      const dates = fpExRangeInst.current?.selectedDates || [];
      if (dates.length < 2) { toast.warning('Range Required', 'Please select a start and end date.'); return; }
      url += `?start_date=${dates[0].toISOString().split('T')[0]}&end_date=${dates[1].toISOString().split('T')[0]}`;
    }
    // if exportMode === 'all', no params – downloads everything
    setIsExporting(true);
    try {
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Export failed.'); }
      const blob = await res.blob();
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `exam_stats_${today}.xlsx`; a.click();
      setExportOpen(false);
      toast.success('Export Ready', 'Exam stats downloaded as Excel.');
    } catch (e) {
      toast.error('Export Failed', e.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm('Are you sure you want to permanently delete these sessions? This action cannot be undone.')) return;

    let url = `${API_BASE()}/examinations/bulk-delete`;
    if (deleteMode === 'one') {
      const d = fpDelSingleInst.current?.selectedDates[0];
      if (!d) { toast.warning('Date Required', 'Please select a date.'); return; }
      url += `?start_date=${d.toISOString().split('T')[0]}`;
    } else {
      const dates = fpDelRangeInst.current?.selectedDates || [];
      if (dates.length < 2) { toast.warning('Range Required', 'Please select a start and end date.'); return; }
      url += `?start_date=${dates[0].toISOString().split('T')[0]}&end_date=${dates[1].toISOString().split('T')[0]}`;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Deletion failed.');

      toast.success('Sessions Deleted', data.message);
      setDeleteOpen(false);
      loadRecords();
    } catch (e) {
      toast.error('Deletion Failed', e.message);
    } finally {
      setIsDeleting(false);
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
          <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => setDeleteOpen(true)}>🗑 Bulk Delete</button>
          <button className="btn btn-success" onClick={() => setExportOpen(true)}>📊 Export Stats</button>
          <button className="btn btn-outline" onClick={() => {
            fetch(`${API_BASE()}/download-template`).then(r => r.blob()).then(b => {
              const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'SOCS_Exam_Template.xlsx'; a.click();
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
            <input ref={fpSingle} className="modal-input" placeholder="📅 Select a date..." readOnly />
          </div>
        )}
        {bulkMode === 'range' && (
          <div className="input-row">
            <label>Select Date Range</label>
            <input ref={fpRange} className="modal-input" placeholder="📅 Select start and end date..." readOnly />
          </div>
        )}

        <button className="btn btn-primary btn-lg" onClick={handleBulkDownload} disabled={generating}>
          {generating ? <><div className="spinner spinner-sm" /> Generating…</> : 'Generate & Download PDF'}
        </button>
      </Modal>

      {/* ── BULK DELETE MODAL ── */}
      <Modal show={deleteOpen} onClose={() => setDeleteOpen(false)} title="🗑 Bulk Delete Sessions">
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '12px', borderRadius: '8px', marginBottom: '16px', color: '#991b1b', fontSize: '0.85rem' }}>
          <strong>Warning:</strong> Deleting sessions will permanently remove associated metrics and labels.
        </div>
        <div className="toggle-group">
          <button className={`toggle-btn${deleteMode === 'one' ? ' active' : ''}`} onClick={() => setDeleteMode('one')}>One Day</button>
          <button className={`toggle-btn${deleteMode === 'range' ? ' active' : ''}`} onClick={() => setDeleteMode('range')}>Date Range</button>
        </div>

        {deleteMode === 'one' && (
          <div className="input-row">
            <label>Select Date</label>
            <input ref={fpDelSingle} className="modal-input" placeholder="📅 Select a date..." readOnly />
          </div>
        )}
        {deleteMode === 'range' && (
          <div className="input-row">
            <label>Select Date Range</label>
            <input ref={fpDelRange} className="modal-input" placeholder="📅 Select start and end date..." readOnly />
          </div>
        )}

        <button className="btn btn-lg" style={{ width: '100%', background: 'var(--danger)', color: 'white' }} onClick={handleBulkDelete} disabled={isDeleting}>
          {isDeleting ? <><div className="spinner spinner-sm" /> Deleting…</> : 'Permanently Delete Sessions'}
        </button>
      </Modal>

      {/* ── REPORT MODAL ── */}
      <Modal show={reportOpen} onClose={() => setReportOpen(false)} title="📋 Session Report">
        {selectedReport && (
          <div className="report-content" style={{ textAlign: 'left' }}>
            <h3 style={{ margin: '0 0 16px 0', color: 'var(--primary)' }}>{selectedReport.course_name}</h3>
            <table style={{ width: '100%', marginBottom: '20px', borderCollapse: 'collapse' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border)' }}><td style={{ padding: '8px 0', fontWeight: 600 }}>Date & Time</td><td style={{ textAlign: 'right' }}>{selectedReport.exam_date} @ {selectedReport.exam_time}</td></tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}><td style={{ padding: '8px 0', fontWeight: 600 }}>Room</td><td style={{ textAlign: 'right' }}>{selectedReport.room_number}</td></tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}><td style={{ padding: '8px 0', fontWeight: 600 }}>Batch</td><td style={{ textAlign: 'right' }}>{selectedReport.program_batch}</td></tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}><td style={{ padding: '8px 0', fontWeight: 600 }}>Evaluator</td><td style={{ textAlign: 'right' }}>{selectedReport.evaluator_name}</td></tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}><td style={{ padding: '8px 0', fontWeight: 600 }}>Expected Students</td><td style={{ textAlign: 'right' }}>{selectedReport.num_students}</td></tr>
              </tbody>
            </table>

            <h4 style={{ margin: '0 0 12px 0', textTransform: 'uppercase', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Collection Metrics</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div style={{ background: 'var(--bg-app)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)' }}>{selectedReport.answer_sheets ?? '-'}</div>
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 600 }}>Sheets</div>
              </div>
              <div style={{ background: 'var(--bg-app)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--warning)' }}>{selectedReport.absent_count ?? '-'}</div>
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 600 }}>Absent</div>
              </div>
              <div style={{ background: 'var(--bg-app)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--danger)' }}>{selectedReport.ufm_count ?? '-'}</div>
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 600 }}>UFM</div>
              </div>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              {selectedReport.sync_at ? `Data verified by ${selectedReport.submitted_by} on ${new Date(selectedReport.sync_at).toLocaleString()}` : "Data not yet synchronized from invigilator terminal."}
            </p>
          </div>
        )}
      </Modal>

      {/* ── EXPORT STATS MODAL ── */}
      <Modal show={exportOpen} onClose={() => setExportOpen(false)} title="📊 Export Verified Exam Stats">
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Downloads an Excel file of all exams with submitted data. Only sessions where invigilators have synced results will be included.
        </p>
        <div className="toggle-group">
          <button className={`toggle-btn${exportMode === 'all' ? ' active' : ''}`} onClick={() => setExportMode('all')}>All Time</button>
          <button className={`toggle-btn${exportMode === 'one' ? ' active' : ''}`} onClick={() => setExportMode('one')}>One Day</button>
          <button className={`toggle-btn${exportMode === 'range' ? ' active' : ''}`} onClick={() => setExportMode('range')}>Date Range</button>
        </div>

        {exportMode === 'one' && (
          <div className="input-row">
            <label>Select Date</label>
            <input ref={fpExSingle} className="modal-input" placeholder="📅 Select a date..." readOnly />
          </div>
        )}
        {exportMode === 'range' && (
          <div className="input-row">
            <label>Select Date Range</label>
            <input ref={fpExRange} className="modal-input" placeholder="📅 Select start and end date..." readOnly />
          </div>
        )}
        {exportMode === 'all' && (
          <div style={{ background: 'var(--bg-app)', borderRadius: '8px', padding: '12px', marginBottom: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            📋 All verified sessions from all time will be exported.
          </div>
        )}

        <button className="btn btn-lg" style={{ width: '100%', background: 'var(--success)', color: 'white' }} onClick={handleExportStats} disabled={isExporting}>
          {isExporting ? <><div className="spinner spinner-sm" /> Exporting…</> : '⬇ Download Excel File'}
        </button>
      </Modal>
    </div>
  );
}
