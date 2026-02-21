"""Create a valid sample_data.xlsx for testing."""
import os
import openpyxl

wb = openpyxl.Workbook()
ws = wb.active

headers = ["Student Name", "Subject", "Exam Date", "Exam Time", "Room Number", "Seat Number"]
ws.append(headers)

rows = [
    ["Alice Johnson",  "Mathematics",  "2024-03-15", "09:00 AM", "Room 101", "A-01"],
    ["Bob Smith",      "Physics",      "2024-03-15", "09:00 AM", "Room 101", "A-02"],
    ["Carol Williams", "Chemistry",    "2024-03-16", "11:00 AM", "Room 102", "B-01"],
    ["David Brown",    "Biology",      "2024-03-16", "02:00 PM", "Room 103", "C-01"],
    ["Eva Davis",      "Mathematics",  "2024-03-17", "09:00 AM", "Room 101", "A-03"],
]

for row in rows:
    ws.append(row)

out_path = os.path.join(os.path.dirname(__file__), '..', 'sample_data.xlsx')
wb.save(out_path)
print(f"Saved valid sample_data.xlsx to: {os.path.abspath(out_path)}")
print(f"Size: {os.path.getsize(out_path)} bytes")
