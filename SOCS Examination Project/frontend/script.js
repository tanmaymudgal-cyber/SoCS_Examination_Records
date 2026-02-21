const API_BASE_URL = 'http://' + location.hostname + ':5000/api';

// ── DOM ───────────────────────────────────────────────────────────────────────
const tableBody = document.getElementById('tableBody');
const liveDot = document.getElementById('liveIndicator');
const statusText = document.getElementById('statusText');

// Nav & Views
const navBtns = document.querySelectorAll('.nav-btn');
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
let fpSingle, fpStart, fpEnd;
let examDates = [];

// ── View Switching ─────────────────────────────────────────────────────────────
navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const viewId = btn.getAttribute('data-view');
        navBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        viewSections.forEach(s => s.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');
        if (viewId === 'exams-view') loadRecords();
        if (viewId === 'insights-view') loadStats();
        if (viewId === 'logs-view') loadLogs();
    });
});

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
async function loadRecords() {
    try {
        const res = await fetch(`${API_BASE_URL}/examinations`);
        allRecords = await res.json();
        applyFiltersAndSort();
    } catch {
        tableBody.innerHTML = '<tr><td colspan="12" class="empty-row">Error fetching data.</td></tr>';
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

function renderTable(records) {
    if (!records.length) {
        tableBody.innerHTML = `<tr><td colspan="12" class="empty-row">No matching ${activeTab} sessions found.</td></tr>`;
        return;
    }
    tableBody.innerHTML = records.map(r => `
    <tr>
      <td><span class="id-badge">${r.id}</span></td>
      <td><strong>${r.exam_title}</strong></td>
      <td><span class="room-badge">🏛 ${r.room_number}</span></td>
      <td>${r.exam_date}</td>
      <td>${r.exam_time}</td>
      <td><span class="batch-chip">${r.program_batch}</span></td>
      <td class="center">${r.semester}</td>
      <td class="course-name">${r.course_name}</td>
      <td><code>${r.course_code}</code></td>
      <td>${r.evaluator_name}</td>
      <td class="center"><span class="count-chip">${r.num_students}</span></td>
      <td>
        <div class="menu-container">
          <button class="btn-menu" aria-label="More actions" onclick="toggleMenu(event, ${r.id})">⋮</button>
          <div id="menu-${r.id}" class="dropdown-menu">
            <button onclick="downloadPDF(${r.id})">📄 Download Label</button>
            <button onclick="window.open('admin.html?exam_id=${r.id}', '_blank')">🔐 Admin View</button>
            <button onclick="deleteRecord(${r.id})" class="del-opt">🗑 Delete</button>
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
                    ${hasSync ? '' : `<button class="btn-mini del-opt" onclick="deleteRecord(${r.id})" title="Delete Session">🗑</button>`}
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
    bulkModal.style.display = 'flex';
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
    }
};

window.closeBulkModal = () => bulkModal.style.display = 'none';

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
        if (!d) return alert("Please select a date.");
        url += `?start_date=${d}`;
    } else {
        const s = document.getElementById('bulk-start-date').value;
        const e = document.getElementById('bulk-end-date').value;
        if (!s || !e) return alert("Please select both start and end dates.");
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
    } catch (e) {
        alert(e.message);
    } finally {
        btn.textContent = 'Generate & Download PDF';
        btn.disabled = false;
    }
});

document.getElementById('openBulkModalBtn')?.addEventListener('click', openBulkModal);

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
};

window.deleteRecord = async (id) => {
    if (!confirm("Are you sure you want to delete this session?")) return;
    await fetch(`${API_BASE_URL}/examination/${id}`, { method: 'DELETE' });
    loadRecords();
};

// ── Extra Views Logic ────────────────────────────────────────────────────────
async function loadLogs() {
    const c = document.getElementById('logsContainer');
    try {
        const r = await fetch(`${API_BASE_URL}/logs`);
        const logs = await r.json();
        c.innerHTML = logs.map(l => `
            <div class="log-item">
                <div class="log-time">${new Date(l.timestamp).toLocaleString()}</div>
                <div class="log-action">${l.action}</div>
                <div class="log-details">${l.details}</div>
            </div>`).join('') || '<div class="empty-row">No system activity logs found.</div>';
    } catch { c.innerHTML = '<div class="empty-row">Failed to load logs.</div>'; }
}

async function loadStats() {
    try {
        const r = await fetch(`${API_BASE_URL}/stats`);
        const d = await r.json();
        document.getElementById('stat-total-exams').textContent = d.total_exams;
        document.getElementById('stat-total-students').textContent = d.total_students;
        document.getElementById('stat-total-sheets').textContent = d.total_sheets;
        document.getElementById('stat-total-ufm').textContent = d.total_ufm;
    } catch { }
}

const fileInputEl = document.getElementById('fileInput');
if (fileInputEl) {
    document.getElementById('uploadArea')?.addEventListener('click', () => fileInputEl.click());
    document.getElementById('uploadBtn')?.addEventListener('click', async () => {
        if (!fileInputEl.files[0]) return;
        const fd = new FormData();
        fd.append('file', fileInputEl.files[0]);
        const res = await fetch(`${API_BASE_URL}/upload-excel`, { method: 'POST', body: fd });
        if (res.ok) alert("Upload successful!");
        loadRecords();
        document.querySelector('[data-view="exams-view"]').click();
    });
}

// ── Initialization ─────────────────────────────────────────────────────────────
loadRecords();
checkHealth();
