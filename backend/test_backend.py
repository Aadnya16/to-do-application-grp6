"""Isolated backend API smoke/workflow tests. Run with: python test_backend.py"""
import os
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
TEST_DB = BASE / "test_taskflow.db"
TEST_DB.unlink(missing_ok=True)
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB.as_posix()}"
os.environ["JWT_SECRET"] = "test-only-secret-key-32-characters-minimum-change-me"
os.environ["MASTER_ADMIN_EMAIL"] = "masteradmin1@mail.com"
os.environ["MASTER_ADMIN_PASSWORD"] = "test-master-password"
os.environ["SEED_DEMO_ACCOUNTS"] = "true"
os.environ["SMTP_HOST"] = ""
os.environ["SMTP_USERNAME"] = ""
os.environ["SMTP_PASSWORD"] = ""
os.environ["SMTP_FROM"] = ""
os.environ["DEMO_USER_EMAIL"] = "testuser1@mail.com"
os.environ["DEMO_USER_PASSWORD"] = "user1234"
os.environ["DEMO_ADMIN_EMAIL"] = "testadmin1@mail.com"
os.environ["DEMO_ADMIN_PASSWORD"] = "admin1234"
sys.path.insert(0, str(BASE))

from database import Base, engine, SessionLocal
from models import User, Category, Task
from schemas import RegisterIn, AdminRegisterIn, AdminVerifyIn, LoginIn, MasterLoginIn, ProfileUpdate, PasswordChange, TaskCreate, TaskUpdate, CategoryCreate
from main import (
    seed_initial_accounts, register, register_admin, login, verify_admin, master_admin_login,
    update_me, change_password, get_categories, create_category, delete_category,
    get_tasks, create_task, get_task, update_task, delete_task, get_task_stats,
    admin_overview, admin_users, admin_user_tasks, admin_all_tasks,
    master_admin_overview, master_admin_requests, master_admin_approve, master_admin_reject,
    master_admin_get_admins, master_admin_get_users
)

class MockRequest:
    client = None

def run_tests():
    Base.metadata.create_all(bind=engine)
    seed_initial_accounts()
    db = SessionLocal()
    mock_req = MockRequest()
    print("Running TaskFlow Backend API Test Suite (isolated SQLite)...")
    try:
        # Master Admin authentication and dashboard
        master_res = master_admin_login(MasterLoginIn(username="masteradmin1@mail.com", password="test-master-password"), request=mock_req, db=db)
        master = master_res["user"]
        assert master.role == "master_admin"
        assert master_admin_overview(_=master, db=db)["total_users"] >= 1

        # Admin request, approval, OTP verification, and active login
        candidate = db.query(User).filter(User.email == "testadmin1@mail.com").first()
        candidate.status = "pending"; candidate.verification_code = None; db.commit()
        requests = master_admin_requests(_=master, db=db)
        request_item = next(r for r in requests if r.email == candidate.email)
        approval = master_admin_approve(user_id=request_item.user_id, _=master, db=db)
        code = approval["code"]
        assert len(code) == 6 and code.isdigit()
        verified = verify_admin(AdminVerifyIn(email=candidate.email, password="admin1234", code=code), db=db)["user"]
        assert verified.role == "admin" and verified.status == "active"
        assert login(LoginIn(email=candidate.email, password="admin1234"), request=mock_req, db=db)["user"].user_id == verified.user_id

        # Admin dashboards and task views
        assert admin_overview(_=verified, db=db)["total_users"] >= 1
        users = admin_users(_=verified, db=db); assert users
        assert admin_user_tasks(user_id=users[0]["user_id"], _=verified, db=db) is not None
        assert admin_all_tasks(limit=20, _=verified, db=db) is not None

        # User account/profile/password
        email = "workflow_user@example.test"
        user = register(RegisterIn(name="Workflow User", email=email, password="password123"), db=db)["user"]
        assert login(LoginIn(email=email, password="password123"), request=mock_req, db=db)["user"].user_id == user.user_id
        assert update_me(ProfileUpdate(name="Updated Workflow User"), user=user, db=db).name == "Updated Workflow User"
        change_password(PasswordChange(current_password="password123", new_password="newpassword456"), user=user, db=db)
        assert login(LoginIn(email=email, password="newpassword456"), request=mock_req, db=db)["user"].user_id == user.user_id

        # Category CRUD and ownership isolation
        category = create_category(CategoryCreate(category_name="Work Tasks"), user=user, db=db)
        assert get_categories(user=user, db=db)[0].category_name == "Work Tasks"
        assert create_category(CategoryCreate(category_name="work tasks"), user=user, db=db).category_id == category.category_id

        # Task CRUD, status timestamps, filtering, stats, and ownership
        task = create_task(TaskCreate(title="Deploy TaskFlow", description="Test task", priority="high", category_id=category.category_id), user=user, db=db)
        assert task["category_name"] == "Work Tasks"
        assert len(get_tasks(q="Deploy", user=user, db=db)) == 1
        assert update_task(task["task_id"], TaskUpdate(status="completed"), user=user, db=db)["completed_at"] is not None
        assert update_task(task["task_id"], TaskUpdate(status="in_progress"), user=user, db=db)["completed_at"] is None
        stats = get_task_stats(user=user, db=db); assert stats["total"] == 1 and stats["in_progress"] == 1
        assert get_task(task["task_id"], user=user, db=db)["task_id"] == task["task_id"]
        assert delete_task(task["task_id"], user=user, db=db).status_code == 204
        assert delete_category(category.category_id, user=user, db=db).status_code == 204

        # Master Admin rejection and listings
        rejected_candidate = register_admin(AdminRegisterIn(name="Rejected Candidate", email="reject@example.test", password="password123", reason="Test"), db=db)
        rejected_user = db.query(User).filter(User.email == "reject@example.test").first()
        assert master_admin_reject(user_id=rejected_user.user_id, _=master, db=db)["message"]
        assert rejected_user.status == "rejected"
        assert master_admin_get_admins(_=master, db=db) is not None
        assert master_admin_get_users(_=master, db=db) is not None

        print("ALL BACKEND WORKFLOW TESTS PASSED")
    finally:
        db.close()
        engine.dispose()
        TEST_DB.unlink(missing_ok=True)

if __name__ == "__main__":
    run_tests()
