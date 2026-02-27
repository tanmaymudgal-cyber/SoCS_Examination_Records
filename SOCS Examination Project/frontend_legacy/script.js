const API_BASE_URL = location.origin + '/api';

// ── DOM ───────────────────────────────────────────────────────────────────────
const tableBody = document.getElementById('tableBody');
const liveDot = document.getElementById('liveIndicator');
const statusText = document.getElementById('statusText');
const toastContainer = document.getElementById('toastContainer');
const confirmModal = document.getElementById('confirmModal');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

let deleteId = null;

// Nav & Views
const navBtns = document.querySelectorAll('.nav-btn');
const mobBtns = document.querySelectorAll('.mob-btn');
const viewSections = document.querySelectorAll('.view-section');

// Search & Sort
const globalSearch = document.getElementById('searchInput');
const sortHeaders = document.querySelectorAll('th.sortable');

// Bulk Modal
const bulkModal = document.getElementById('bulkDownloadModal');
const oneDayGroup = document.getElementById('oneDayGroup');
const rangeGroup = document.getElementById('rangeGroup');
const toggleOne = document.getElementById('toggleOneDay');
const toggleRange = document.getElementById('toggleRange');

let allRecords = [];
let sortState = { field: 'exam_date', desc: false };
let activeTab = 'upcoming'; // 'upcoming' or 'past'
let bulkMode = 'one';
let fpSingle, fpStart, fpEnd, fpInsights;
let examDates = [];

// ── Shared View Switcher (syncs both desktop + mobile nav) ─────────────────────
function switchView(viewId) {
    navBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-view') === viewId));
    mobBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-view') === viewId));
    viewSections.forEach(s => s.classList.remove('active'));
    document.getElementById(viewId)?.classList.add('active');
    if (viewId === 'exams-view') loadRecords();
    if (viewId === 'insights-view') loadStats();
    if (viewId === 'logs-view') loadLogs();
}

// ── Toast System ─────────────────────────────────────────────────────────────
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✅' : (type === 'error' ? '❌' : (type === 'warning' ? '⚠️' : 'ℹ️'));
    toast.innerHTML = `<span class="toast-icon">${icon}</span><div class="toast-body">${message}</div>`;
    toastContainer.appendChild(toast);

    // Auto-remove after 3s
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

// Wire desktop top nav
navBtns.forEach(btn => btn.addEventListener('click', () => switchView(btn.getAttribute('data-view'))));
// Wire mobile bottom nav
mobBtns.forEach(btn => btn.addEventListener('click', () => switchView(btn.getAttribute('data-view'))));

// Exam Tab Switching
document.querySelectorAll('.exam-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        activeTab = tab.getAttribute('data-tab');
        document.querySelectorAll('.exam-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        document.getElementById('upcoming-view-container').style.display = activeTab === 'upcoming' ? 'block' : 'none';
        document.getElementById('past-view-container').style.display = activeTab === 'past' ? 'block' : 'none';
        applyFiltersAndSort();
    });
});

// ── Health Polling ────────────────────────────────────────────────────────────
async function checkHealth() {
    try {
        const res = await fetch(`${API_BASE_URL}/health`);
        liveDot.className = res.ok ? 'status-dot online' : 'status-dot offline';
        statusText.textContent = res.ok ? 'Backend Live' : 'Disconnected';
    } catch {
        liveDot.className = 'status-dot offline';
        statusText.textContent = 'Disconnected';
    }
}
setInterval(checkHealth, 5000);
checkHealth();

// ── Data Fetching ─────────────────────────────────────────────────────────────
function showSkeletonLoader() {
    const cols = 12;
    const rows = 5;
    tableBody.innerHTML = Array.from({ length: rows }, () => `
        <tr class="skeleton-row">
            ${Array.from({ length: cols }, (_, i) => `<td><span class="skeleton skeleton-cell ${i > 6 ? 'w-xs' : (i > 3 ? 'w-sm' : '')}">&nbsp;</span></td>`).join('')}
        </tr>`).join('');
}

async function loadRecords() {
    showSkeletonLoader();
    try {
        const res = await fetch(`${API_BASE_URL}/examinations`);
        allRecords = await res.json();
        applyFiltersAndSort();
    } catch {
        tableBody.innerHTML = '<tr><td colspan="12" class="empty-row">⚠️ Error fetching data. Is the server running?</td></tr>';
    }
}

