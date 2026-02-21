from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import pandas as pd
import sqlite3
import qrcode
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.lib import colors
from reportlab.platypus import Table, TableStyle
import json, io, os, socket
from datetime import datetime

app = Flask(__name__)
CORS(app)

# ─── helpers ──────────────────────────────────────────────────────────────────

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

FRONTEND_PORT = 8000
BACKEND_PORT  = 5000

def frontend_url(path):
    return f"http://{get_local_ip()}:{FRONTEND_PORT}{path}"

# ─── database ─────────────────────────────────────────────────────────────────

DB_PATH = os.path.join(os.path.dirname(__file__), "exams.db")

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_conn()
    cur  = conn.cursor()

    # Drop old table if columns have changed (dev convenience)
    # In production you would use migrations instead.
    cur.execute('''
        CREATE TABLE IF NOT EXISTS examinations (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            exam_title       TEXT    NOT NULL,
            room_number      TEXT    NOT NULL,
            exam_date        TEXT    NOT NULL,
            exam_time        TEXT    NOT NULL,
            program_batch    TEXT    NOT NULL,
            semester         TEXT,
            course_name      TEXT    NOT NULL,
            course_code      TEXT    NOT NULL,
            evaluator_name   TEXT    NOT NULL,
            num_students     INTEGER NOT NULL DEFAULT 0,
            created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS exam_results (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            exam_id          INTEGER NOT NULL,
            answer_sheets    INTEGER DEFAULT 0,
            ufm_count        INTEGER DEFAULT 0,
            absent_count     INTEGER DEFAULT 0,
            remarks          TEXT,
            submitted_by     TEXT,
            submitted_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (exam_id) REFERENCES examinations(id) ON DELETE CASCADE
        )
    ''')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS activity_logs (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            action      TEXT    NOT NULL,
            details     TEXT,
            ip_address  TEXT
        )
    ''')

    conn.commit()
    conn.close()

init_db()

# ─── logging ──────────────────────────────────────────────────────────────────

def log_activity(action, details=None):
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    try:
        ip_addr = request.remote_addr
    except Exception:
        ip_addr = '0.0.0.0'

    try:
        conn = get_conn()
        conn.execute(
            "INSERT INTO activity_logs (action, details, ip_address) VALUES (?, ?, ?)",
            (action, details, ip_addr)
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"DB log failed: {e}")

    log_file = os.path.join(os.path.dirname(__file__), "development.log")
    try:
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(f"[{timestamp}] [{ip_addr}] ACTION: {action} | DETAILS: {details}\n")
    except Exception as e:
        print(f"File log failed: {e}")

# ─── row helpers ──────────────────────────────────────────────────────────────

def row_to_exam(row):
    keys = ["id","exam_title","room_number","exam_date","exam_time",
            "program_batch","semester","course_name","course_code",
            "evaluator_name","num_students","created_at",
            "answer_sheets", "ufm_count", "absent_count", "remarks", "submitted_by", "sync_at"]
    return dict(zip(keys, row))

def row_to_result(row):
    keys = ["id","exam_id","answer_sheets","ufm_count","absent_count",
            "remarks","submitted_by","submitted_at"]
    return dict(zip(keys, row))

# ─── routes ───────────────────────────────────────────────────────────────────

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'message': 'SOCS Exam API is running'}), 200


@app.route('/api/upload-excel', methods=['POST'])
def upload_excel():
    """Upload Excel and insert exam session rows."""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        fname = file.filename or ''
        engine = 'xlrd' if fname.lower().endswith('.xls') else 'openpyxl'
        df = pd.read_excel(file, engine=engine)

        # Normalize column names
        df.columns = (df.columns
                      .str.strip()
                      .str.lower()
                      .str.replace(r'[\s/]+', '_', regex=True)
                      .str.replace(r'[^a-z0-9_]', '', regex=True))

        # Expected columns (normalised)
        col_map = {
            'exam_title':     ['exam_title'],
            'room_number':    ['room_number'],
            'exam_date':      ['exam_date', 'date_of_exam'],
            'exam_time':      ['exam_time', 'time'],
            'program_batch':  ['program__batch', 'program_batch', 'program'],
            'semester':       ['semester', 'sem'],
            'course_name':    ['course_name'],
            'course_code':    ['course_code'],
            'evaluator_name': ['evaluator_name', 'name_of_evaluator'],
            'num_students':   ['num_students', 'no_of_students', 'no__of_students'],
        }

        def getcol(row, aliases):
            for a in aliases:
                if a in df.columns:
                    v = row.get(a, '')
                    return '' if pd.isna(v) else str(v).strip()
            return ''

        conn = get_conn()
        cur  = conn.cursor()
        inserted = 0

        for _, row in df.iterrows():
            cur.execute('''
                INSERT INTO examinations
                    (exam_title, room_number, exam_date, exam_time,
                     program_batch, semester, course_name, course_code,
                     evaluator_name, num_students)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                getcol(row, col_map['exam_title']),
                getcol(row, col_map['room_number']),
                getcol(row, col_map['exam_date']),
                getcol(row, col_map['exam_time']),
                getcol(row, col_map['program_batch']),
                getcol(row, col_map['semester']),
                getcol(row, col_map['course_name']),
                getcol(row, col_map['course_code']),
                getcol(row, col_map['evaluator_name']),
                int(getcol(row, col_map['num_students']) or 0),
            ))
            inserted += 1

        conn.commit()
        conn.close()
        log_activity("EXCEL_UPLOAD", f"Filename: {file.filename}, Records: {inserted}")
        return jsonify({'message': f'Successfully imported {inserted} records', 'count': inserted}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/examinations', methods=['GET'])
def get_examinations():
    try:
        conn = get_conn()
        cur  = conn.cursor()
        # Join with results to get sheets/ufm/absent count in one go
        # Use r.submitted_at as sync_at
        query = """
            SELECT e.*, r.answer_sheets, r.ufm_count, r.absent_count, r.remarks, r.submitted_by, r.submitted_at as sync_at
            FROM examinations e
            LEFT JOIN exam_results r ON e.id = r.exam_id
            ORDER BY e.exam_date DESC, e.exam_time DESC
        """
        cur.execute(query)
        rows = cur.fetchall()
        conn.close()
        return jsonify([row_to_exam(r) for r in rows]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/examination/<int:exam_id>', methods=['GET'])
def get_examination(exam_id):
    try:
        conn = get_conn()
        cur  = conn.cursor()
        cur.execute('SELECT * FROM examinations WHERE id = ?', (exam_id,))
        row = cur.fetchone()
        conn.close()
        if not row:
            return jsonify({'error': 'Record not found'}), 404
        return jsonify(row_to_exam(row)), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/examination/<int:exam_id>', methods=['DELETE'])
def delete_examination(exam_id):
    try:
        conn = get_conn()
        conn.execute('DELETE FROM examinations WHERE id = ?', (exam_id,))
        conn.commit()
        conn.close()
        log_activity("RECORD_DELETE", f"Exam ID: {exam_id}")
        return jsonify({'message': 'Record deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── exam results (answer sheets / UFM / absent) ──────────────────────────────

@app.route('/api/results/submit', methods=['POST'])
def submit_results():
    """
    POST body:
    {
        "exam_id":       <int>,
        "answer_sheets": <int>,
        "ufm_count":     <int>,
        "absent_count":  <int>,
        "remarks":       <str>  (optional)
        "submitted_by":  <str>  (optional)
    }
    """
    try:
        data = request.get_json(force=True)
        if not data:
            return jsonify({'error': 'No JSON body'}), 400

        exam_id       = data.get('exam_id')
        answer_sheets = int(data.get('answer_sheets', 0))
        ufm_count     = int(data.get('ufm_count',     0))
        absent_count  = int(data.get('absent_count',  0))
        remarks       = data.get('remarks',       '')
        submitted_by  = data.get('submitted_by',  '')

        if exam_id is None:
            return jsonify({'error': 'exam_id is required'}), 400

        conn = get_conn()
        cur  = conn.cursor()
        cur.execute('SELECT id FROM examinations WHERE id = ?', (exam_id,))
        if not cur.fetchone():
            conn.close()
            return jsonify({'error': 'Examination not found'}), 404

        cur.execute('''
            INSERT OR REPLACE INTO exam_results
                (exam_id, answer_sheets, ufm_count, absent_count, remarks, submitted_by)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (exam_id, answer_sheets, ufm_count, absent_count, remarks, submitted_by))
        conn.commit()
        new_id = cur.lastrowid
        conn.close()

        log_activity("RESULT_SUBMIT",
                     f"Exam ID: {exam_id}, Sheets: {answer_sheets}, UFM: {ufm_count}, Absent: {absent_count}")
        return jsonify({'message': 'Results submitted successfully', 'result_id': new_id}), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/results/<int:exam_id>', methods=['GET'])
def get_results(exam_id):
    try:
        conn = get_conn()
        cur  = conn.cursor()
        cur.execute('SELECT * FROM exam_results WHERE exam_id = ? ORDER BY submitted_at DESC', (exam_id,))
        rows = cur.fetchall()
        conn.close()
        return jsonify([row_to_result(r) for r in rows]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/exam/<int:exam_id>', methods=['GET'])
def admin_exam_view(exam_id):
    """Full admin view: exam info + all submitted results."""
    try:
        conn = get_conn()
        cur  = conn.cursor()
        cur.execute('SELECT * FROM examinations WHERE id = ?', (exam_id,))
        row = cur.fetchone()
        if not row:
            conn.close()
            return jsonify({'error': 'Record not found'}), 404
        exam = row_to_exam(row)
        cur.execute('SELECT * FROM exam_results WHERE exam_id = ? ORDER BY submitted_at DESC', (exam_id,))
        exam['results'] = [row_to_result(r) for r in cur.fetchall()]
        conn.close()
        return jsonify(exam), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── PDF / QR ─────────────────────────────────────────────────────────────────

def make_qr(url: str) -> io.BytesIO:
    qr = qrcode.QRCode(version=None, box_size=6, border=3,
                        error_correction=qrcode.constants.ERROR_CORRECT_M)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return buf


def draw_label(pdf, exam, x, y, w, h, admin_url, input_url):
    """
    Draw a single exam label box at (x, y) with dimensions (w × h) points.
    Matches the official SOCS label template.
    """
    # ── outer border ────────────────────────────────────────────────────────
    pdf.setStrokeColorRGB(0.08, 0.18, 0.4)
    pdf.setLineWidth(1.5)
    pdf.rect(x, y, w, h, fill=False, stroke=True)

    # ── header bar ──────────────────────────────────────────────────────────
    HDR_H = 28
    pdf.setFillColorRGB(0.08, 0.18, 0.4)
    pdf.rect(x, y + h - HDR_H, w, HDR_H, fill=True, stroke=False)

    pdf.setFillColorRGB(1, 1, 1)
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawCentredString(x + w * 0.5, y + h - HDR_H + 8, exam['exam_title'].upper())

    # Room number — right-aligned in header
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawRightString(x + w - 8, y + h - HDR_H + 8,
                        f"Room No. : {exam['room_number']}")

    # ── content area ────────────────────────────────────────────────────────
    CONTENT_Y = y + h - HDR_H - 6
    LINE_H     = 15
    LABEL_W    = 120
    LEFT       = x + 10
    VAL_X      = x + LABEL_W

    def draw_row(label, value, cy):
        pdf.setFillColorRGB(0.35, 0.35, 0.35)
        pdf.setFont("Helvetica-Bold", 8)
        pdf.drawString(LEFT, cy, label)
        pdf.setFillColorRGB(0, 0, 0)
        pdf.setFont("Helvetica", 8)
        pdf.drawString(VAL_X, cy, str(value or "—"))

    rows_data = [
        ("Date of Exam      :",  exam['exam_date']),
        ("Time              :",  exam['exam_time']),
        ("Program / Batch   :",  exam['program_batch']),
        ("Semester          :",  exam['semester']),
        ("Course Name       :",  exam['course_name']),
        ("Course Code       :",  exam['course_code']),
        ("Name of Evaluator :",  exam['evaluator_name']),
        ("No. of Students   :",  str(exam['num_students'])),
    ]

    cy = CONTENT_Y
    for label, value in rows_data:
        draw_row(label, value, cy)
        cy -= LINE_H

    # ── fill-in line ────────────────────────────────────────────────────────
    cy -= 4
    pdf.setFillColorRGB(0, 0, 0)
    pdf.setFont("Helvetica-Bold", 8)
    fill_text = "Total Ans. Sheets : ______     UFM : ____     Absent : ____"
    pdf.drawString(LEFT, cy, fill_text)

    # ── divider ─────────────────────────────────────────────────────────────
    cy -= 8
    pdf.setStrokeColorRGB(0.7, 0.7, 0.7)
    pdf.setLineWidth(0.5)
    pdf.line(x + 6, cy, x + w - 6, cy)
    cy -= 8

    # ── QR code ─────────────────────────────────────────────────────────────
    QR_SIZE = 70  # Slightly larger since there is only one

    # QR — Result Input
    qr_buf = make_qr(input_url)
    pdf.drawImage(ImageReader(qr_buf), LEFT, cy - QR_SIZE,
                  width=QR_SIZE, height=QR_SIZE)
    pdf.setFont("Helvetica-Bold", 8)
    pdf.setFillColorRGB(0.05, 0.5, 0.25)
    pdf.drawString(LEFT, cy - QR_SIZE - 12, "📋 ENTER RESULTS SCAN")

    # ── signature lines ──────────────────────────────────────────────────────
    SIG_Y = y + 18
    MID   = x + w / 2

    pdf.setFillColorRGB(0, 0, 0)
    pdf.setFont("Helvetica", 7)
    pdf.line(LEFT, SIG_Y + 10, LEFT + 80, SIG_Y + 10)
    pdf.drawString(LEFT, SIG_Y, "Sign Invigilator 1")
    pdf.line(MID + 10, SIG_Y + 10, MID + 10 + 80, SIG_Y + 10)
    pdf.drawString(MID + 10, SIG_Y, "Sign Invigilator 2")


@app.route('/api/generate-pdf/<int:exam_id>', methods=['GET'])
def generate_pdf(exam_id):
    """Generate ONE PDF for a single exam session (Single Label)."""
    try:
        conn = get_conn()
        cur  = conn.cursor()
        cur.execute('SELECT * FROM examinations WHERE id = ?', (exam_id,))
        row  = cur.fetchone()
        conn.close()
        if not row: return jsonify({'error': 'Not found'}), 404

        exam = row_to_exam(row)
        admin_url = frontend_url(f"/admin.html?exam_id={exam_id}")
        input_url = frontend_url(f"/results.html?exam_id={exam_id}")

        buf = io.BytesIO()
        pdf = canvas.Canvas(buf, pagesize=A4)
        W, H = A4
        MARGIN = 24
        LBL_W = W - 2*MARGIN
        LBL_H = (H - 2*MARGIN - 16) / 2 # Size of one label

        # Draw just one at the top
        draw_label(pdf, exam, MARGIN, H - MARGIN - LBL_H, LBL_W, LBL_H, admin_url, input_url)
        pdf.save()
        buf.seek(0)

        log_activity("PDF_GENERATE", f"Exam ID: {exam_id}")
        safe = f"{exam['course_code']}_{exam['room_number']}".replace(" ","_")
        return send_file(buf, mimetype='application/pdf', as_attachment=True, download_name=f'label_{safe}.pdf')
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/exam-dates', methods=['GET'])
def get_exam_dates():
    """Return unique dates that have exam sessions."""
    try:
        conn = get_conn()
        cur  = conn.cursor()
        cur.execute('SELECT DISTINCT exam_date FROM examinations')
        dates = [r[0] for r in cur.fetchall()]
        conn.close()
        return jsonify(dates)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/generate-bulk-pdf', methods=['GET'])
def generate_bulk_pdf():
    """
    Generate a multipage PDF containing examinations.
    Query parameters: start_date, end_date (optional)
    """
    try:
        start_date = request.args.get('start_date')
        end_date   = request.args.get('end_date')

        conn = get_conn()
        cur  = conn.cursor()
        
        query = 'SELECT * FROM examinations'
        params = []
        
        if start_date and end_date:
            query += ' WHERE exam_date BETWEEN ? AND ?'
            params = [start_date, end_date]
        elif start_date:
            query += ' WHERE exam_date = ?'
            params = [start_date]
            
        query += ' ORDER BY exam_date ASC, room_number ASC'
        cur.execute(query, params)
        rows = cur.fetchall()
        conn.close()

        if not rows:
            return jsonify({'error': 'No examinations found for the selected criteria'}), 404

        exams = [row_to_exam(r) for r in rows]

        buf = io.BytesIO()
        pdf = canvas.Canvas(buf, pagesize=A4)
        W, H = A4
        MARGIN = 24
        GAP    = 16
        LBL_W  = W - 2 * MARGIN
        LBL_H  = (H - 2 * MARGIN - GAP) / 2

        for i in range(0, len(exams), 2):
            # Label 1 (Top)
            exam1 = exams[i]
            input_url1 = frontend_url(f"/results.html?exam_id={exam1['id']}")
            admin_url1 = frontend_url(f"/admin.html?exam_id={exam1['id']}")
            draw_label(pdf, exam1, MARGIN, MARGIN + LBL_H + GAP, LBL_W, LBL_H, admin_url1, input_url1)

            # Label 2 (Bottom) - if exists
            if i + 1 < len(exams):
                exam2 = exams[i+1]
                input_url2 = frontend_url(f"/results.html?exam_id={exam2['id']}")
                admin_url2 = frontend_url(f"/admin.html?exam_id={exam2['id']}")
                draw_label(pdf, exam2, MARGIN, MARGIN, LBL_W, LBL_H, admin_url2, input_url2)

                # separator line
                pdf.setStrokeColorRGB(0.7, 0.7, 0.7)
                pdf.setLineWidth(0.5)
                pdf.setDash(4, 4)
                mid_y = MARGIN + LBL_H + GAP / 2
                pdf.line(MARGIN, mid_y, W - MARGIN, mid_y)
                pdf.setDash()

            pdf.showPage() # End page

        pdf.save()
        buf.seek(0)

        log_activity("BULK_PDF_GENERATE", f"Total labels: {len(exams)}")
        return send_file(buf, mimetype='application/pdf',
                         as_attachment=True,
                         download_name=f'bulk_labels_{datetime.now().strftime("%Y%m%d")}.pdf')

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Aggregate statistics for the Insights dashboard."""
    try:
        conn = get_conn()
        cur  = conn.cursor()
        
        # Totals
        cur.execute('SELECT COUNT(*), SUM(num_students) FROM examinations')
        total_exams, total_students = cur.fetchone()
        
        # Results Aggregation
        cur.execute('''
            SELECT SUM(answer_sheets), SUM(ufm_count), SUM(absent_count)
            FROM exam_results
        ''')
        total_sheets, total_ufm, total_absent = cur.fetchone()
        
        conn.close()
        return jsonify({
            'total_exams': total_exams or 0,
            'total_students': total_students or 0,
            'total_sheets': total_sheets or 0,
            'total_ufm': total_ufm or 0,
            'total_absent': total_absent or 0
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/logs', methods=['GET'])
def get_logs():
    """Retrieve recent activity logs for the Monitoring view."""
    try:
        conn = get_conn()
        cur  = conn.cursor()
        cur.execute('SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 50')
        rows = cur.fetchall()
        conn.close()
        
        logs = []
        for r in rows:
            logs.append({
                'id': r[0],
                'timestamp': r[1],
                'action': r[2],
                'details': r[3],
                'ip': r[4]
            })
        return jsonify(logs)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print(f"  LAN IP : {get_local_ip()}")
    print(f"  Admin  : {frontend_url('/admin.html?exam_id=1')}")
    print(f"  Results: {frontend_url('/results.html?exam_id=1')}")
    app.run(debug=True, host='0.0.0.0', port=BACKEND_PORT)
