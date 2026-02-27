import os
import sys
from unittest.mock import patch, MagicMock

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_sqlite_fallback():
    print("Testing SQLite fallback...")
    with patch.dict(os.environ, {"DATABASE_URL": ""}, clear=True):
        from app import get_conn, get_placeholder
        conn = get_conn()
        from sqlite3 import Connection
        assert isinstance(conn, Connection), "Should be an sqlite3 Connection"
        assert get_placeholder() == "?", "Placeholder should be '?'"
        print("✅ SQLite fallback OK")

def test_postgres_detection():
    print("Testing Postgres detection...")
    dummy_url = "postgres://user:pass@host:5432/db"
    with patch.dict(os.environ, {"DATABASE_URL": dummy_url}):
        # Mock psycopg2
        with patch('psycopg2.connect') as mock_connect:
            from app import get_conn, get_placeholder
            try:
                get_conn()
            except ImportError:
                # This might happen if psycopg2 isn't installed locally yet
                pass
            
            assert get_placeholder() == "%s", f"Placeholder should be '%s', got {get_placeholder()}"
            print("✅ Postgres detection OK")

if __name__ == "__main__":
    try:
        test_sqlite_fallback()
        test_postgres_detection()
        print("\nAll connection logic tests passed!")
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        sys.exit(1)
