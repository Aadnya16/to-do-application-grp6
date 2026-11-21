import os
import secrets
import smtplib
from email.message import EmailMessage
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
from typing import List, Literal, Optional

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import case, desc, func, or_, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from database import Base, SessionLocal, engine, get_db
from models import Category, Task, User
from schemas import (
    AdminOverviewOut, AdminRequestOut, AdminTaskOut, AdminUserOut, AdminRegisterIn,
    AdminVerifyIn, CategoryCreate, CategoryOut, LoginIn, MasterLoginIn,
    MasterOverviewOut, MessageOut, PasswordChange, ProfileUpdate, RegisterIn,
    TaskCreate, TaskOut, TaskStatsOut, TaskUpdate, TokenOut, UserOut,
    validate_new_password,
)
from security import (
    DUMMY_HASH, create_access_token, decode_access_token, hash_password,
    login_limiter, verify_password,
)

APP_ENV = os.getenv("APP_ENV", "development")


def send_configured_email(to_email: str, subject: str, body: str) -> bool:
    """Send an email when SMTP is configured; return False when unavailable/failing."""
    host = os.getenv("SMTP_HOST", "").strip()
    username = os.getenv("SMTP_USERNAME", "").strip()
    password = os.getenv("SMTP_PASSWORD", "")
    sender = os.getenv("SMTP_FROM", username).strip()
    if not host or not sender or not username or not password:
        return False
    try:
        msg = EmailMessage()
        msg["From"] = sender
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.set_content(body)
        port = int(os.getenv("SMTP_PORT", "587"))
        with smtplib.SMTP(host, port, timeout=10) as server:
            server.starttls()
            server.login(username, password)
            server.send_message(msg)
        return True
    except Exception as exc:
        print(f"Email delivery failed: {exc}")
        return False


# ---------------------------------------------------------------- STARTUP SEEDING
def seed_initial_accounts():
    """Seed the configured Master Admin and optional classroom demo accounts."""
    db = SessionLocal()
    try:
        master_email = os.getenv("MASTER_ADMIN_EMAIL", "").strip().lower()
        master_password = os.getenv("MASTER_ADMIN_PASSWORD", "")
        if master_email and master_password and master_password not in {"REPLACE_WITH_STRONG_PASSWORD", "YOUR_PASSWORD", "changeme"}:
            existing_master = db.query(User).filter(func.lower(User.email) == master_email).first()
            if not existing_master:
                db.add(User(
                    name=os.getenv("MASTER_ADMIN_NAME", "Master Admin"),
                    email=master_email,
                    password_hash=hash_password(master_password),
                    role="master_admin",
                    status="active",
                    created_at=datetime.now(timezone.utc),
                ))

        if os.getenv("SEED_DEMO_ACCOUNTS", "false").lower() == "true":
            user_email = os.getenv("DEMO_USER_EMAIL", "testuser1@mail.com").strip().lower()
            user_password = os.getenv("DEMO_USER_PASSWORD", "")
            admin_email = os.getenv("DEMO_ADMIN_EMAIL", "testadmin1@mail.com").strip().lower()
            admin_password = os.getenv("DEMO_ADMIN_PASSWORD", "")
            if user_password and admin_password:
                existing_user = db.query(User).filter(func.lower(User.email) == user_email).first()
                if not existing_user:
                    demo_user = User(
                        name="Demo User", email=user_email, password_hash=hash_password(user_password),
                        role="user", status="active", created_at=datetime.now(timezone.utc)
                    )
                    db.add(demo_user)
                    db.flush()
                    db.add_all([
                        Task(user_id=demo_user.user_id, title="Complete assignment", description="Finish and review the assignment before submission.", priority="high", status="in_progress", created_at=datetime.now(timezone.utc)),
                        Task(user_id=demo_user.user_id, title="Buy groceries", description="Pick up essentials for the week.", priority="medium", status="pending", created_at=datetime.now(timezone.utc)),
                        Task(user_id=demo_user.user_id, title="Read chapter 4", description="Review chapter notes.", priority="low", status="completed", completed_at=datetime.now(timezone.utc), created_at=datetime.now(timezone.utc)),
                    ])
                existing_admin = db.query(User).filter(func.lower(User.email) == admin_email).first()
                if not existing_admin:
                    db.add(User(
                        name="Demo Admin", email=admin_email, password_hash=hash_password(admin_password),
                        role="admin", status="pending", reason="Demo administrator request",
                        created_at=datetime.now(timezone.utc)
                    ))
            else:
                print("Demo seeding skipped: set DEMO_USER_PASSWORD and DEMO_ADMIN_PASSWORD.")
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Initial seed warning: {e}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed_initial_accounts()
    yield


