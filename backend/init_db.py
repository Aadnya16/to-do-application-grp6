"""Database initialization and seeding script for TaskFlow."""
import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from database import Base, engine, SessionLocal
from models import User, Category, Task
from main import seed_initial_accounts


def init_database():
    print("Initializing TaskFlow Database...")
    print(f"Engine dialect: {engine.dialect.name}")

    # Create tables
    Base.metadata.create_all(bind=engine)
    print("✓ All tables created successfully (users, categories, tasks)")

    # Seed the configured Master Admin and optional demo accounts.
    seed_initial_accounts()
    import os
    if os.getenv("MASTER_ADMIN_EMAIL") and os.getenv("MASTER_ADMIN_PASSWORD") and os.getenv("MASTER_ADMIN_PASSWORD") not in {"REPLACE_WITH_STRONG_PASSWORD", "YOUR_PASSWORD", "changeme"}:
        print("✓ Configured Master Admin seed attempted.")
    else:
        print("⚠ Master Admin not seeded: configure MASTER_ADMIN_EMAIL and a strong MASTER_ADMIN_PASSWORD in .env first.")
    if os.getenv("SEED_DEMO_ACCOUNTS", "false").lower() == "true":
        print("✓ Optional demo accounts/tasks enabled.")

    db = SessionLocal()
    try:
        user_count = db.query(User).count()
        task_count = db.query(Task).count()
        cat_count = db.query(Category).count()
        print(f"✓ Current database state: {user_count} users, {task_count} tasks, {cat_count} categories")
    finally:
        db.close()

    print("TaskFlow Database initialization complete.")


if __name__ == "__main__":
    init_database()
