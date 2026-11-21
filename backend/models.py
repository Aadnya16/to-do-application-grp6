"""SQLAlchemy models. They map to the tables in database/schema (nothing is created here)."""
from sqlalchemy import (
    CheckConstraint, Column, Date, DateTime, ForeignKeyConstraint, Integer,
    String, Text, UniqueConstraint,
)

from database import Base


class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), nullable=False)
    password_hash = Column(String(255), nullable=False)
    # role values: user | admin | pending_admin | rejected_admin
    role = Column(String(20), nullable=False, default="user")


class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (UniqueConstraint("category_id", "user_id", name="unique_category_owner"),)

    category_id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False)
    category_name = Column(String(100), nullable=False)


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        ForeignKeyConstraint(
            ["category_id", "user_id"],
            ["categories.category_id", "categories.user_id"],
            name="fk_task_category",
        ),
        CheckConstraint("status IN ('pending', 'in_progress', 'completed')", name="check_task_status"),
        CheckConstraint("priority IN ('low', 'medium', 'high')", name="check_task_priority"),
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