app = FastAPI(
    title="TaskFlow API",
    version="2.1.0",
    lifespan=lifespan,
    docs_url=None if APP_ENV == "production" else "/docs",
    redoc_url=None,
    openapi_url=None if APP_ENV == "production" else "/openapi.json",
)

# Allow local dev ports, Live Server origins, and configured origins
configured_origins = [origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "").split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_origins=configured_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)


# ---------------------------------------------------------------- AUTH DEPENDENCIES
bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = decode_access_token(credentials.credentials)
    user = db.get(User, user_id)
    if user is None or user.status not in ("active", "approved"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session or account is inactive. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role not in ("admin", "master_admin") or user.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrator access required.")
    return user


def require_master_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "master_admin" or user.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Master Administrator access required.")
    return user


# ---------------------------------------------------------------- SYSTEM / HEALTH
@app.get("/")
def root():
    return {"message": "TaskFlow API is running", "version": "2.1.0"}


@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="Database connection failed.")


# ---------------------------------------------------------------- AUTH ROUTES
@app.post("/api/auth/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    existing = db.query(User).filter(func.lower(User.email) == payload.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")

    new_user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role="user",
        status="active",
        created_at=datetime.now(timezone.utc),
    )
    db.add(new_user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")
    db.refresh(new_user)

    token = create_access_token(new_user.user_id)
    return {"access_token": token, "token_type": "bearer", "user": new_user}


@app.post("/api/auth/register-admin", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def register_admin(payload: AdminRegisterIn, db: Session = Depends(get_db)):
    existing = db.query(User).filter(func.lower(User.email) == payload.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")

    admin_request = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role="admin",
        status="pending",
        reason=payload.reason or "",
        created_at=datetime.now(timezone.utc),
    )
    db.add(admin_request)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")
    master_email = os.getenv("MASTER_ADMIN_EMAIL", "").strip()
    email_sent = send_configured_email(
        master_email,
        "TaskFlow administrator access request",
        f"A new administrator access request is pending.\n\nName: {payload.name}\nEmail: {payload.email}\nReason: {payload.reason or 'Not provided'}\n\nLog in to TaskFlow Master Admin to review it.",
    ) if master_email else False
    return {"message": "Administrator access request submitted. It is now pending Master Admin approval.", "email_sent": email_sent}


@app.post("/api/auth/login", response_model=TokenOut)
def login(payload: LoginIn, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if (request and request.client) else "unknown"
    key = f"{client_ip}:{payload.email}"
    if request:
        login_limiter.check(key)

    user = db.query(User).filter(func.lower(User.email) == payload.email).first()
    password_ok = verify_password(payload.password, user.password_hash if user else DUMMY_HASH)

    if user is None or not password_ok:
        login_limiter.register_failure(key)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email or password is incorrect.")

    login_limiter.reset(key)

    if user.role == "admin":
        if user.status == "pending":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your administrator request is still awaiting Master Admin approval.",
            )
        if user.status == "approved":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Awaiting verification code. Please complete the verification step.",
                headers={"X-Auth-State": "NEEDS_VERIFICATION"},
            )
        if user.status == "rejected":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your administrator access request was rejected.",
            )

    if user.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is not active.")

    token = create_access_token(user.user_id)
    return {"access_token": token, "token_type": "bearer", "user": user}


