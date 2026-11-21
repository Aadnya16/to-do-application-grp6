import os
from contextlib import asynccontextmanager
from typing import Literal, Optional

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import case, func, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from database import SessionLocal, get_db
from models import Task, User
from schemas import (
    AdminRequestOut, AdminTaskOut, AdminUserOut, LoginIn, MessageOut,
    PasswordChange, ProfileUpdate, RegisterIn, TaskCreate, TaskOut, TaskUpdate,
    TokenOut, UserOut, validate_new_password,
)
from security import (
    DUMMY_HASH, create_access_token, decode_access_token, hash_password,
    login_limiter, verify_password,
)

APP_ENV = os.getenv("APP_ENV", "development")


# ---------------------------------------------------------------- startup
def seed_first_admin():
    """Create the first admin from ADMIN_EMAIL / ADMIN_PASSWORD (env), if given.
    No admin password is ever hard-coded in the source or the frontend."""
    email = os.getenv("ADMIN_EMAIL", "").strip().lower()
    password = os.getenv("ADMIN_PASSWORD", "")
    if not email or not password:
        return
    validate_new_password(password)
    db = SessionLocal()
    try:
        exists = db.query(User).filter(func.lower(User.email) == email).first()
        if exists is None:
            db.add(User(
                name=os.getenv("ADMIN_NAME", "Administrator"),
                email=email,
                password_hash=hash_password(password),
                role="admin",
            ))
            db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    seed_first_admin()
    yield


app = FastAPI(
    title="TaskFlow To-Do API",
    version="2.0.0",
    lifespan=lifespan,
    docs_url=None if APP_ENV == "production" else "/docs",
    redoc_url=None,
    openapi_url=None if APP_ENV == "production" else "/openapi.json",
)

allowed_origins = [
    o.strip() for o in os.getenv(
        "ALLOWED_ORIGINS", "http://127.0.0.1:5500,http://localhost:5500"
    ).split(",") if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,       # only your frontend, not "*"
    allow_credentials=False,             # we use a Bearer token, not cookies
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


# ---------------------------------------------------------------- auth helpers
bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """The user is read from the signed token and re-checked in the DB on every request,
    so a rejected/removed account loses access immediately."""
    if credentials is None:
        raise HTTPException(
            status_code=401, detail="Not authenticated.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = decode_access_token(credentials.credentials)
    user = db.get(User, user_id)
    if user is None or user.role not in ("user", "admin"):
        raise HTTPException(
            status_code=401, detail="Invalid or expired token. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Administrator access required.")
    return user


def create_account(db: Session, payload: RegisterIn, role: str) -> User:
    if db.query(User).filter(func.lower(User.email) == payload.email).first():
        raise HTTPException(status_code=409, detail="This email is already registered.")
    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=role,
    )
    try:
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="This email is already registered.")
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not create account.")


# ---------------------------------------------------------------- general
@app.get("/")
def root():
    return {"message": "TaskFlow API is running"}


@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok"}
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="Database connection failed.")


# ---------------------------------------------------------------- auth routes
@app.post("/api/auth/register", response_model=UserOut, status_code=201)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    # Role is fixed on the server. A client can never choose to be an admin.
    return create_account(db, payload, role="user")


@app.post("/api/auth/register-admin", response_model=MessageOut, status_code=201)
def register_admin(payload: RegisterIn, db: Session = Depends(get_db)):
    # Creates a PENDING admin. It cannot log in until an active admin approves it.
    create_account(db, payload, role="pending_admin")
    return {"message": "Admin request submitted. Waiting for approval."}