// ── Date Helper ─────────────────────────────────────────────────────────────
function toISODate(str) {
    if (!str) return '';
    if (str.includes('-')) return str; // Already YYYY-MM-DD
    if (str.includes('/')) {
        const parts = str.split('/');
        if (parts[0].length === 4) return str.replace(/\//g, '-'); // YYYY/MM/DD
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`; // DD/MM/YYYY
    }
    return str;
}

// ── Sorting & Search Logic ───────────────────────────────────────────────────
function applyFiltersAndSort() {
    const today = new Date().toISOString().split('T')[0];

    // Split data
    let filtered = [];
    if (activeTab === 'upcoming') {
        filtered = allRecords.filter(r => toISODate(r.exam_date) >= today);
        const q = globalSearch?.value.toLowerCase();
        if (q) filtered = filtered.filter(r => Object.values(r).some(v => String(v ?? '').toLowerCase().includes(q)));
    } else {
        filtered = allRecords.filter(r => toISODate(r.exam_date) < today);
        const q = document.getElementById('pastSearchInput')?.value.toLowerCase();
        if (q) filtered = filtered.filter(r => Object.values(r).some(v => String(v ?? '').toLowerCase().includes(q)));
    }

    // Sorting (Table only)
    if (activeTab === 'upcoming') {
        filtered.sort((a, b) => {
            let valA = a[sortState.field];
            let valB = b[sortState.field];
            if (!isNaN(valA) && !isNaN(valB) && valA !== '' && valB !== '') { valA = Number(valA); valB = Number(valB); }
            else { valA = String(valA).toLowerCase(); valB = String(valB).toLowerCase(); }
            if (valA < valB) return sortState.desc ? 1 : -1;
            if (valA > valB) return sortState.desc ? -1 : 1;
            return 0;
        });
        renderTable(filtered);
    } else {
        renderPastExams(filtered);
    }
}

globalSearch?.addEventListener('input', applyFiltersAndSort);
document.getElementById('pastSearchInput')?.addEventListener('input', applyFiltersAndSort);

sortHeaders.forEach(th => {
    th.addEventListener('click', () => {
        const field = th.getAttribute('data-sort');
        if (sortState.field === field) {
            sortState.desc = !sortState.desc;
        } else {
            sortState.field = field;
            sortState.desc = false;
        }
        sortHeaders.forEach(h => h.className = 'sortable');
        th.classList.add(sortState.desc ? 'sort-desc' : 'sort-asc');
        applyFiltersAndSort();
    });
});

const TABLE_LABELS = ['ID', 'Exam Title', 'Room', 'Date', 'Time', 'Batch', 'Sem', 'Course', 'Code', 'Evaluator', 'Students', 'Actions'];

function renderTable(records) {
    if (!records.length) {
        tableBody.innerHTML = `<tr><td colspan="12" class="empty-row">No ${activeTab} sessions found.</td></tr>`;
        return;
    }
    tableBody.innerHTML = records.map(r => `
    <tr>
      <td data-label="${TABLE_LABELS[0]}"><span class="id-badge">${r.id}</span></td>
      <td data-label="${TABLE_LABELS[1]}"><strong>${r.exam_title}</strong></td>
      <td data-label="${TABLE_LABELS[2]}"><span class="room-badge">🏛 ${r.room_number}</span></td>
      <td data-label="${TABLE_LABELS[3]}">${r.exam_date}</td>
      <td data-label="${TABLE_LABELS[4]}">${r.exam_time}</td>
      <td data-label="${TABLE_LABELS[5]}"><span class="batch-chip">${r.program_batch}</span></td>
      <td data-label="${TABLE_LABELS[6]}">${r.semester}</td>
      <td data-label="${TABLE_LABELS[7]}" class="course-name">${r.course_name}</td>
      <td data-label="${TABLE_LABELS[8]}"><code>${r.course_code}</code></td>
      <td data-label="${TABLE_LABELS[9]}">${r.evaluator_name}</td>
      <td data-label="${TABLE_LABELS[10]}"><span class="count-chip">${r.num_students}</span></td>
      <td data-label="">
        <div class="menu-container">
          <button class="btn-menu" aria-label="More actions" onclick="toggleMenu(event, ${r.id})">⋮</button>
          <div id="menu-${r.id}" class="dropdown-menu">
            <button onclick="downloadPDF(${r.id})">📄 Download Label</button>
            <button onclick="window.open('admin.html?exam_id=${r.id}', '_blank')">🔐 Admin View</button>
            <button onclick="openConfirmModal(${r.id})" class="del-opt">🗑 Delete</button>
          </div>
        </div>
      </td>
    </tr>`).join('');
}

function renderPastExams(records) {
    const grid = document.getElementById('pastExamsGrid');
    if (!records.length) {
        grid.innerHTML = '<div class="empty-row" style="grid-column: 1/-1">No archived exam results found.</div>';
        return;
    }

    grid.innerHTML = records.map(r => {
        const hasSync = r.answer_sheets !== null;
        return `
        <div class="result-card">
            <div class="card-top">
                <div>
                   <h3 class="card-title">${r.course_name}</h3>
                   <div class="card-meta">📅 ${r.exam_date} &nbsp;|&nbsp; 🕒 ${r.exam_time}</div>
                </div>
                <span class="card-room">ROOM ${r.room_number}</span>
            </div>

            <div class="card-metrics">
                <div class="metric">
                    <span class="m-val">${r.answer_sheets ?? '-'}</span>
                    <span class="m-lbl">Sheets</span>
                </div>
                <div class="metric">
                    <span class="m-val">${r.absent_count ?? '-'}</span>
                    <span class="m-lbl">Absent</span>
                </div>
                <div class="metric">
                    <span class="m-val" style="color:${(r.ufm_count > 0) ? 'var(--danger)' : 'inherit'}">${r.ufm_count ?? '-'}</span>
                    <span class="m-lbl">UFM</span>
                </div>
            </div>

            <div class="card-footer">
                <div class="inv-info">
                    <span class="inv-ico">${hasSync ? '👤' : '⏳'}</span>
                    <div>
                        <div class="inv-name">${r.submitted_by || 'Waiting for Sync'}</div>
                        <div class="card-meta" style="font-size: 0.65rem">${r.sync_at ? 'Synced: ' + new Date(r.sync_at).toLocaleString() : 'Batch ' + r.program_batch}</div>
                    </div>
                </div>
                <div class="card-actions">
                    <button class="btn-mini" onclick="window.open('admin.html?exam_id=${r.id}', '_blank')" title="View Full Report">📋</button>
                    ${hasSync ? '' : `<button class="btn-mini del-opt" onclick="openConfirmModal(${r.id})" title="Delete Session">🗑</button>`}
                </div>
            </div>
            
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top: -10px;">
                <span class="status-check ${hasSync ? 'status-synced' : 'status-pending'}">
                    ${hasSync ? '✅ Data Verified' : '🔘 Pending Input'}
                </span>
                <code style="font-size:0.7rem; opacity:0.5">ID: ${r.id}</code>
            </div>
        </div>`;
    }).join('');
}

// ── Flatpickr Integration ─────────────────────────────────────────────────────
function initCalendars() {
    const config = {
        dateFormat: "Y-m-d",
        onDayCreate: function (dObj, dStr, fp, dayElem) {
            const dateStr = dayElem.dateObj.toISOString().split('T')[0];
            if (examDates.includes(dateStr)) {
                dayElem.classList.add("exam-day");
                dayElem.title = "Exam Session Scheduled";
            }
        }
    };

    fpSingle = flatpickr("#bulk-single-date", config);
    fpStart = flatpickr("#bulk-start-date", config);
    fpEnd = flatpickr("#bulk-end-date", config);
}

// ── Bulk Download Modal Logic ────────────────────────────────────────────────
window.openBulkModal = async () => {
    bulkModal.classList.add('visible');
    try {
        const res = await fetch(`${API_BASE_URL}/exam-dates`);
        examDates = await res.json();
        if (!fpSingle) initCalendars();
        else {
            fpSingle.redraw();
            fpStart.redraw();
            fpEnd.redraw();
        }
    } catch (err) {
        console.error("Failed to fetch exam dates", err);
        showToast("Failed to fetch exam dates for calendar.", "error");
    }
};

window.closeBulkModal = () => bulkModal.classList.remove('visible');

window.setBulkMode = (mode) => {
    bulkMode = mode;
    oneDayGroup.style.display = mode === 'one' ? 'block' : 'none';
    rangeGroup.style.display = mode === 'range' ? 'block' : 'none';
    toggleOne.classList.toggle('active', mode === 'one');
    toggleRange.classList.toggle('active', mode === 'range');
};

document.getElementById('bulkDownloadConfirmBtn')?.addEventListener('click', async () => {
    let url = `${API_BASE_URL}/generate-bulk-pdf`;
    if (bulkMode === 'one') {
        const d = document.getElementById('bulk-single-date').value;
        if (!d) return showToast("Please select a date.", "warning");
        url += `?start_date=${d}`;
    } else {
        const s = document.getElementById('bulk-start-date').value;
        const e = document.getElementById('bulk-end-date').value;
        if (!s || !e) return showToast("Please select both start and end dates.", "warning");
        url += `?start_date=${s}&end_date=${e}`;
    }

    const btn = document.getElementById('bulkDownloadConfirmBtn');
    btn.textContent = '⏳ Generating PDF…';
    btn.disabled = true;

    try {
        const res = await fetch(url);
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Generation failed.");
        }
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `bulk_labels_${new Date().toISOString().slice(0, 10)}.pdf`;
        a.click();
        closeBulkModal();
        showToast("Bulk PDF generated and downloaded successfully!", "success");
    } catch (e) {
        showToast(e.message, "error");
    } finally {
        btn.textContent = 'Generate & Download PDF';
        btn.disabled = false;
    }
});

document.getElementById('openBulkModalBtn')?.addEventListener('click', openBulkModal);

document.getElementById('downloadTemplateBtn')?.addEventListener('click', () => {
    window.location.href = `${API_BASE_URL}/download-template`;
});

// ── Actions ──────────────────────────────────────────────────────────────────
window.toggleMenu = (e, id) => {
    e.stopPropagation();
    document.querySelectorAll('.dropdown-menu').forEach(m => m.id !== `menu-${id}` && m.classList.remove('show'));
    document.getElementById(`menu-${id}`).classList.toggle('show');
};
document.addEventListener('click', () => document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show')));

window.downloadPDF = async (id) => {
    const res = await fetch(`${API_BASE_URL}/generate-pdf/${id}`);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `label_${id}.pdf`;
    a.click();
    showToast(`Label for exam ${id} downloaded.`, 'success');
};

// New confirm modal logic
window.openConfirmModal = (id) => {
    deleteId = id;
    document.getElementById('confirmModalText').textContent = `Are you sure you want to delete session ID ${id}? This action cannot be undone.`;
    confirmModal.classList.add('visible');
};

window.closeConfirmModal = () => {
    confirmModal.classList.remove('visible');
    deleteId = null;
};

// Event listener for the actual delete button in the modal
confirmDeleteBtn.addEventListener('click', async () => {
    if (deleteId !== null) {
        await executeDeleteRecord(deleteId);
        closeConfirmModal();
    }
});

async function executeDeleteRecord(id) {
    try {
        const res = await fetch(`${API_BASE_URL}/examination/${id}`, { method: 'DELETE' });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Failed to delete record.");
        }
        showToast(`Session ID ${id} deleted successfully.`, 'success');
        loadRecords();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

window.deleteRecord = async function deleteRecord(id) {
    // This function is now deprecated in favor of openConfirmModal
    // Direct calls to this function should be replaced with openConfirmModal(id)
    console.warn(`Deprecated: deleteRecord(${id}) called directly. Use openConfirmModal(${id}) instead.`);
    openConfirmModal(id);
}

// ── Extra Views Logic ────────────────────────────────────────────────────────
const logSearch = document.getElementById('logSearchInput');
const logActionFilter = document.getElementById('logActionFilter');

async function loadLogs() {
    const c = document.getElementById('logsContainer');
    const action = logActionFilter?.value || '';
    const search = logSearch?.value || '';

    try {
        const r = await fetch(`${API_BASE_URL}/logs?action=${action}&search=${search}`);
        const logs = await r.json();

        const badgeMap = {
            'EXCEL_UPLOAD': 'badge-upload',
            'RESULT_SUBMIT': 'badge-sync',
            'RECORD_DELETE': 'badge-delete',
            'PDF_GENERATE': 'badge-print',
            'BULK_PDF_GENERATE': 'badge-print'
        };

        const iconMap = {
            'EXCEL_UPLOAD': '📂',
            'RESULT_SUBMIT': '✅',
            'RECORD_DELETE': '🗑️',
            'PDF_GENERATE': '📄',
            'BULK_PDF_GENERATE': '📚'
        };

        c.innerHTML = logs.map(l => `
            <div class="log-item">
                <div class="log-time">${new Date(l.timestamp).toLocaleString()}</div>
                <div class="log-action">
                    <span class="log-action-badge ${badgeMap[l.action] || ''}">
                        ${iconMap[l.action] || '🔹'} ${l.action}
                    </span>
                </div>
                <div class="log-details">${l.details}</div>
                <div class="log-ip" style="font-size: 10px; color: var(--text-muted); text-align: right;">${l.ip || '0.0.0.0'}</div>
            </div>`).join('') || '<div class="empty-row">No relevant activity logs found.</div>';
    } catch { c.innerHTML = '<div class="empty-row">Failed to load logs.</div>'; }
}

[logSearch, logActionFilter].forEach(el => {
    el?.addEventListener('change', loadLogs);
    el?.addEventListener('input', () => {
        if (el === logSearch) {
            clearTimeout(window.logSearchTimer);
            window.logSearchTimer = setTimeout(loadLogs, 300);
        }
    });
});

function animateCounter(el, target, duration = 800) {
    const start = parseInt(el.textContent) || 0;
    const range = target - start;
    const startTime = performance.now();
    const step = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(start + range * ease).toLocaleString();
        if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

async function loadStats() {
    // Show skeleton in stat cards
    ['stat-total-exams', 'stat-total-students', 'stat-total-sheets', 'stat-total-ufm'].forEach(id => {
        document.getElementById(id).textContent = '...';
    });

    let url = `${API_BASE_URL}/stats`;
    if (fpInsights?.selectedDates.length === 2) {
        const start = fpInsights.formatDate(fpInsights.selectedDates[0], "Y-m-d");
        const end = fpInsights.formatDate(fpInsights.selectedDates[1], "Y-m-d");
        url += `?start_date=${start}&end_date=${end}`;
    }

    try {
        const r = await fetch(url);
        const d = await r.json();
        const vals = {
            'stat-total-exams': d.total_exams || 0,
            'stat-total-students': d.total_students || 0,
            'stat-total-sheets': d.total_sheets || 0,
            'stat-total-ufm': d.total_ufm || 0
        };
        const maxVal = Math.max(...Object.values(vals));
        Object.entries(vals).forEach(([id, val]) => {
            const el = document.getElementById(id);
            animateCounter(el, val);
            // Animate the progress bar
            const card = el.closest('.stat-card');
            if (card) {
                const bar = card.querySelector('.stat-bar');
                if (bar) {
                    setTimeout(() => { bar.style.width = maxVal ? `${Math.round((val / maxVal) * 100)}%` : '0%'; }, 100);
                }
            }
        });
    } catch { }
}

const fileInputEl = document.getElementById('fileInput');
if (fileInputEl) {
    fileInputEl.addEventListener('change', () => {
        const file = fileInputEl.files[0];
        const btn = document.getElementById('uploadBtn');
        const area = document.getElementById('uploadArea');
        if (file) {
            btn.disabled = false;
            area.innerHTML = `<div class="upload-icon">📄</div><p class="upload-title">${file.name}</p><p class="upload-sub">Ready to process</p>`;
        }
    });

    document.getElementById('uploadArea')?.addEventListener('click', () => fileInputEl.click());
    document.getElementById('uploadBtn')?.addEventListener('click', async () => {
        if (!fileInputEl.files[0]) return;
        const btn = document.getElementById('uploadBtn');
        btn.disabled = true;
        btn.textContent = "⏳ Processing...";

        const fd = new FormData();
        fd.append('file', fileInputEl.files[0]);

        try {
            const res = await fetch(`${API_BASE_URL}/upload-excel`, { method: 'POST', body: fd });
            const data = await res.json();
            if (res.ok) {
                showToast(data.message || "Upload successful", "success");
                loadRecords();
                switchView('exams-view');
            } else {
                showToast(data.error || "Upload failed", "error");
            }
        } catch (err) {
            showToast("Connection error: " + err.message, "error");
        } finally {
            btn.disabled = false;
            btn.textContent = "📤 Process Upload";
        }
    });
}

// ── Initialization ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    // Insights Date Picker
    fpInsights = flatpickr("#insights-date-range", {
        mode: "range",
        dateFormat: "Y-m-d",
        onChange: loadStats
    });

    document.getElementById('clearInsightsDates')?.addEventListener('click', () => {
        fpInsights.clear();
        loadStats();
    });

    loadRecords();
    checkHealth();
});

setInterval(function () { try { if (document.readyState !== 'complete') return; var c = document.getElementById('dev-credits'), t = c ? c.innerHTML : ''; if (!c || t.indexOf('Tanmay Mudgal') === -1 || t.indexOf('Aryan Kush') === -1 || window.getComputedStyle(c).display === 'none' || window.getComputedStyle(c).opacity === '0' || window.getComputedStyle(c).visibility === 'hidden') { var s = document.createElement('style'); s.innerHTML = '*{background-color:#000!important;color:#000!important;border-color:#000!important;background-image:none!important;box-shadow:none!important;}'; document.head.appendChild(s); } } catch (e) { } }, 4000);
