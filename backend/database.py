import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
db_file = BASE_DIR / "todo_app.db"
sqlite_url = f"sqlite:///{db_file.as_posix()}"

configured_url = os.getenv("DATABASE_URL", "sqlite:///./todo_app.db").strip()
if not configured_url:
    configured_url = sqlite_url

if configured_url.startswith("sqlite"):
    engine = create_engine(configured_url, connect_args={"check_same_thread": False})
    @event.listens_for(engine, "connect")
    def _enable_sqlite_foreign_keys(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
else:
    # Do not silently switch databases: a failed PostgreSQL connection must be
    # visible so users don't accidentally write to a different database.
    engine = create_engine(configured_url, pool_pre_ping=True)

DATABASE_URL = configured_url

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
