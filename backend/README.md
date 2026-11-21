# TaskFlow Backend (FastAPI + PostgreSQL)

## 1. Database
Uses the existing `database/schema` as-is (no changes needed). Admin approval is stored in the `role` column: `user`, `admin`, `pending_admin`, `rejected_admin`.

## 2. Install
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows   (macOS/Linux: source venv/bin/activate)
pip install -r requirements.txt
```

## 3. Configure
Copy `.env.example` to `.env` and fill in:
- `DATABASE_URL` - your PostgreSQL password
- `JWT_SECRET` - required, 32+ random characters:
  `python -c "import secrets; print(secrets.token_urlsafe(48))"`
- `ALLOWED_ORIGINS` - the URL your frontend runs on (e.g. VS Code Live Server = `http://127.0.0.1:5500`)
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` - creates the FIRST admin on startup. Remove the password from `.env` afterwards.

## 4. Run
```bash
uvicorn main:app --reload
```
API docs (development only): http://127.0.0.1:8000/docs

Frontend: open `Frontend/index.html` with Live Server. The API address is `API_BASE` at the top of `Frontend/js/api.js`.

## Security summary
- Passwords are hashed with **bcrypt** (salted, 12 rounds). Plain passwords are never stored or returned.
- Login returns a signed JWT; every task/admin route reads the user from the token. The client can no longer send a `user_id`.
- Users only see/change their own tasks; other people's tasks return 404.
- Role is decided by the server. Admin sign-ups are `pending_admin` until an active admin approves them.
- Admin routes (`/api/admin/*`) return 403 for non-admins.
- Login is rate limited (5 failures / 15 min per IP + email) and constant-time for unknown emails.
- CORS only allows `ALLOWED_ORIGINS`. Unknown JSON fields are rejected.

## Endpoints
| Method | Endpoint | Access |
|---|---|---|
| POST | `/api/auth/register` | public |
| POST | `/api/auth/register-admin` | public (creates a pending request) |
| POST | `/api/auth/login` | public |
| GET / PUT | `/api/auth/me` | logged in |
| POST | `/api/auth/change-password` | logged in |
| POST / GET | `/api/tasks` | logged in (own tasks) |
| GET / PUT / DELETE | `/api/tasks/{id}` | logged in (own tasks) |
| GET | `/api/admin/users`, `/api/admin/tasks`, `/api/admin/admin-requests` | admin |
| POST | `/api/admin/admin-requests/{user_id}/approve` or `reject` | admin |

Send the token as `Authorization: Bearer <token>`.

## Before real deployment
Use HTTPS, set `APP_ENV=production`, set `ALLOWED_ORIGINS` to the real frontend URL, and consider moving the token to an httpOnly cookie. The login rate limiter is in-memory (per process).