@app.post("/api/auth/login", response_model=TokenOut)
def login(payload: LoginIn, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    key = f"{client_ip}:{payload.email}"
    login_limiter.check(key)

    user = db.query(User).filter(func.lower(User.email) == payload.email).first()
    # Always run one bcrypt check, even for unknown emails (constant-ish time).
    password_ok = verify_password(payload.password, user.password_hash if user else DUMMY_HASH)

    if user is None or not password_ok:
        login_limiter.register_failure(key)
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    login_limiter.reset(key)

    if user.role == "pending_admin":
        raise HTTPException(status_code=403, detail="Admin access is pending approval.")
    if user.role not in ("user", "admin"):
        raise HTTPException(status_code=403, detail="Admin access was rejected for this account.")

    return {"access_token": create_access_token(user.user_id), "token_type": "bearer", "user": user}


@app.get("/api/auth/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@app.put("/api/auth/me", response_model=UserOut)
def update_me(payload: ProfileUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    updates = payload.model_dump(exclude_unset=True)
    if "name" in updates and updates["name"] is None:
        raise HTTPException(status_code=422, detail="Name cannot be empty.")
    if "email" in updates and updates["email"] is None:
        raise HTTPException(status_code=422, detail="Email cannot be empty.")
    if "email" in updates:
        taken = db.query(User).filter(
            func.lower(User.email) == updates["email"], User.user_id != user.user_id
        ).first()
        if taken:
            raise HTTPException(status_code=409, detail="This email is already registered.")
    for field, value in updates.items():
        setattr(user, field, value)
    try:
        db.commit()
        db.refresh(user)
        return user
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="This email is already registered.")
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not update profile.")


@app.post("/api/auth/change-password", response_model=MessageOut)
def change_password(payload: PasswordChange, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=400, detail="Choose a different password.")
    user.password_hash = hash_password(payload.new_password)
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not change password.")
    return {"message": "Password changed successfully."}


# ---------------------------------------------------------------- task routes
# Every query below is filtered by the LOGGED-IN user's id (from the token).
def get_owned_task(db: Session, task_id: int, user: User) -> Task:
    task = db.query(Task).filter(Task.task_id == task_id, Task.user_id == user.user_id).first()
    if task is None:
        # Same answer for "doesn't exist" and "belongs to someone else".
        raise HTTPException(status_code=404, detail="Task not found.")
    return task


@app.post("/api/tasks", response_model=TaskOut, status_code=201)
def create_task(payload: TaskCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = Task(user_id=user.user_id, **payload.model_dump())
    try:
        db.add(task)
        db.commit()
        db.refresh(task)
        return task
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Invalid category_id. The category must belong to you.")
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not create task.")


@app.get("/api/tasks", response_model=list[TaskOut])
def get_tasks(
    status: Optional[Literal["pending", "in_progress", "completed"]] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Task).filter(Task.user_id == user.user_id)
    if status:
        query = query.filter(Task.status == status)
    return query.order_by(Task.created_at.desc(), Task.task_id.desc()).all()


@app.get("/api/tasks/{task_id}", response_model=TaskOut)
def get_task(task_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_owned_task(db, task_id, user)


@app.put("/api/tasks/{task_id}", response_model=TaskOut)
def update_task(task_id: int, payload: TaskUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = get_owned_task(db, task_id, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    try:
        db.commit()
        db.refresh(task)
        return task
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Invalid category_id. The category must belong to you.")
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not update task.")


@app.delete("/api/tasks/{task_id}", status_code=204)
def delete_task(task_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = get_owned_task(db, task_id, user)
    try:
        db.delete(task)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not delete task.")
    return Response(status_code=204)


# ---------------------------------------------------------------- admin routes
@app.get("/api/admin/users", response_model=list[AdminUserOut])
def admin_users(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    rows = (
        db.query(
            User.user_id, User.name, User.email,
            func.count(Task.task_id).label("total_tasks"),
            func.coalesce(func.sum(case((Task.status == "completed", 1), else_=0)), 0).label("completed_tasks"),
        )
        .outerjoin(Task, Task.user_id == User.user_id)
        .filter(User.role == "user")
        .group_by(User.user_id)
        .order_by(User.name)
        .all()
    )
    return [
        {"user_id": r.user_id, "name": r.name, "email": r.email,
         "total_tasks": int(r.total_tasks), "completed_tasks": int(r.completed_tasks)}
        for r in rows
    ]


@app.get("/api/admin/tasks", response_model=list[AdminTaskOut])
def admin_tasks(
    limit: int = Query(500, ge=1, le=1000),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Task, User.name, User.email)
        .join(User, User.user_id == Task.user_id)
        .order_by(Task.created_at.desc(), Task.task_id.desc())
        .limit(limit)
        .all()
    )
    result = []
    for task, owner_name, owner_email in rows:
        data = TaskOut.model_validate(task).model_dump()
        data.update(owner_name=owner_name, owner_email=owner_email)
        result.append(data)
    return result


@app.get("/api/admin/admin-requests", response_model=list[AdminRequestOut])
def admin_requests(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    return (
        db.query(User)
        .filter(User.role == "pending_admin")
        .order_by(User.user_id)
        .all()
    )


@app.post("/api/admin/admin-requests/{user_id}/{action}", response_model=MessageOut)
def decide_admin_request(
    user_id: int,
    action: Literal["approve", "reject"],
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    target = db.get(User, user_id)
    if target is None or target.role != "pending_admin":
        raise HTTPException(status_code=404, detail="This request is no longer pending.")
    if target.user_id == admin.user_id:
        raise HTTPException(status_code=400, detail="You cannot decide your own request.")
    target.role = "admin" if action == "approve" else "rejected_admin"
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not update the request.")
    return {"message": f"Admin request {action}d."}
