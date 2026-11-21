"""Password hashing, JWT tokens and a simple login rate limiter."""
import os
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from threading import Lock

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import HTTPException

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET", "")
if len(JWT_SECRET) < 32:
    raise RuntimeError(
        "JWT_SECRET is missing or too short (need 32+ characters). Set it in backend/.env. "
        "Generate one: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
    )

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))


# ---------- passwords ----------
def hash_password(password: str) -> str:
    """bcrypt with a random per-password salt. The result is safe to store in users.password_hash."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:  # malformed hash or password longer than bcrypt's 72 bytes
        return False


# Used when the email doesn't exist, so "unknown email" and "wrong password"
# take the same time (prevents discovering which emails are registered).
DUMMY_HASH = hash_password("timing-attack-protection")


# ---------- tokens ----------
def create_access_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> int:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ---------- brute-force protection (in-memory, per server process) ----------
class LoginLimiter:
    def __init__(self, max_failures: int = 5, window_seconds: int = 900):
        self.max_failures = max_failures
        self.window = window_seconds
        self._failures = defaultdict(list)
        self._lock = Lock()

    def _prune(self, key: str, now: float):
        self._failures[key] = [t for t in self._failures[key] if now - t < self.window]

    def check(self, key: str):
        now = time.time()
        with self._lock:
            self._prune(key, now)
            if len(self._failures[key]) >= self.max_failures:
                raise HTTPException(
                    status_code=429,
                    detail="Too many failed login attempts. Try again in 15 minutes.",
                )

    def register_failure(self, key: str):
        with self._lock:
            self._failures[key].append(time.time())

    def reset(self, key: str):
        with self._lock:
            self._failures.pop(key, None)


login_limiter = LoginLimiter()
