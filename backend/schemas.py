"""Request and response Pydantic models for TaskFlow API."""
import re
from datetime import date, datetime
from typing import Any, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

Status = Literal["pending", "in_progress", "completed"]
Priority = Literal["low", "medium", "high"]
Role = Literal["user", "admin", "master_admin"]
UserStatus = Literal["active", "pending", "approved", "rejected"]


def validate_new_password(value: str) -> str:
    if len(value) < 6:
        raise ValueError("Password must contain at least 6 characters.")
    if len(value.encode("utf-8")) > 72:  # bcrypt limit
        raise ValueError("Password is too long (max 72 bytes).")
    return value


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


# ---------------------------------------------------------------- AUTH SCHEMAS
class RegisterIn(StrictModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Enter your full name.")
        return v

    @field_validator("email")
    @classmethod
    def lower_email(cls, v: str) -> str:
        return v.lower()

    @field_validator("password")
    @classmethod
    def check_password(cls, v: str) -> str:
        return validate_new_password(v)


class AdminRegisterIn(StrictModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str
    reason: Optional[str] = Field(default="", max_length=500)

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Enter your full name.")
        return v

    @field_validator("email")
    @classmethod
    def lower_email(cls, v: str) -> str:
        return v.lower()

    @field_validator("password")
    @classmethod
    def check_password(cls, v: str) -> str:
        return validate_new_password(v)


class AdminVerifyIn(StrictModel):
    email: EmailStr
    password: str
    code: str = Field(min_length=6, max_length=6)

    @field_validator("email")
    @classmethod
    def lower_email(cls, v: str) -> str:
        return v.lower()

    @field_validator("code")
    @classmethod
    def clean_code(cls, v: str) -> str:
        v = v.strip()
        if not re.fullmatch(r"\d{6}", v):
            raise ValueError("Verification code must be exactly six digits.")
        return v


class LoginIn(StrictModel):
    email: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=1, max_length=200)

    @field_validator("email")
    @classmethod
    def lower_email(cls, v: str) -> str:
        return v.strip().lower()


class MasterLoginIn(StrictModel):
    username: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=1, max_length=200)

    @field_validator("username")
    @classmethod
    def lower_username(cls, v: str) -> str:
        return v.strip().lower()


class ProfileUpdate(StrictModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    email: Optional[EmailStr] = None

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Name must contain at least 2 characters.")
        return v

    @field_validator("email")
    @classmethod
    def lower_email(cls, v: Optional[str]) -> Optional[str]:
        return v.lower() if v else v


class PasswordChange(StrictModel):
    current_password: str = Field(min_length=1, max_length=200)
    new_password: str

    @field_validator("new_password")
    @classmethod
    def check_password(cls, v: str) -> str:
        return validate_new_password(v)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    name: str
    email: str
    role: str
    status: str
    created_at: Optional[datetime] = None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class MessageOut(BaseModel):
    message: str
    code: Optional[str] = None
    email_sent: Optional[bool] = None


# ---------------------------------------------------------------- TASK SCHEMAS
class TaskCreate(StrictModel):
    category_id: Optional[int] = Field(default=None, gt=0)
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=5000)
    status: Status = "pending"
    priority: Priority = "medium"
    due_date: Optional[date] = None

    @field_validator("title")
    @classmethod
    def clean_title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Task title cannot be empty.")
        return v


class TaskUpdate(StrictModel):
    category_id: Optional[int] = Field(default=None, gt=0)
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=5000)
    status: Optional[Status] = None
    priority: Optional[Priority] = None
    due_date: Optional[date] = None

    @field_validator("title")
    @classmethod
    def clean_title(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Task title cannot be empty.")
        return v


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    task_id: int
    user_id: int
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    title: str
    description: Optional[str] = None
    status: str
    priority: str
    due_date: Optional[date] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class TaskStatsOut(BaseModel):
    total: int
    pending: int
    in_progress: int
    completed: int
    overdue: int
    completion_rate: int


# ---------------------------------------------------------------- CATEGORY SCHEMAS
class CategoryCreate(StrictModel):
    category_name: str = Field(min_length=1, max_length=100)

    @field_validator("category_name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Category name cannot be empty.")
        return v


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    category_id: int
    user_id: int
    category_name: str
    created_at: Optional[datetime] = None


# ---------------------------------------------------------------- ADMIN SCHEMAS
class AdminTaskOut(TaskOut):
    owner_name: str
    owner_email: str


class AdminUserOut(BaseModel):
    user_id: int
    name: str
    email: str
    role: str
    status: str
    total_tasks: int
    completed_tasks: int
    pending_tasks: int
    last_activity: Optional[datetime] = None


class AdminOverviewOut(BaseModel):
    total_users: int
    total_tasks: int
    completed_tasks: int
    pending_tasks: int
    status_breakdown: dict
    recent_activity: List[dict]


# ---------------------------------------------------------------- MASTER ADMIN SCHEMAS
class AdminRequestOut(BaseModel):
    user_id: int
    name: str
    email: str
    status: str
    reason: Optional[str] = None
    verification_code: Optional[str] = None
    created_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None


class MasterOverviewOut(BaseModel):
    total_users: int
    total_admins: int
    pending_requests: int
    active_accounts: int
    global_tasks: int
    global_completed: int
    global_pending: int
    completion_rate: int
