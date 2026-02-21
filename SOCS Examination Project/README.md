# SOCS Exam Management Hub — v3.0 PREMIUM

A high-fidelity, high-efficiency examination and results intelligence system built for SOCS, UPES Dehradun.

## 🚀 Key Features

*   **Dual-View Dashboard**: Segregated "Upcoming & Live" (Table) and "Completed & Past" (Bento Cards) views.
*   **Mobile Results Sync**: Mobile-first invigilator terminal for rapid attendance and results entry.
*   **Real-time Reconciliation**: Instant verify math (Present + Absent = Total) during data entry.
*   **Bulk Label Printing**: Automated generation of SOCS-standard admission labels (2 per A4 sheet).
*   **Results Intelligence**: Comprehensive statistics and activity monitoring board for admins.
*   **Integrated Server**: Single-process architecture—Flask serves both the API and the Frontend.

## 🛠️ Simplified Deployment

The system is now optimized for single-command execution.

### Prerequisites
- Python 3.8+
- Active network connection (for LAN-based result syncing)

### Setup & Run
1.  **Install Dependencies** (Run from project root):
    ```bash
    pip install -r requirements.txt
    ```

2.  **Start the Hub**:
    ```bash
    python backend/app.py
    ```

3.  **Access the Platform**:
    - **Local**: `http://localhost:5000`
    - **LAN/Mobile**: `http://<YOUR_IP>:5000` (The IP is displayed in the terminal on startup)

## 📋 Data Schema (Excel Upload)

The intelligent upload engine maps multiple variations of these columns:

| Field | Purpose |
| :--- | :--- |
| **Exam Title** | Banner text on the label |
| **Room Number** | Examination venue |
| **Exam Date** | Filtered into Archive after the date passes |
| **Course Name/Code** | Core session identifier |
| **Num Students** | Expected students count for reconciliation |

## 📁 Project Structure

```text
SOCS Examination Project/
├── backend/            # Flask API & Data logic
│   ├── app.py          # Unified Server Entry Point
│   └── exams.db        # SQLite Database
├── frontend/           # High-fidelity UI assets
│   ├── index.html      # Central Hub
│   ├── admin.html      # Insights View
│   └── results.html    # Invigilator Terminal
└── requirements.txt    # Consolidated system dependencies
```

---
*Developed for SOCS (School of Computer Science) — UPES Dehradun.*
