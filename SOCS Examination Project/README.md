# Exam Management System

A complete web application for managing student examinations with Excel import and PDF generation with QR codes.

## Features

✅ **Excel Upload**: Import examination data from Excel files (.xlsx, .xls)
✅ **Database Storage**: All data stored in SQLite database
✅ **View Records**: Display all examination entries in a clean table
✅ **PDF Generation**: Generate admission cards with dual QR codes
- QR Code 1: Contains all examination details (for admin viewing)
- QR Code 2: Template for examination input (attendance data)
✅ **CRUD Operations**: Create, Read, and Delete examination records
✅ **Responsive UI**: Clean, modern interface that works on all devices

## Tech Stack

### Backend
- **Framework**: Flask (Python)
- **Database**: SQLite
- **Libraries**:
  - `pandas`: Excel file parsing
  - `qrcode`: QR code generation
  - `reportlab`: PDF generation
  - `flask-cors`: Cross-origin resource sharing

### Frontend
- **Pure HTML/CSS/JavaScript** (no framework dependencies)
- **Modern UI**: Gradient design with smooth interactions
- **Drag & Drop**: File upload with drag-and-drop support

## Installation & Setup

### Prerequisites
- Python 3.8 or higher
- pip (Python package manager)

### Step 1: Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### Step 2: Run the Backend Server

```bash
python app.py
```

The backend API will start at `http://localhost:5000`

### Step 3: Open the Frontend

Simply open `frontend/index.html` in your web browser, or use a simple HTTP server:

```bash
cd frontend
python -m http.server 8000
```

Then visit `http://localhost:8000` in your browser.

## Excel File Format

Your Excel file should contain the following columns:

| Column Name   | Description                    | Required |
|---------------|--------------------------------|----------|
| Student Name  | Full name of the student       | Yes      |
| Subject       | Subject/course name            | Yes      |
| Exam Date     | Date of examination            | No       |
| Exam Time     | Time of examination            | No       |
| Room Number   | Examination room               | No       |
| Seat Number   | Assigned seat number           | No       |

### Sample Excel Data

```
Student Name  | Subject      | Exam Date  | Exam Time | Room Number | Seat Number
------------- | ------------ | ---------- | --------- | ----------- | -----------
John Doe      | Mathematics  | 2024-01-15 | 09:00 AM  | Room 101    | A-01
Jane Smith    | Physics      | 2024-01-15 | 02:00 PM  | Room 102    | A-02
Bob Johnson   | Chemistry    | 2024-01-16 | 09:00 AM  | Room 103    | A-03
```

You can download a sample template from the frontend interface.

## API Endpoints

### 1. Upload Excel File
```
POST /api/upload-excel
Content-Type: multipart/form-data

Form Data:
  file: [Excel file]

Response:
  {
    "message": "Successfully imported X records",
    "count": X
  }
```

### 2. Get All Examinations
```
GET /api/examinations

Response:
  [
    {
      "id": 1,
      "student_name": "John Doe",
      "subject": "Mathematics",
      "exam_date": "2024-01-15",
      "exam_time": "09:00 AM",
      "room_number": "Room 101",
      "seat_number": "A-01",
      "created_at": "2024-01-10 10:30:00"
    },
    ...
  ]
```

### 3. Generate PDF
```
GET /api/generate-pdf/<exam_id>

Response:
  PDF file download
```

### 4. Delete Examination
```
DELETE /api/examination/<exam_id>

Response:
  {
    "message": "Record deleted successfully"
  }
```

### 5. Health Check
```
GET /api/health

Response:
  {
    "status": "healthy",
    "message": "Exam Management API is running"
  }
```

## PDF Structure

Each generated PDF contains:

1. **Header**: "Examination Admission Card"
2. **Student Information**: All examination details
3. **QR Code 1**: JSON data containing complete examination record (for admin scanning)
4. **QR Code 2**: Template JSON for examination input (attendance tracking)

### QR Code 1 Data Format (Admin Details)
```json
{
  "id": 1,
  "student_name": "John Doe",
  "subject": "Mathematics",
  "exam_date": "2024-01-15",
  "exam_time": "09:00 AM",
  "room_number": "Room 101",
  "seat_number": "A-01",
  "created_at": "2024-01-10 10:30:00"
}
```

### QR Code 2 Data Format (Attendance Input)
```json
{
  "exam_id": 1,
  "student_name": "John Doe",
  "subject": "Mathematics",
  "students_present": 0,
  "students_absent": 0,
  "remarks": "",
  "timestamp": "2024-01-15T09:00:00"
}
```

## Project Structure

```
exam_app/
├── backend/
│   ├── app.py              # Main Flask application
│   ├── requirements.txt    # Python dependencies
│   └── exams.db           # SQLite database (auto-generated)
├── frontend/
│   ├── index.html         # Main HTML file
│   ├── styles.css         # CSS styling
│   └── script.js          # JavaScript functionality
└── README.md              # This file
```

## Database Schema

```sql
CREATE TABLE examinations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_name TEXT NOT NULL,
    subject TEXT NOT NULL,
    exam_date TEXT,
    exam_time TEXT,
    room_number TEXT,
    seat_number TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

## Future Enhancements

- [ ] Add authentication and user roles (Admin, Examiner, Student)
- [ ] Implement QR code scanning functionality for attendance input
- [ ] Add bulk PDF generation for all records
- [ ] Support for additional Excel columns (email, phone, etc.)
- [ ] Search and filter functionality in the table
- [ ] Export data back to Excel
- [ ] Add examination status tracking (Scheduled, Ongoing, Completed)
- [ ] Email/SMS notifications to students
- [ ] Support for multiple exam sessions

## Troubleshooting

### Backend won't start
- Make sure all dependencies are installed: `pip install -r requirements.txt`
- Check if port 5000 is available
- Verify Python version is 3.8 or higher

### CORS errors in browser
- Ensure the backend is running with CORS enabled
- Check that API_BASE_URL in script.js matches your backend URL

### Excel upload fails
- Verify your Excel file has the correct column names
- Check file size (very large files may timeout)
- Ensure the file is a valid .xlsx or .xls format

## License

This project is open-source and available for educational and commercial use.

## Support

For issues or questions, please contact the development team or create an issue in the project repository.