@app.post("/api/auth/admin-verify", response_model=TokenOut)
def verify_admin(payload: AdminVerifyIn, db: Session = Depends(get_db)):
    key = f"admin-verify:{payload.email}"
    login_limiter.check(key)
    user = db.query(User).filter(func.lower(User.email) == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        login_limiter.register_failure(key)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials or verification code.")

    if user.role != "admin" or user.status != "approved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is not in an approved awaiting verification state.",
        )

    now = datetime.now(timezone.utc)
    expires_at = user.verification_expires_at
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if not user.verification_code or not secrets.compare_digest(user.verification_code, payload.code):
        login_limiter.register_failure(key)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification code is incorrect.")
    if not expires_at or expires_at < now:
        user.verification_code = None
        user.verification_expires_at = None
        db.commit()
        login_limiter.register_failure(key)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification code expired. Contact the Master Admin to request a new approval code.")
    login_limiter.reset(key)

    # Activate account
    user.status = "active"
    user.verification_code = None
    user.verification_expires_at = None
    user.approved_at = now
    db.commit()
    db.refresh(user)

    token = create_access_token(user.user_id)
    return {"access_token": token, "token_type": "bearer", "user": user}


@app.post("/api/auth/master-admin/login", response_model=TokenOut)
def master_admin_login(payload: MasterLoginIn, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if (request and request.client) else "unknown"
    key = f"master:{client_ip}:{payload.username}"
    login_limiter.check(key)
    user = db.query(User).filter(
        User.role == "master_admin",
        or_(func.lower(User.email) == payload.username, func.lower(User.name) == payload.username),
    ).first()

    password_ok = verify_password(payload.password, user.password_hash if user else DUMMY_HASH)
    if not user or not password_ok:
        login_limiter.register_failure(key)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect Master Admin username/email or password.")
    login_limiter.reset(key)

    token = create_access_token(user.user_id)
    return {"access_token": token, "token_type": "bearer", "user": user}


@app.get("/api/auth/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)):
    return user


@app.put("/api/auth/me", response_model=UserOut)
def update_me(payload: ProfileUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.name:
        user.name = payload.name
    if payload.email and payload.email != user.email:
        taken = db.query(User).filter(func.lower(User.email) == payload.email, User.user_id != user.user_id).first()
        if taken:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This email is already in use.")
        user.email = payload.email

    db.commit()
    db.refresh(user)
    return user


@app.post("/api/auth/change-password", response_model=MessageOut)
def change_password(payload: PasswordChange, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password must be different from current password.")

    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password changed successfully."}


# ---------------------------------------------------------------- CATEGORY ROUTES
@app.get("/api/categories", response_model=List[CategoryOut])
def get_categories(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Category).filter(Category.user_id == user.user_id).order_by(Category.category_name).all()


@app.post("/api/categories", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(payload: CategoryCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    existing = db.query(Category).filter(
        Category.user_id == user.user_id,
        func.lower(Category.category_name) == payload.category_name.lower(),
    ).first()
    if existing:
        return existing

    cat = Category(
        user_id=user.user_id,
        category_name=payload.category_name,
        created_at=datetime.now(timezone.utc),
    )
    db.add(cat)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.query(Category).filter(
            Category.user_id == user.user_id,
            func.lower(Category.category_name) == payload.category_name.lower(),
        ).first()
        if existing:
            return existing
        raise HTTPException(status_code=409, detail="Could not create category.")
    db.refresh(cat)
    return cat


@app.delete("/api/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.category_id == category_id, Category.user_id == user.user_id).first()
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found.")
    db.delete(cat)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------- TASK ROUTES
def task_to_dict(task: Task) -> dict:
    return {
        "task_id": task.task_id,
        "user_id": task.user_id,
        "category_id": task.category_id,
        "category_name": task.category.category_name if task.category else None,
        "title": task.title,
        "description": task.description,
        "status": task.status,
        "priority": task.priority,
        "due_date": task.due_date,
        "created_at": task.created_at,
        "updated_at": task.updated_at,
        "completed_at": task.completed_at,
    }


@app.get("/api/tasks", response_model=List[TaskOut])
def get_tasks(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    category_id: Optional[int] = None,
    q: Optional[str] = None,
    sort: Optional[str] = Query("newest"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Task).filter(Task.user_id == user.user_id)

    if status:
        query = query.filter(Task.status == status)
    if priority:
        query = query.filter(Task.priority == priority)
    if category_id:
        query = query.filter(Task.category_id == category_id)
    if q and q.strip():
        search_term = f"%{q.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(Task.title).like(search_term),
                func.lower(Task.description).like(search_term),
            )
        )

    if sort == "oldest":
        query = query.order_by(Task.created_at.asc(), Task.task_id.asc())
    elif sort == "due_date":
        query = query.order_by(Task.due_date.asc().nullslast(), Task.created_at.desc())
    elif sort == "priority":
        # high > medium > low
        priority_order = case(
            (Task.priority == "high", 1),
            (Task.priority == "medium", 2),
            else_=3,
        )
        query = query.order_by(priority_order, Task.created_at.desc())
    else:
        query = query.order_by(desc(Task.created_at), desc(Task.task_id))

    tasks = query.all()
    return [task_to_dict(t) for t in tasks]


@app.get("/api/tasks/stats/summary", response_model=TaskStatsOut)
def get_task_stats(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    tasks = db.query(Task).filter(Task.user_id == user.user_id).all()
    total = len(tasks)
    pending = sum(1 for t in tasks if t.status == "pending")
    in_progress = sum(1 for t in tasks if t.status == "in_progress")
    completed = sum(1 for t in tasks if t.status == "completed")

    today = date.today()
    overdue = sum(1 for t in tasks if t.status != "completed" and t.due_date and t.due_date < today)
    completion_rate = round((completed / total * 100)) if total > 0 else 0

    return {
        "total": total,
        "pending": pending,
        "in_progress": in_progress,
        "completed": completed,
        "overdue": overdue,
        "completion_rate": completion_rate,
    }


@app.post("/api/tasks", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.category_id:
        cat = db.query(Category).filter(Category.category_id == payload.category_id, Category.user_id == user.user_id).first()
        if not cat:
            raise HTTPException(status_code=400, detail="Invalid category ID.")

    now = datetime.now(timezone.utc)
    task = Task(
        user_id=user.user_id,
        category_id=payload.category_id,
        title=payload.title,
        description=payload.description or "",
        status=payload.status,
        priority=payload.priority,
        due_date=payload.due_date,
        created_at=now,
        completed_at=now if payload.status == "completed" else None,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task_to_dict(task)


@app.get("/api/tasks/{task_id}", response_model=TaskOut)
def get_task(task_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.task_id == task_id, Task.user_id == user.user_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")
    return task_to_dict(task)


@app.put("/api/tasks/{task_id}", response_model=TaskOut)
def update_task(task_id: int, payload: TaskUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.task_id == task_id, Task.user_id == user.user_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")

    updates = payload.model_dump(exclude_unset=True)
    if "category_id" in updates and updates["category_id"]:
        cat = db.query(Category).filter(Category.category_id == updates["category_id"], Category.user_id == user.user_id).first()
        if not cat:
            raise HTTPException(status_code=400, detail="Invalid category ID.")

    for field, value in updates.items():
        setattr(task, field, value)

    # Manage completed_at timestamp on status transition
    if "status" in updates:
        if updates["status"] == "completed":
            if not task.completed_at:
                task.completed_at = datetime.now(timezone.utc)
        else:
            task.completed_at = None

    task.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(task)
    return task_to_dict(task)


@app.delete("/api/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.task_id == task_id, Task.user_id == user.user_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")
    db.delete(task)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------- ADMIN ROUTES
@app.get("/api/admin/overview", response_model=AdminOverviewOut)
def admin_overview(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    total_users = db.query(User).filter(User.role == "user", User.status == "active").count()
    all_tasks = db.query(Task).all()
    total_tasks = len(all_tasks)
    completed_tasks = sum(1 for t in all_tasks if t.status == "completed")
    pending_tasks = sum(1 for t in all_tasks if t.status == "pending")

    status_breakdown = {
        "pending": sum(1 for t in all_tasks if t.status == "pending"),
        "in_progress": sum(1 for t in all_tasks if t.status == "in_progress"),
        "completed": completed_tasks,
    }

    # Recent activity
    recent_tasks = db.query(Task, User.name).join(User, User.user_id == Task.user_id).order_by(desc(Task.created_at)).limit(10).all()
    recent_activity = [
        {
            "task_id": t.task_id,
            "title": t.title,
            "status": t.status,
            "priority": t.priority,
            "owner_name": name,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "kind": "completed" if t.status == "completed" else "created",
        }
        for t, name in recent_tasks
    ]

    return {
        "total_users": total_users,
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "pending_tasks": pending_tasks,
        "status_breakdown": status_breakdown,
        "recent_activity": recent_activity,
    }


@app.get("/api/admin/users", response_model=List[AdminUserOut])
def admin_users(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    users = db.query(User).filter(User.role == "user").order_by(User.name).all()
    result = []
    for u in users:
        tasks = u.tasks
        total = len(tasks)
        completed = sum(1 for t in tasks if t.status == "completed")
        pending = sum(1 for t in tasks if t.status == "pending")
        last_date = max((t.completed_at or t.updated_at or t.created_at for t in tasks if (t.completed_at or t.updated_at or t.created_at)), default=u.created_at)
        result.append({
            "user_id": u.user_id,
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "status": u.status,
            "total_tasks": total,
            "completed_tasks": completed,
            "pending_tasks": pending,
            "last_activity": last_date,
        })
    return result


@app.get("/api/admin/users/{user_id}/tasks", response_model=List[TaskOut])
def admin_user_tasks(user_id: int, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    tasks = db.query(Task).filter(Task.user_id == user_id).order_by(desc(Task.created_at)).all()
    return [task_to_dict(t) for t in tasks]


@app.get("/api/admin/tasks", response_model=List[AdminTaskOut])
def admin_all_tasks(
    limit: int = Query(500, ge=1, le=1000),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Task, User.name, User.email)
        .join(User, User.user_id == Task.user_id)
        .order_by(desc(Task.created_at))
        .limit(limit)
        .all()
    )
    result = []
    for task, name, email in rows:
        d = task_to_dict(task)
        d["owner_name"] = name
        d["owner_email"] = email
        result.append(d)
    return result


# ---------------------------------------------------------------- MASTER ADMIN ROUTES
@app.get("/api/master-admin/overview", response_model=MasterOverviewOut)
def master_admin_overview(_: User = Depends(require_master_admin), db: Session = Depends(get_db)):
    total_users = db.query(User).filter(User.role == "user", User.status == "active").count()
    total_admins = db.query(User).filter(User.role == "admin", User.status == "active").count()
    pending_requests = db.query(User).filter(User.role == "admin", User.status == "pending").count()
    active_accounts = db.query(User).filter(User.status == "active").count()

    all_tasks = db.query(Task).all()
    global_tasks = len(all_tasks)
    global_completed = sum(1 for t in all_tasks if t.status == "completed")
    global_pending = sum(1 for t in all_tasks if t.status == "pending")
    completion_rate = round(global_completed / global_tasks * 100) if global_tasks > 0 else 0

    return {
        "total_users": total_users,
        "total_admins": total_admins,
        "pending_requests": pending_requests,
        "active_accounts": active_accounts,
        "global_tasks": global_tasks,
        "global_completed": global_completed,
        "global_pending": global_pending,
        "completion_rate": completion_rate,
    }


@app.get("/api/master-admin/requests", response_model=List[AdminRequestOut])
def master_admin_requests(_: User = Depends(require_master_admin), db: Session = Depends(get_db)):
    requests = db.query(User).filter(User.role == "admin", User.status == "pending").order_by(desc(User.created_at)).all()
    return requests


@app.post("/api/master-admin/requests/{user_id}/approve", response_model=MessageOut)
def master_admin_approve(user_id: int, _: User = Depends(require_master_admin), db: Session = Depends(get_db)):
    target = db.get(User, user_id)
    if not target or target.role != "admin" or target.status != "pending":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pending administrator request not found.")

    # Generate 6-digit verification code
    code = f"{secrets.randbelow(900000) + 100000}"
    target.status = "approved"
    target.verification_code = code
    target.verification_expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    target.approved_at = datetime.now(timezone.utc)
    db.commit()
    email_sent = send_configured_email(
        target.email,
        "Your TaskFlow administrator request was approved",
        f"Hello {target.name},\n\nYour administrator access request has been approved. Your 6-digit verification code is: {code}\nIt expires in 15 minutes.\n\nReturn to TaskFlow Administrator Login, enter your email and password, then complete verification.\n\nIf you did not request this access, contact the Master Admin.",
    )

    return {
        "message": f"Administrator request for {target.name} approved.",
        "code": code,
        "email_sent": email_sent,
    }


@app.post("/api/master-admin/requests/{user_id}/reject", response_model=MessageOut)
def master_admin_reject(user_id: int, _: User = Depends(require_master_admin), db: Session = Depends(get_db)):
    target = db.get(User, user_id)
    if not target or target.role != "admin" or target.status != "pending":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pending administrator request not found.")

    target.status = "rejected"
    target.verification_code = None
    target.verification_expires_at = None
    db.commit()
    email_sent = send_configured_email(
        target.email,
        "Your TaskFlow administrator request was rejected",
        f"Hello {target.name},\n\nYour administrator access request was not approved. If you believe this was a mistake, contact the Master Admin.",
    )

    return {"message": f"Administrator request for {target.name} rejected.", "email_sent": email_sent}


@app.post("/api/master-admin/administrators/{user_id}/reissue-code", response_model=MessageOut)
def master_admin_reissue_code(user_id: int, _: User = Depends(require_master_admin), db: Session = Depends(get_db)):
    target = db.get(User, user_id)
    if not target or target.role != "admin" or target.status != "approved":
        raise HTTPException(status_code=404, detail="Administrator awaiting verification not found.")
    code = f"{secrets.randbelow(900000) + 100000}"
    target.verification_code = code
    target.verification_expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    db.commit()
    email_sent = send_configured_email(
        target.email,
        "Your new TaskFlow administrator verification code",
        f"Hello {target.name},\n\nYour new six-digit verification code is: {code}\nIt expires in 15 minutes.\n\nUse your email and password on TaskFlow Administrator Login to complete verification.",
    )
    return {"message": "Verification code reissued.", "code": code, "email_sent": email_sent}


@app.get("/api/master-admin/administrators", response_model=List[UserOut])
def master_admin_get_admins(_: User = Depends(require_master_admin), db: Session = Depends(get_db)):
    return db.query(User).filter(User.role == "admin").order_by(User.name).all()


@app.get("/api/master-admin/users", response_model=List[UserOut])
def master_admin_get_users(_: User = Depends(require_master_admin), db: Session = Depends(get_db)):
    return db.query(User).filter(User.role == "user").order_by(desc(User.created_at)).all()
