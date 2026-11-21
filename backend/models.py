from datetime import datetime
from sqlalchemy import (
    CheckConstraint, Column, Date, DateTime, ForeignKey, Integer,
    String, Text, func
)
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('user', 'admin', 'master_admin')", name="check_user_role"),
        CheckConstraint("status IN ('active', 'pending', 'approved', 'rejected')", name="check_user_status"),
    )

    user_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    # role values: user | admin | master_admin
    role = Column(String(20), nullable=False, default="user")
    # status values: active | pending | approved | rejected
    status = Column(String(20), nullable=False, default="active")
    verification_code = Column(String(6), nullable=True)
    verification_expires_at = Column(DateTime, nullable=True)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=True)
    approved_at = Column(DateTime, nullable=True)

    categories = relationship("Category", back_populates="user", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="user", cascade="all, delete-orphan")


class Category(Base):
    __tablename__ = "categories"

    category_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    category_name = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=True)

    user = relationship("User", back_populates="categories")
    tasks = relationship("Task", back_populates="category")


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint("status IN ('pending', 'in_progress', 'completed')", name="check_task_status"),
        CheckConstraint("priority IN ('low', 'medium', 'high')", name="check_task_priority"),
    )

    task_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.category_id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="pending")
    priority = Column(String(20), nullable=False, default="medium")
    due_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=True)
    updated_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="tasks")
    category = relationship("Category", back_populates="tasks")
