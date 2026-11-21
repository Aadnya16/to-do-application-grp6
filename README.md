# TaskFlow

TaskFlow is a task-management web application with a vanilla HTML/CSS/JavaScript frontend and FastAPI backend. It includes user task management, administrator dashboards, Master Admin approval of administrator requests, task categories, profile/password updates, and persistent database storage.

## Quick start (Windows)

**Shortcut:** run `SETUP_TASKFLOW.bat` once. It creates the virtual environment, installs dependencies, and creates `backend/.env` from the example. Edit that file and set the JWT secret and Master Admin password. Then run `START_TASKFLOW.bat` to initialize the database, start the API and frontend servers, and open the app. Keep both server windows open.

Manual setup is also available below. Install Python 3.11+ (3.12/3.13 recommended) and VS Code if desired.

1. Open a terminal and run:

```bat
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

3. Edit `backend/.env`: generate a JWT secret and set a strong Master Admin password (at least 8 characters).
4. Initialize the database:

```bat
python init_db.py
```

5. Start the API (in the backend folder):

```bat
uvicorn main:app --reload
```

6. Open `Frontend/index.html` with Live Server.

## Database
SQLite is the default and persists in `backend/todo_app.db`. PostgreSQL is optional; set `DATABASE_URL` in `.env`. The application will not silently fall back to a different database if a configured database is unavailable.

## Administrator workflow
- User registration creates an active user account.
- Admin registration creates a pending request.
- Master Admin approves/rejects the request.
- Approval creates a six-digit verification code (valid for 15 minutes) and optionally emails it to the applicant when SMTP is configured. Otherwise the Master Admin copies it from the approval confirmation and delivers it manually.
- The applicant signs in with email/password/code to activate the Admin account.

## Demo accounts
Demo accounts are optional. Set `SEED_DEMO_ACCOUNTS=true` in `.env` and configure demo passwords before running `python init_db.py`. Do not use sample credentials for real deployments.

## Testing
From the backend directory with the virtual environment activated:

```bat
python test_backend.py
python test_server_live.py
```

These tests use separate temporary SQLite databases and do not overwrite the app database.

## Documentation
- Backend setup and API: `backend/README.md`
- Integration progress: `INTEGRATION_PROGRESS.md`
