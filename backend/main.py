from datetime import date, datetime
from typing import Literal, Optional

from fastapi import FastAPI, Depends, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import (
    create_engine, Column, Integer, String, Text, Date, DateTime,
    ForeignKeyConstraint, CheckConstraint, text
)
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from dotenv import load_dotenv
import os

load_dotenv()

# Set DATABASE_URL in backend/.env or as an environment variable.
# Example: postgresql+psycopg2://postgres:password@localhost:5432/todo_app
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://postgres:YOUR_PASSWORD@localhost:5432/todo_app"
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


class Task(Base):
    """Maps to the existing PostgreSQL public.tasks table."""
    __tablename__ = "tasks"
    __table_args__ = (
        ForeignKeyConstraint(
            ["category_id", "user_id"],
            ["categories.category_id", "categories.user_id"],
            name="fk_task_category"
        ),
        CheckConstraint(
            "status IN ('pending', 'in_progress', 'completed')",
            name="check_task_status"
        ),
        CheckConstraint(
            "priority IN ('low', 'medium', 'high')",
            name="check_task_priority"
        ),
    )

    task_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    category_id = Column(Integer, nullable=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="pending")
    priority = Column(String(20), nullable=False, default="medium")
    due_date = Column(Date, nullable=True)
    created_at = Column(DateTime, nullable=True)


class TaskCreate(BaseModel):
    user_id: int = Field(gt=0)
    category_id: Optional[int] = Field(default=None, gt=0)
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    status: Literal["pending", "in_progress", "completed"] = "pending"
    priority: Literal["low", "medium", "high"] = "medium"
    due_date: Optional[date] = None


class TaskUpdate(BaseModel):
    # Every field is optional so clients can update only what changed.
    category_id: Optional[int] = Field(default=None, gt=0)
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[Literal["pending", "in_progress", "completed"]] = None
    priority: Optional[Literal["low", "medium", "high"]] = None
    due_date: Optional[date] = None


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    task_id: int
    user_id: int
    category_id: Optional[int]
    title: str
    description: Optional[str]
    status: str
    priority: str
    due_date: Optional[date]
    created_at: Optional[datetime]


app = FastAPI(
    title="TaskFlow To-Do API",
    description="CRUD APIs for the existing PostgreSQL To-Do application database.",
    version="1.0.0"
)

# Allows the current HTML/JS frontend to call the API during local development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict this to your deployed frontend domain before production.
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_owned_task(db: Session, task_id: int, user_id: int) -> Task:
    task = (
        db.query(Task)
        .filter(Task.task_id == task_id, Task.user_id == user_id)
        .first()
    )
    if task is None:
        # Do not reveal whether another user's task exists.
        raise HTTPException(status_code=404, detail="Task not found.")
    return task


@app.get("/")
def root():
    return {"message": "TaskFlow API is running", "docs": "/docs"}


@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="Database connection failed.")


# CREATE: POST /api/tasks
@app.post("/api/tasks", response_model=TaskOut, status_code=201)
def create_task(payload: TaskCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    data["title"] = data["title"].strip()
    if not data["title"]:
        raise HTTPException(status_code=422, detail="Task title cannot be empty.")

    task = Task(**data)
    try:
        db.add(task)
        db.commit()
        db.refresh(task)
        return task
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Invalid user_id or category_id. Check that the user/category exists and belongs to this user."
        )
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not create task.")


# READ ALL: GET /api/tasks?user_id=1
@app.get("/api/tasks", response_model=list[TaskOut])
def get_tasks(
    user_id: int = Query(gt=0),
    status: Optional[Literal["pending", "in_progress", "completed"]] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Task).filter(Task.user_id == user_id)
    if status:
        query = query.filter(Task.status == status)
    return query.order_by(Task.created_at.desc(), Task.task_id.desc()).all()


# READ ONE: GET /api/tasks/1?user_id=1
@app.get("/api/tasks/{task_id}", response_model=TaskOut)
def get_task(
    task_id: int,
    user_id: int = Query(gt=0),
    db: Session = Depends(get_db)
):
    return get_owned_task(db, task_id, user_id)


# UPDATE: PUT /api/tasks/1?user_id=1
@app.put("/api/tasks/{task_id}", response_model=TaskOut)
def update_task(
    task_id: int,
    payload: TaskUpdate,
    user_id: int = Query(gt=0),
    db: Session = Depends(get_db)
):
    task = get_owned_task(db, task_id, user_id)
    updates = payload.model_dump(exclude_unset=True)

    if "title" in updates:
        if updates["title"] is None or not updates["title"].strip():
            raise HTTPException(status_code=422, detail="Task title cannot be empty.")
        updates["title"] = updates["title"].strip()

    for field, value in updates.items():
        setattr(task, field, value)

    try:
        db.commit()
        db.refresh(task)
        return task
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Invalid category_id. The category must belong to this user."
        )
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not update task.")


# DELETE: DELETE /api/tasks/1?user_id=1
@app.delete("/api/tasks/{task_id}", status_code=204)
def delete_task(
    task_id: int,
    user_id: int = Query(gt=0),
    db: Session = Depends(get_db)
):
    task = get_owned_task(db, task_id, user_id)
    try:
        db.delete(task)
        db.commit()
        return Response(status_code=204)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not delete task.")
