import os
import sys
import urllib.parse
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def debug_connection(provided_url=None):
    db_url = provided_url or os.environ.get("DATABASE_URL")
    
    print("\n=== Database Connection Debugger ===")
    if not db_url:
        print("❌ Error: No connection string provided.")
        print("Usage: python debug_db.py 'your_connection_string_here'")
        print("Or set DATABASE_URL in a .env file.")
        return

    # Basic cleanup
    db_url = db_url.strip().strip("'").strip('"')

    # Check for over-encoding
    if "postgres%3A%2F%2F" in db_url or "postgresql%3A%2F%2F" in db_url:
        print("⚠️ Warning: Your URL appears to be entirely URL-encoded. Decoding it...")
        db_url = urllib.parse.unquote(db_url)

    print(f"Post-processing URL (masked): {db_url.split('@')[-1] if '@' in db_url else 'No @ found'}")
    
    is_postgres = db_url.startswith("postgres://") or db_url.startswith("postgresql://")
    
    if not is_postgres:
        print("❌ Error: URL does not start with postgres:// or postgresql://")
        print("This will cause the app to fallback to SQLite.")
        return

    # Fix for Render/Supabase compatibility
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    # SSL Mode requirement
    if "sslmode=" not in db_url:
        separator = "&" if "?" in db_url else "?"
        db_url += f"{separator}sslmode=require"
    
    print(f"Attempting connection to: {db_url.split('@')[-1]}")
    
    try:
        conn = psycopg2.connect(db_url, prepare_threshold=None)
        print("✅ SUCCESS: Connected to PostgreSQL!")
        
        # Now try to initialize tables using the app's logic
        print("Attempting to initialize tables...")
        os.environ["DATABASE_URL"] = db_url # Ensure app uses this URL
        
        from app import init_db
        init_db()
        print("✅ SUCCESS: Tables initialized successfully!")

        cur = conn.cursor()
        cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")
        tables = cur.fetchall()
        print(f"Final tables in public schema: {[t[0] for t in tables]}")
        conn.close()
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # Check if URL passed as argument
    cmd_url = sys.argv[1] if len(sys.argv) > 1 else None
    debug_connection(cmd_url)
