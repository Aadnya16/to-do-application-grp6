"""Request / response models."""
import re
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

Status = Literal["pending", "in_progress", "completed"]
Priority = Literal["low", "medium", "high"]


def validate_new_password(value: str) -> str:
    if len(value) < 8:
        raise ValueError("Password must contain at least 8 characters.")
    if len(value.encode("utf-8")) > 72:  # bcrypt limit
        raise ValueError("Password is too long (max 72 bytes).")
    if not re.search(r"[A-Za-z]", value) or not re.search(r"\d", value):
        raise ValueError("Password must contain both letters and numbers.")
    return value


class StrictModel(BaseModel):
    # Unknown fields (e.g. someone sending "role": "admin") are rejected, not ignored.
    model_config = ConfigDict(extra="forbid")


# ---------- auth ----------
class RegisterIn(StrictModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str

    @field_validator("name")
    @classmethod
    def clean_name(cls, v):
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Enter your full name.")
        return v

    @field_validator("email")
    @classmethod
    def lower_email(cls, v):
        return v.lower()

    @field_validator("password")
    @classmethod
    def check_password(cls, v):
        return validate_new_password(v)


class LoginIn(StrictModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)

    @field_validator("email")
    @classmethod
    def lower_email(cls, v):
        return v.lower()


class ProfileUpdate(StrictModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    email: Optional[EmailStr] = None

    @field_validator("name")
    @classmethod
    def clean_name(cls, v):
        if v is None:
            return v
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Name must contain at least 2 characters.")
        return v

    @field_validator("email")
    @classmethod
    def lower_email(cls, v):
        return v.lower() if v else v


class PasswordChange(StrictModel):
    current_password: str = Field(min_length=1, max_length=200)
    new_password: str

    @field_validator("new_password")
    @classmethod
    def check_password(cls, v):
        return validate_new_password(v)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    name: str
    email: str
    role: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class MessageOut(BaseModel):
    message: str


# ---------- tasks ----------
class TaskCreate(StrictModel):
    # NOTE: there is no user_id here - the owner always comes from the login token.
    category_id: Optional[int] = Field(default=None, gt=0)
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=5000)
    status: Status = "pending"
    priority: Priority = "medium"
    due_date: Optional[date] = None

    @field_validator("title")
    @classmethod
    def clean_title(cls, v):
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

    @field_validator("title", "status", "priority", mode="before")
    @classmethod
    def not_null(cls, v, info):
        # These columns are NOT NULL: omit them instead of sending null.
        if v is None:
            raise ValueError(f"{info.field_name} cannot be null.")
        return v

    @field_validator("title")
    @classmethod
    def clean_title(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("Task title cannot be empty.")
        return v


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


# ---------- admin ----------
class AdminTaskOut(TaskOut):
    owner_name: str
    owner_email: str


class AdminUserOut(BaseModel):
    user_id: int
    name: str
    email: str
    total_tasks: int
    completed_tasks: int


class AdminRequestOut(BaseModel):
    user_id: int
    name: str
    email: str
