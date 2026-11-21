# TaskFlow Backend (FastAPI + SQLAlchemy)

## Requirements
- Python 3.10+ (Python 3.12/3.13 recommended)
- SQLite for local use (bundled with Python); PostgreSQL is optional.

## Windows setup
From the project root:

```bat
cd backend
python -m venv .venv
.venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
copy .env.example .env
```

Edit `.env` and set a unique `JWT_SECRET` (generate with `python -c "import secrets; print(secrets.token_urlsafe(48))"`) and a strong `MASTER_ADMIN_PASSWORD`. The default database is a persistent SQLite file in `backend/todo_app.db`. If you use PostgreSQL, set `DATABASE_URL` to the correct connection string. A PostgreSQL connection failure is reported instead of silently switching databases.

## Initialize

```bat
python init_db.py
```

This creates the tables and seeds the configured Master Admin. Optional demo accounts/tasks can be created by setting `SEED_DEMO_ACCOUNTS=true` and demo credentials in `.env`. Demo accounts are disabled by default.

## Run API

```bat
uvicorn main:app --reload
```

- API: http://127.0.0.1:8000
- Swagger: http://127.0.0.1:8000/docs (development only)
- Health: http://127.0.0.1:8000/api/health

Open `Frontend/index.html` using VS Code Live Server (recommended). Configure `ALLOWED_ORIGINS` if your Live Server port differs. The frontend API base defaults to `http://127.0.0.1:8000` and can be overridden before loading `js/api.js` with `window.TASKFLOW_API_BASE`.

## Optional SMTP email
Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, and `SMTP_FROM` in `.env` to enable email notifications for administrator requests and approval verification codes. Without SMTP, the Master Admin approval screen displays the verification code for manual delivery.

## Security notes
- Passwords are hashed using bcrypt.
- Access tokens are signed JWTs and stored in browser session storage.
- Users can only access their own tasks/categories.
- Admin and Master Admin endpoints enforce server-side role checks.
- Login attempts are rate-limited in-memory per server process.
- Use HTTPS, a strong secret, a configured mail provider, and a managed database before deployment.
