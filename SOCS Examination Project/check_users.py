import sqlite3
import os

db_path = os.path.join("backend", "exams.db")
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
else:
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    try:
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users';")
        if not cur.fetchone():
            print("Table 'users' does not exist.")
        else:
            cur.execute("SELECT id, username, role FROM users;")
            rows = cur.fetchall()
            if not rows:
                print("No users found in 'users' table.")
            else:
                for row in rows:
                    print(row)
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()
