# SOCS Examination Project — Backend Documentation

Welcome to the backend of the SOCS Examination Management Platform. This document provides a comprehensive overview of the architecture, data structures, and operational logic for developers.

---

## 🏗 Architecture Overview

The backend is built using **Python (Flask)**. It follows a **Unified Server Architecture**, meaning the Flask application is responsible for:
1.  **RESTful API**: Handling all data operations and business logic.
2.  **Static Serving**: Serving the HTML/CSS/JS frontend files.
3.  **PDF/QR Logic**: On-the-fly generation of examination labels with scan-to-sync QR codes.

### Tech Stack
-   **Framework**: Flask (Python)
-   **Server**: Gunicorn (for production)
-   **Database**: SQLite3
-   **Excel Parsing**: Pandas + Openpyxl/xlrd
-   **PDF Generation**: ReportLab
-   **QR Generation**: Python-QRCode

---

## 📂 Project Structure (Relevant to Backend)
```text
SOCS Examination Project/
├── backend/
│   ├── app.py             # Main entry point & API Logic
│   ├── exams.db           # SQLite database file
│   ├── development.log    # Activity logs (file-based)
│   ├── make_sample.py     # Script to generate Excel templates
│   └── exam_template.xlsx  # The official template for uploads
├── requirements.txt       # Dependencies
└── Procfile               # Production entry point
```

---

## 🗄 Database Schema

The system uses SQLite. The schema is initialized automatically in `app.py` via `init_db()`.

### 1. `examinations` Table
Storage for exam schedules uploaded via Excel.
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT |
| `exam_title` | TEXT | E.g., "Mid-Term Spring 2024" |
| `room_number` | TEXT | Classroom ID |
| `exam_date` | TEXT | YYYY-MM-DD |
| `exam_time` | TEXT | E.g., "10:00 AM" |
| `program_batch` | TEXT | E.g., "B.Tech CS / 2022" |
| `semester` | TEXT | E.g., "4" |
| `course_name` | TEXT | Full course title |
| `course_code` | TEXT | Official code (E.g., CS201) |
| `evaluator_name`| TEXT | Name of the primary faculty |
| `num_students` | INTEGER | Total enrolled students |
| `created_at` | TIMESTAMP | Internal record creation time |

### 2. `exam_results` Table
Stores synchronization data from mobile devices.
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY |
| `exam_id` | INTEGER | FOREIGN KEY -> examinations.id |
| `answer_sheets` | INTEGER | Count of collected sheets |
| `ufm_count` | INTEGER | Unfair Means cases |
| `absent_count` | INTEGER | Number of absentees |
| `remarks` | TEXT | General notes from invigilator |
| `submitted_by` | TEXT | Name of the invigilator |
| `submitted_at` | TIMESTAMP | When the sync occurred |

### 3. `activity_logs` Table
Audit trail for system actions.
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY |
| `timestamp` | TIMESTAMP | Log time |
| `action` | TEXT | E.g., "EXCEL_UPLOAD", "RESULT_SUBMIT" |
| `details` | TEXT | Contextual info (e.g., Exam ID) |
| `ip_address` | TEXT | IP of the requester |

---

## 🌐 API Reference

### 1. General & Data
-   `GET /api/health`: Health check for connectivity monitoring.
-   `GET /api/examinations`: Returns all exam sessions, joined with their latest result sync status.
-   `GET /api/examination/<id>`: Details for a specific session.
-   `DELETE /api/examination/<id>`: Remove a session record.

### 2. Ingestion & Sync
-   `POST /api/upload-excel`: accepts a file part named `file`. Normalizes various Excel header aliases to match the internal schema.
-   `GET /api/download-template`: Downloads the current `exam_template.xlsx`.
-   `POST /api/results/submit`: Receives JSON results from the mobile sync interface.

### 3. Reports & Analytics
-   `GET /api/generate-pdf/<id>`: Generates a single-page PDF with one exam label.
-   `GET /api/generate-bulk-pdf`: Generates a multipage PDF (2 labels per page). Can be filtered by `start_date` and `end_date`.
-   `GET /api/stats`: Returns aggregated counts for the Insights dashboard.
-   `GET /api/logs`: Returns the last 50 system activity logs.

---

## 🎨 PDF & QR Logic

The system generates 100% dynamic PDFs using the `draw_label` function. 
-   **DPE (Dynamic Port Evaluation)**: The `get_url_for()` helper detects the current server host (`request.host_url`). 
-   **QR Codes**: The QR printed on the PDF contains a link to the `results.html` page with the specific `exam_id`. This allows "Scan-to-Submit" functionality in any network environment (LAN or Cloud).

---

## 🛡 Security & Logging
-   **Logging**: Every critical action (Upload, Delete, Submit) is logged both to the `activity_logs` database table AND a flat `development.log` file.
-   **CORS**: Enabled via `flask-cors` to allow cross-origin requests during local development.

---

## 🚀 Production Deployment

### Entry Point
The app should be run via **Gunicorn** to handle concurrent requests:
`gunicorn --bind 0.0.0.0:$PORT --chdir backend app:app`

### Environment Variables
-   `PORT`: The port the server should bind to (provided by Render/Heroku).
-   `PYTHON_VERSION`: Recommended `3.11.0`.

---

## 👨‍💻 Local Development
1.  Navigate to `backend/`.
2.  Install dependencies: `pip install -r ../requirements.txt`.
3.  Initialize sample data: `python make_sample.py`.
4.  Run server: `python app.py`.
5.  Access API at `http://localhost:5000/api`.
