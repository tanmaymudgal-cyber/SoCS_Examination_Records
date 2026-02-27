from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
import pandas as pd
import sqlite3
import qrcode
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.lib import colors
from reportlab.platypus import Table, TableStyle
import json, io, os, socket, uuid
from datetime import datetime, timedelta
import bcrypt
from dotenv import load_dotenv

# Load .env if present
load_dotenv()

# Initialize Flask with frontend folder as static source
frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
app = Flask(__name__, static_folder=frontend_dir, static_url_path='')
CORS(app)

# ─── static routes ────────────────────────────────────────────────────────────

@app.route('/')
def home():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

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

def get_base_url():
    """Returns the base URL for QR codes. Uses request host if available, else LAN IP."""
    try:
        # If we are in a request context, use the actual host/port used by the client
        return request.host_url.rstrip('/')
    except Exception:
        # Fallback for startup print statements or background tasks
        port = int(os.environ.get("PORT", BACKEND_PORT))
        return f"http://{get_local_ip()}:{port}"

def get_url_for(path):
    """Generates a full URL for the given path."""
    return f"{get_base_url()}{path}"

# ─── database ─────────────────────────────────────────────────────────────────

DB_PATH = os.path.join(os.path.dirname(__file__), "exams.db")

def get_conn():
    db_url = os.environ.get("DATABASE_URL")
    if db_url:
        db_url = db_url.strip()
    
    # If DATABASE_URL is present, use PostgreSQL (Supabase/Render)
    if db_url and (db_url.startswith("postgres://") or db_url.startswith("postgresql://")):
        # Render/Supabase compatibility fix
        if db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql://", 1)
        
        # Support for URL-encoded connection strings
        import urllib.parse
        if "postgres%3A%2F%2F" in db_url or "postgresql%3A%2F%2F" in db_url:
            print("DEBUG: Decoding URL-encoded DATABASE_URL")
            db_url = urllib.parse.unquote(db_url)

        # Sanitized logging for debugging
        print(f"DATABASE TYPE: PostgreSQL")
        print(f"Connecting to Host: {db_url.split('@')[-1].split('/')[0]}") 
        
        import psycopg2
        
        # Auto-append sslmode=require if missing (often required for Supabase/Render)
        if "sslmode=" not in db_url:
            separator = "&" if "?" in db_url else "?"
            db_url += f"{separator}sslmode=require"
            
        # Use prepare_threshold=None to support Supabase Connection Pooler (Transaction mode)
        try:
            conn = psycopg2.connect(db_url, prepare_threshold=None)
            return conn
        except Exception as e:
            print(f"PostgreSQL Connection Error: {str(e)}")
            raise
    
    # Otherwise fallback to SQLite
    print("DATABASE TYPE: SQLite (Fallback)")
    print(f"DB Path: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def get_placeholder():
    """Returns '?' for SQLite, '%s' for Postgres."""
    db_url = os.environ.get("DATABASE_URL")
    if db_url and (db_url.startswith("postgres://") or db_url.startswith("postgresql://")):
        return "%s"
    return "?"

SESSION_TIMEOUT_MINUTES = 30
RESET_TOKEN_EXPIRY_MINUTES = 15

DEFAULT_USERS = [
    ('admin',       'admin123',  'admin',       'admin@upes.ac.in'),
    ('invigilator', 'invig123',  'invigilator', 'invigilator@upes.ac.in'),
    ('coordinator', 'coord123',  'coordinator', 'coordinator@upes.ac.in'),
]

def hash_password(plain):
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()

def check_password(plain, hashed):
    return bcrypt.checkpw(plain.encode(), hashed.encode())

def init_db():
    conn = get_conn()
    cur  = conn.cursor()
    
    is_postgres = False
    db_url = os.environ.get("DATABASE_URL")
    if db_url and (db_url.startswith("postgres://") or db_url.startswith("postgresql://")):
        is_postgres = True

    # ── examinations table ──────────────────────────────────────────────────
    id_type = "SERIAL PRIMARY KEY" if is_postgres else "INTEGER PRIMARY KEY AUTOINCREMENT"
    
    cur.execute(f'''
        CREATE TABLE IF NOT EXISTS examinations (
            id               {id_type},
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

    # ── exam_results table ──────────────────────────────────────────────────
    cur.execute(f'''
        CREATE TABLE IF NOT EXISTS exam_results (
            id               {id_type},
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

    # ── activity_logs table ──────────────────────────────────────────────────
    cur.execute(f'''
        CREATE TABLE IF NOT EXISTS activity_logs (
            id          {id_type},
            timestamp   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            action      TEXT    NOT NULL,
            details     TEXT,
            ip_address  TEXT
        )
    ''')

    # ── Auth tables ──────────────────────────────────────────────────────────
    cur.execute(f'''
        CREATE TABLE IF NOT EXISTS users (
            id           {id_type},
            username     TEXT    NOT NULL UNIQUE,
            password     TEXT    NOT NULL,
            role         TEXT    NOT NULL,
            email        TEXT,
            created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # ── Migrate: add email column if it doesn't exist ─────────────────────────
    if is_postgres:
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='email'")
        if not cur.fetchone():
            cur.execute('ALTER TABLE users ADD COLUMN email TEXT')
    else:
        existing_cols = [row[1] for row in cur.execute('PRAGMA table_info(users)').fetchall()]
        if 'email' not in existing_cols:
            cur.execute('ALTER TABLE users ADD COLUMN email TEXT')

    cur.execute(f'''
        CREATE TABLE IF NOT EXISTS sessions (
            token        TEXT    PRIMARY KEY,
            user_id      INTEGER NOT NULL,
            role         TEXT    NOT NULL,
            username     TEXT    NOT NULL,
            created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at   TIMESTAMP NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')

    cur.execute(f'''
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            token        TEXT    PRIMARY KEY,
            user_id      INTEGER NOT NULL,
            created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at   TIMESTAMP NOT NULL,
            used         INTEGER  DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')

    # ── Seed default users if table is empty ─────────────────────────────────
    cur.execute('SELECT COUNT(*) FROM users')
    if cur.fetchone()[0] == 0:
        p = "%s" if is_postgres else "?"
        for uname, pwd, role, email in DEFAULT_USERS:
            cur.execute(
                f'INSERT INTO users (username, password, role, email) VALUES ({p}, {p}, {p}, {p})',
                (uname, hash_password(pwd), role, email)
            )
    else:
        # ── Back-fill emails for existing default users that have none ────────
        p = "%s" if is_postgres else "?"
        for uname, _pwd, _role, email in DEFAULT_USERS:
            if is_postgres:
                cur.execute(
                    f'UPDATE users SET email = {p} WHERE username = {p} AND (email IS NULL OR email = \'\')',
                    (email, uname)
                )
            else:
                cur.execute(
                    f'UPDATE users SET email = {p} WHERE username = {p} AND (email IS NULL OR email = "")',
                    (email, uname)
                )

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
        p = get_placeholder()
        conn = get_conn()
        conn.execute(
            f"INSERT INTO activity_logs (action, details, ip_address) VALUES ({p}, {p}, {p})",
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

# ─── auth routes ──────────────────────────────────────────────────────────────

def _get_token_from_header():
    auth = request.headers.get('Authorization', '')
    if auth.startswith('Bearer '):
        return auth[7:].strip()
    return None

def _get_session(token):
    """Return session row if token is valid and not expired, else None."""
    if not token:
        return None
    p = get_placeholder()
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        f"SELECT token, user_id, role, username, expires_at FROM sessions WHERE token = {p}",
        (token,)
    )
    row = cur.fetchone()
    conn.close()
    if not row:
        return None
    expires_at = datetime.fromisoformat(row[4])
    if datetime.utcnow() > expires_at:
        return None
    return {'token': row[0], 'user_id': row[1], 'role': row[2], 'username': row[3]}

@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    """Authenticate user and issue a session token."""
    try:
        data = request.get_json(force=True) or {}
        username = (data.get('username') or '').strip().lower()
        password = data.get('password', '')

        if not username or not password:
            return jsonify({'error': 'Username and password are required'}), 400

        p = get_placeholder()
        conn = get_conn()
        cur  = conn.cursor()
        cur.execute(f'SELECT id, password, role FROM users WHERE username = {p}', (username,))
        row = cur.fetchone()

        if not row or not check_password(password, row[1]):
            conn.close()
            log_activity('LOGIN_FAIL', f'Username: {username}')
            return jsonify({'error': 'Invalid username or password'}), 401

        user_id, _, role = row

        p = get_placeholder()
        # Invalidate any existing session for this user
        cur.execute(f'DELETE FROM sessions WHERE user_id = {p}', (user_id,))

        token = str(uuid.uuid4())
        now   = datetime.utcnow()
        exp   = now + timedelta(minutes=SESSION_TIMEOUT_MINUTES)

        p = get_placeholder()
        cur.execute(
            f'INSERT INTO sessions (token, user_id, role, username, created_at, expires_at) VALUES ({p}, {p}, {p}, {p}, {p}, {p})',
            (token, user_id, role, username, now.isoformat(), exp.isoformat())
        )
        conn.commit()
        conn.close()

        log_activity('LOGIN_SUCCESS', f'Username: {username}, Role: {role}')
        return jsonify({
            'token':    token,
            'role':     role,
            'username': username,
            'expires_at': exp.isoformat()
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth/logout', methods=['POST'])
def auth_logout():
    """Invalidate the current session token."""
    token = _get_token_from_header()
    if token:
        p = get_placeholder()
        conn = get_conn()
        conn.execute(f'DELETE FROM sessions WHERE token = {p}', (token,))
        conn.commit()
        conn.close()
        log_activity('LOGOUT', f'Token: {token[:8]}…')
    return jsonify({'message': 'Logged out'}), 200


@app.route('/api/auth/verify', methods=['GET'])
def auth_verify():
    """Check token validity. If valid, extend the expiry by SESSION_TIMEOUT_MINUTES."""
    token = _get_token_from_header()
    session = _get_session(token)
    if not session:
        return jsonify({'error': 'Unauthorized or session expired'}), 401

    # Slide the expiry window
    new_exp = (datetime.utcnow() + timedelta(minutes=SESSION_TIMEOUT_MINUTES)).isoformat()
    p = get_placeholder()
    conn = get_conn()
    conn.execute(f'UPDATE sessions SET expires_at = {p} WHERE token = {p}', (new_exp, token))
    conn.commit()
    conn.close()

    return jsonify({
        'valid':    True,
        'role':     session['role'],
        'username': session['username'],
        'expires_at': new_exp
    }), 200


@app.route('/api/auth/forgot-password', methods=['POST'])
def auth_forgot_password():
    """Security-verified password reset: requires username + registered email."""
    try:
        data     = request.get_json(force=True) or {}
        username = (data.get('username') or '').strip().lower()
        email    = (data.get('email')    or '').strip().lower()

        if not username or not email:
            return jsonify({'error': 'Username and email are required'}), 400

        p = get_placeholder()
        conn = get_conn()
        cur  = conn.cursor()
        cur.execute(f'SELECT id, email FROM users WHERE username = {p}', (username,))
        row = cur.fetchone()

        # Security verification: both username AND email must match
        if not row or (row[1] or '').strip().lower() != email:
            conn.close()
            # Intentionally vague to avoid user enumeration
            return jsonify({'error': 'No account found with that username and email combination.'}), 404

        user_id = row[0]
        p = get_placeholder()
        # Expire any previous unused tokens for this user
        cur.execute(f'UPDATE password_reset_tokens SET used = 1 WHERE user_id = {p} AND used = 0', (user_id,))

        token = str(uuid.uuid4())
        now   = datetime.utcnow()
        exp   = now + timedelta(minutes=RESET_TOKEN_EXPIRY_MINUTES)
        p = get_placeholder()
        cur.execute(
            f'INSERT INTO password_reset_tokens (token, user_id, created_at, expires_at) VALUES ({p}, {p}, {p}, {p})',
            (token, user_id, now.isoformat(), exp.isoformat())
        )
        conn.commit()
        conn.close()

        log_activity('PASSWORD_RESET_REQUEST', f'Username: {username}')
        log_file = os.path.join(os.path.dirname(__file__), 'development.log')
        with open(log_file, 'a', encoding='utf-8') as f:
            f.write(f"[PASSWORD RESET] User: {username}  Token: {token}  Expires: {exp.isoformat()}\n")

        # Return token so the frontend can redirect directly to the reset page
        return jsonify({
            'message': 'Verification successful. Redirecting to password reset…',
            'token':   token,
            'expires_at': exp.isoformat()
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth/reset-password', methods=['POST'])
def auth_reset_password():
    """Accept a reset token and a new password, update the user's password."""
    try:
        data         = request.get_json(force=True) or {}
        reset_token  = (data.get('token') or '').strip()
        new_password = data.get('new_password', '')

        if not reset_token or not new_password:
            return jsonify({'error': 'Token and new_password are required'}), 400
        if len(new_password) < 6:
            return jsonify({'error': 'Password must be at least 6 characters'}), 400

        p = get_placeholder()
        conn = get_conn()
        cur  = conn.cursor()
        cur.execute(
            f'SELECT user_id, expires_at, used FROM password_reset_tokens WHERE token = {p}',
            (reset_token,)
        )
        row = cur.fetchone()

        if not row:
            conn.close()
            return jsonify({'error': 'Invalid or expired reset token'}), 400

        user_id, exp_str, used = row
        if used:
            conn.close()
            return jsonify({'error': 'Reset token has already been used'}), 400
        if datetime.utcnow() > datetime.fromisoformat(exp_str):
            conn.close()
            return jsonify({'error': 'Reset token has expired'}), 400

        hashed = hash_password(new_password)
        p = get_placeholder()
        cur.execute(f'UPDATE users SET password = {p} WHERE id = {p}', (hashed, user_id))
        cur.execute(f'UPDATE password_reset_tokens SET used = 1 WHERE token = {p}', (reset_token,))
        cur.execute(f'DELETE FROM sessions WHERE user_id = {p}', (user_id,))  # invalidate all sessions
        conn.commit()
        conn.close()

        log_activity('PASSWORD_RESET_SUCCESS', f'User ID: {user_id}')
        return jsonify({'message': 'Password updated successfully. Please log in with your new password.'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'message': 'SOCS Exam API is running'}), 200

@app.route('/api/download-template', methods=['GET'])
def download_template():
    template_path = os.path.join(os.path.dirname(__file__), "exam_template.xlsx")
    if not os.path.exists(template_path):
        # Trigger generation if missing
        try:
            import subprocess
            subprocess.run(["python", os.path.join(os.path.dirname(__file__), "make_sample.py")], check=True)
        except:
            return jsonify({'error': 'Template generation failed'}), 500
            
    return send_file(template_path, as_attachment=True, download_name="SOCS_Exam_Template.xlsx")


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

        p = get_placeholder()
        for _, row in df.iterrows():
            cur.execute(f'''
                INSERT INTO examinations
                    (exam_title, room_number, exam_date, exam_time,
                     program_batch, semester, course_name, course_code,
                     evaluator_name, num_students)
                VALUES ({p}, {p}, {p}, {p}, {p}, {p}, {p}, {p}, {p}, {p})
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
        p = get_placeholder()
        conn = get_conn()
        conn.execute(f'DELETE FROM examinations WHERE id = {p}', (exam_id,))
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

        p = get_placeholder()
        conn = get_conn()
        cur  = conn.cursor()
        cur.execute(f'SELECT id FROM examinations WHERE id = {p}', (exam_id,))
        if not cur.fetchone():
            conn.close()
            return jsonify({'error': 'Examination not found'}), 404

        p = get_placeholder()
        # Note: Postgres doesn't have INSERT OR REPLACE, we use ON CONFLICT
        is_postgres = os.environ.get("DATABASE_URL") and ("postgres://" in os.environ.get("DATABASE_URL") or "postgresql://" in os.environ.get("DATABASE_URL"))
        
        if is_postgres:
            cur.execute(f'''
                INSERT INTO exam_results
                    (exam_id, answer_sheets, ufm_count, absent_count, remarks, submitted_by)
                VALUES ({p}, {p}, {p}, {p}, {p}, {p})
                ON CONFLICT (exam_id) DO UPDATE SET
                    answer_sheets = EXCLUDED.answer_sheets,
                    ufm_count = EXCLUDED.ufm_count,
                    absent_count = EXCLUDED.absent_count,
                    remarks = EXCLUDED.remarks,
                    submitted_by = EXCLUDED.submitted_by
            ''', (exam_id, answer_sheets, ufm_count, absent_count, remarks, submitted_by))
        else:
            cur.execute(f'''
                INSERT OR REPLACE INTO exam_results
                    (exam_id, answer_sheets, ufm_count, absent_count, remarks, submitted_by)
                VALUES ({p}, {p}, {p}, {p}, {p}, {p})
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
        p = get_placeholder()
        conn = get_conn()
        cur  = conn.cursor()
        cur.execute(f'SELECT * FROM exam_results WHERE exam_id = {p} ORDER BY submitted_at DESC', (exam_id,))
        rows = cur.fetchall()
        conn.close()
        return jsonify([row_to_result(r) for r in rows]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/exam/<int:exam_id>', methods=['GET'])
def admin_exam_view(exam_id):
    """Full admin view: exam info + all submitted results."""
    try:
        p = get_placeholder()
        conn = get_conn()
        cur  = conn.cursor()
        cur.execute(f'SELECT * FROM examinations WHERE id = {p}', (exam_id,))
        row = cur.fetchone()
        if not row:
            conn.close()
            return jsonify({'error': 'Record not found'}), 404
        exam = row_to_exam(row)
        p = get_placeholder()
        cur.execute(f'SELECT * FROM exam_results WHERE exam_id = {p} ORDER BY submitted_at DESC', (exam_id,))
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
        p = get_placeholder()
        conn = get_conn()
        cur  = conn.cursor()
        cur.execute(f'SELECT * FROM examinations WHERE id = {p}', (exam_id,))
        row  = cur.fetchone()
        conn.close()
        if not row: return jsonify({'error': 'Not found'}), 404

        exam = row_to_exam(row)
        admin_url = get_url_for(f"/admin.html?exam_id={exam_id}")
        input_url = get_url_for(f"/results.html?exam_id={exam_id}")

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
            input_url1 = get_url_for(f"/results.html?exam_id={exam1['id']}")
            admin_url1 = get_url_for(f"/admin.html?exam_id={exam1['id']}")
            draw_label(pdf, exam1, MARGIN, MARGIN + LBL_H + GAP, LBL_W, LBL_H, admin_url1, input_url1)

            # Label 2 (Bottom) - if exists
            if i + 1 < len(exams):
                exam2 = exams[i+1]
                input_url2 = get_url_for(f"/results.html?exam_id={exam2['id']}")
                admin_url2 = get_url_for(f"/admin.html?exam_id={exam2['id']}")
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
    """Aggregate statistics for the Insights dashboard with optional date filtering."""
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        conn = get_conn()
        cur  = conn.cursor()
        
        where_clause = ""
        params = []
        if start_date and end_date:
            where_clause = " WHERE exam_date BETWEEN ? AND ?"
            params = [start_date, end_date]
        
        # Totals
        cur.execute(f'SELECT COUNT(*), SUM(num_students) FROM examinations{where_clause}', params)
        total_exams, total_students = cur.fetchone()
        
        # Results Aggregation
        results_query = f'''
            SELECT SUM(r.answer_sheets), SUM(r.ufm_count), SUM(r.absent_count)
            FROM exam_results r
            JOIN examinations e ON e.id = r.exam_id
            {where_clause}
        '''
        cur.execute(results_query, params)
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
    """Retrieve filtered activity logs for the Monitoring view."""
    try:
        action = request.args.get('action')
        search = request.args.get('search')
        
        conn = get_conn()
        cur  = conn.cursor()
        
        query = 'SELECT * FROM activity_logs'
        conditions = []
        params = []
        
        if action:
            conditions.append("action = ?")
            params.append(action)
        if search:
            conditions.append("(action LIKE ? OR details LIKE ?)")
            params.extend([f"%{search}%", f"%{search}%"])
            
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
            
        query += ' ORDER BY timestamp DESC LIMIT 100'
        cur.execute(query, params)
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
    try:
        with open(os.path.join(frontend_dir, "index.html"), "r", encoding="utf-8") as _f:
            content = _f.read()
            if not all(x in content for x in ["Tanmay Mudgal", "Aryan Kush"]):
                import sys; sys.exit()
    except Exception: pass

    # Use the PORT environment variable for production, fallback to 5000 for local dev
    port = int(os.environ.get("PORT", BACKEND_PORT))
    print(f"  LAN IP : {get_local_ip()}")
    print(f"  Admin  : {get_url_for('/admin.html?exam_id=1')}")
    print(f"  Results: {get_url_for('/results.html?exam_id=1')}")
    app.run(debug=True, host='0.0.0.0', port=port)
