import React, { useState, useRef, useCallback } from 'react';
import { API_BASE } from '../hooks/useApi';

export default function UploadView({ toast }) {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const handleFile = useCallback((f) => {
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls'].includes(ext)) {
      toast.error('Invalid File', 'Please upload an .xlsx or .xls file.');
      return;
    }
    setFile(f);
  }, [toast]);

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const onUpload = async () => {
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    const token = localStorage.getItem('auth_token') || '';
    try {
      const res = await fetch(`${API_BASE()}/upload-excel`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: fd,
      });
      if (res.ok) {
        toast.success('Upload Complete', `"${file.name}" was processed successfully.`);
        setFile(null);
      } else {
        const d = await res.json();
        toast.error('Upload Failed', d.error || 'Server error.');
      }
    } catch {
      toast.error('Network Error', 'Could not reach the backend server.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="page-section">
      <header className="view-header">
        <div>
          <h1>Upload Schedule</h1>
          <p>Import examination data from Excel sheets</p>
        </div>
      </header>

      <div className="content-centered">
        <div className="card">
          <div className="card-body">
            {/* Drop Zone */}
            <div
              className={`upload-area${dragging ? ' drag-over' : ''}`}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <span className="upload-icon">{file ? '📊' : '📁'}</span>
              {file ? (
                <>
                  <p className="upload-title">File Selected</p>
                  <p className="file-chosen">✅ {file.name}</p>
                  <p className="upload-sub" style={{ marginTop: 8 }}>
                    {(file.size / 1024).toFixed(1)} KB · Click to change
                  </p>
                </>
              ) : (
                <>
                  <p className="upload-title">Drop your Excel file here</p>
                  <p className="upload-sub">or click to browse (.xlsx / .xls)</p>
                </>
              )}
              <input ref={inputRef} type="file" accept=".xlsx,.xls" hidden onChange={e => handleFile(e.target.files[0])} />
            </div>

            {/* Upload Button */}
            <button
              className="btn btn-primary btn-lg"
              disabled={!file || uploading}
              onClick={onUpload}
            >
              {uploading
                ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'white' }} /> Processing…</>
                : '📤 Process Upload'}
            </button>

            {/* Info card */}
            <div className="status-msg info" style={{ marginTop: 20 }}>
              ℹ️ Ensure your Excel file matches the standard SoCS exam template. Duplicate rows are automatically skipped.
            </div>
          </div>
        </div>

        {/* Format Guide */}
        <div className="card">
          <div className="card-header"><h2>📋 Required Excel Columns</h2></div>
          <div className="card-body">
            <table>
              <thead>
                <tr><th>Column</th><th>Example Value</th></tr>
              </thead>
              <tbody>
                {[
                  ['Exam Title', 'SoCS Mid Sem Exam March 2025'],
                  ['Room Number', '2001'],
                  ['Date of Exam', '05/03/2025'],
                  ['Time', '02:00 PM - 04:00 PM'],
                  ['Program / Batch', 'BT-CSE-II-B1'],
                  ['Semester', '2'],
                  ['Course Name', 'Computer Organization and Architecture'],
                  ['Course Code', 'CSEG1032'],
                  ['Name of Evaluator', 'Rajib Banerjee'],
                  ['No. of Students', '29'],
                ].map(([col, ex]) => (
                  <tr key={col}>
                    <td><code>{col}</code></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{ex}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
