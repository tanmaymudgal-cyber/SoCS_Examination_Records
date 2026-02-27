"""
Quick verification script: tests login, forgot-password, and reset-password endpoints
against the running local backend on port 5000.
"""
import requests
import sys

BASE = "http://127.0.0.1:5000/api"
PASS = "\033[92m[PASS]\033[0m"
FAIL = "\033[91m[FAIL]\033[0m"

errors = 0

def check(label, cond, info=""):
    global errors
    if cond:
        print(f"{PASS} {label}")
    else:
        print(f"{FAIL} {label}  →  {info}")
        errors += 1

# ─── 1. Health check ──────────────────────────────────────────────────────────
r = requests.get(f"{BASE}/health", timeout=5)
check("Health check", r.status_code == 200)

# ─── 2. Login with correct credentials ───────────────────────────────────────
r = requests.post(f"{BASE}/auth/login", json={"username": "admin", "password": "admin123"})
check("Login: admin/admin123", r.status_code == 200, r.text[:120])
token = r.json().get("token", "") if r.status_code == 200 else ""

# ─── 3. Login with wrong password ────────────────────────────────────────────
r = requests.post(f"{BASE}/auth/login", json={"username": "admin", "password": "wrongpassword"})
check("Login: wrong password returns 401", r.status_code == 401, r.text[:80])

# ─── 4. Verify session token ──────────────────────────────────────────────────
if token:
    r = requests.get(f"{BASE}/auth/verify", headers={"Authorization": f"Bearer {token}"})
    check("Token verify: valid token", r.status_code == 200, r.text[:80])

# ─── 5. Forgot-password: missing email (should 400) ──────────────────────────
r = requests.post(f"{BASE}/auth/forgot-password", json={"username": "admin"})
check("Forgot-password: no email returns 400", r.status_code == 400, r.text[:80])

# ─── 6. Forgot-password: wrong email (should 404) ────────────────────────────
r = requests.post(f"{BASE}/auth/forgot-password", json={"username": "admin", "email": "wrong@example.com"})
check("Forgot-password: wrong email returns 404", r.status_code == 404, r.text[:80])

# ─── 7. Forgot-password: correct username + email ────────────────────────────
r = requests.post(f"{BASE}/auth/forgot-password", json={"username": "admin", "email": "admin@upes.ac.in"})
check("Forgot-password: correct credentials returns 200", r.status_code == 200, r.text[:120])
reset_token = r.json().get("token", "") if r.status_code == 200 else ""
check("Forgot-password: token returned in response", bool(reset_token))

# ─── 8. Reset password with valid token ──────────────────────────────────────
if reset_token:
    r = requests.post(f"{BASE}/auth/reset-password", json={"token": reset_token, "new_password": "newpass99"})
    check("Reset-password: valid token sets new password", r.status_code == 200, r.text[:80])

    # ─── 9. Login with new password ──────────────────────────────────────────
    r = requests.post(f"{BASE}/auth/login", json={"username": "admin", "password": "newpass99"})
    check("Login: works with new password", r.status_code == 200, r.text[:80])

    # ─── 10. Restore the original password ───────────────────────────────────
    # Re-request a reset token to restore original password
    r2 = requests.post(f"{BASE}/auth/forgot-password", json={"username": "admin", "email": "admin@upes.ac.in"})
    if r2.status_code == 200:
        rt2 = r2.json().get("token", "")
        if rt2:
            requests.post(f"{BASE}/auth/reset-password", json={"token": rt2, "new_password": "admin123"})
            r3 = requests.post(f"{BASE}/auth/login", json={"username": "admin", "password": "admin123"})
            check("Restore: original password admin123 works again", r3.status_code == 200, r3.text[:80])

    # ─── 11. Used token should fail ──────────────────────────────────────────
    r = requests.post(f"{BASE}/auth/reset-password", json={"token": reset_token, "new_password": "anotherpassword"})
    check("Reset-password: reused token returns 400", r.status_code == 400, r.text[:80])

# ─── Summary ─────────────────────────────────────────────────────────────────
print()
if errors == 0:
    print("\033[92m✅ All checks passed.\033[0m")
else:
    print(f"\033[91m❌ {errors} check(s) failed.\033[0m")
    sys.exit(1)
