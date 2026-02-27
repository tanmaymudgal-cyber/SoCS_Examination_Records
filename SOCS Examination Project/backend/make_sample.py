"""Create a valid sample_data.xlsx for testing."""
import os
import openpyxl

wb = openpyxl.Workbook()
ws = wb.active

headers = ["Exam Title", "Room Number", "Exam Date", "Exam Time", "Program / Batch", "Semester", "Course Name", "Course Code", "Evaluator Name", "Num Students"]
ws.append(headers)

rows = [
    ["Mid-Term Spring 2024", "Room 301", "2024-05-20", "10:00 AM", "B.Tech CS / 2022", "4", "Database Systems", "CS201", "Dr. Sharma", 45],
    ["End-Term Spring 2024", "Room 102", "2024-05-21", "02:00 PM", "BCA / 2023", "2", "Operating Systems", "CA105", "Prof. Verma", 30],
    ["Supplementary Exam",   "Lab 4",    "2024-05-22", "09:00 AM", "Integrated Dual", "6", "Network Security", "IT302", "Dr. Gupta",  12],
]

for row in rows:
    ws.append(row)

out_path = os.path.join(os.path.dirname(__file__), 'exam_template.xlsx')
wb.save(out_path)
print(f"Saved valid sample_data.xlsx to: {os.path.abspath(out_path)}")
print(f"Size: {os.path.getsize(out_path)} bytes")
