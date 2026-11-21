"""End-to-end HTTP tests against an isolated Uvicorn server.
Run after installing requirements: python test_server_live.py
"""
import json, os, sys, threading, time, urllib.error, urllib.request
from pathlib import Path

BASE = Path(__file__).resolve().parent
TEST_DB = BASE / "live_test_taskflow.db"
TEST_DB.unlink(missing_ok=True)
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB.as_posix()}"
os.environ["JWT_SECRET"] = "live-test-secret-key-at-least-32-characters-long"
os.environ["MASTER_ADMIN_EMAIL"] = "masteradmin1@mail.com"
os.environ["MASTER_ADMIN_PASSWORD"] = "live-master-password"
os.environ["SEED_DEMO_ACCOUNTS"] = "false"
os.environ["SMTP_HOST"] = ""
os.environ["SMTP_USERNAME"] = ""
os.environ["SMTP_PASSWORD"] = ""
os.environ["SMTP_FROM"] = ""
sys.path.insert(0, str(BASE))

import uvicorn
from main import app

SERVER_URL = "http://127.0.0.1:8765"

def http_request(path, method="GET", data=None, token=None):
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token: headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(f"{SERVER_URL}{path}", data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            raw = response.read()
            return response.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode()
        try: payload = json.loads(raw)
        except Exception: payload = {"detail": raw}
        return exc.code, payload

class ServerThread(threading.Thread):
    def __init__(self):
        super().__init__(daemon=True)
        self.server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=8765, log_level="warning"))
    def run(self): self.server.run()
    def stop(self): self.server.should_exit = True

def run():
    server = ServerThread(); server.start()
    try:
        ready = False
        for _ in range(40):
            time.sleep(.25)
            try:
                code, data = http_request("/api/health")
                if code == 200: ready = True; break
            except Exception: pass
        assert ready, "Uvicorn health check did not become ready"
        print("PASS health endpoint")

        code, master = http_request("/api/auth/master-admin/login", "POST", {"username":"masteradmin1@mail.com", "password":"live-master-password"})
        assert code == 200, master
        master_token = master["access_token"]
        print("PASS Master Admin login")

        admin_email = "live_admin@example.test"
        code, res = http_request("/api/auth/register-admin", "POST", {"name":"Live Admin", "email":admin_email, "password":"adminpassword123", "reason":"HTTP test"})
        assert code == 201, res
        code, pending_login = http_request("/api/auth/login", "POST", {"email":admin_email, "password":"adminpassword123"})
        assert code == 403 and "awaiting" in pending_login.get("detail", "").lower(), pending_login
        print("PASS admin request registration and pending-login gate")

        code, requests = http_request("/api/master-admin/requests", token=master_token)
        assert code == 200 and any(r["email"] == admin_email for r in requests)
        request_id = next(r["user_id"] for r in requests if r["email"] == admin_email)
        code, approved = http_request(f"/api/master-admin/requests/{request_id}/approve", "POST", token=master_token)
        assert code == 200 and len(approved["code"]) == 6
        otp = approved["code"]
        code, reissue = http_request(f"/api/master-admin/administrators/{request_id}/reissue-code", "POST", token=master_token)
        assert code == 200 and len(reissue["code"]) == 6
        otp = reissue["code"]
        print("PASS Master Admin approval, OTP generation, and reissue")

        code, verified = http_request("/api/auth/admin-verify", "POST", {"email":admin_email, "password":"adminpassword123", "code":otp})
        assert code == 200 and verified["user"]["status"] == "active", verified
        admin_token = verified["access_token"]
        code, admin_overview = http_request("/api/admin/overview", token=admin_token)
        assert code == 200
        print("PASS admin verification and dashboard authorization")

        user_email = "live_user@example.test"
        code, user = http_request("/api/auth/register", "POST", {"name":"Live User", "email":user_email, "password":"userpassword123"})
        assert code == 201, user
        user_token = user["access_token"]
        code, forbidden_admin = http_request("/api/admin/overview", token=user_token)
        assert code == 403
        print("PASS user registration and role-based admin-route denial")

        code, category = http_request("/api/categories", "POST", {"category_name":"Testing"}, token=user_token)
        assert code == 201, category
        category_id = category["category_id"]
        print("PASS category creation")

        code, task = http_request("/api/tasks", "POST", {"title":"Integration task", "description":"full HTTP workflow", "priority":"high", "status":"pending", "category_id":category_id, "due_date":"2026-12-01"}, token=user_token)
        assert code == 201 and task["category_name"] == "Testing", task
        task_id = task["task_id"]
        print("PASS task creation + category relationship")

        code, tasks = http_request("/api/tasks?q=Integration", token=user_token)
        assert code == 200 and len(tasks) == 1
        code, updated = http_request(f"/api/tasks/{task_id}", "PUT", {"status":"completed"}, token=user_token)
        assert code == 200 and updated["completed_at"]
        code, stats = http_request("/api/tasks/stats/summary", token=user_token)
        assert code == 200 and stats["completed"] == 1
        print("PASS task search, status update, completion stats")

        code, forbidden = http_request(f"/api/tasks/{task_id}", token=admin_token)
        assert code == 403 or code == 404, forbidden
        print("PASS role/ownership isolation")

        code, profile = http_request("/api/auth/me", "PUT", {"name":"Renamed User"}, token=user_token)
        assert code == 200 and profile["name"] == "Renamed User"
        code, deleted = http_request(f"/api/tasks/{task_id}", "DELETE", token=user_token)
        assert code == 204
        print("PASS profile update + task deletion")

        code, rejected = http_request("/api/master-admin/requests/{}/reject".format(request_id), "POST", token=master_token)
        assert code == 404, "Approved request should no longer be pending"
        print("PASS approval state guard")
        code, reissued = http_request(f"/api/master-admin/administrators/{request_id}/reissue-code", "POST", token=master_token)
        assert code == 404, "Active administrator should not receive a reissue code"
        print("PASS reissue-code state guard")
        print("ALL HTTP END-TO-END TESTS PASSED")
    finally:
        server.stop(); server.join(timeout=3)
        from database import engine
        engine.dispose()
        TEST_DB.unlink(missing_ok=True)

if __name__ == "__main__": run()
