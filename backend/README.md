# TaskFlow Backend (FastAPI + PostgreSQL)

This backend uses the existing database schema in `database/schema`. It does **not** create, drop, or modify tables.

## 1. Requirements
- Python 3.10+
- PostgreSQL
- Existing `todo_app` database with the `users`, `categories`, and `tasks` tables created by your teammate.

## 2. Install
Open a terminal inside the `backend` folder:

```bash
python -m venv venv
```

Windows:
```bash
venv\Scripts\activate
```

macOS/Linux:
```bash
source venv/bin/activate
```

Then:
```bash
pip install -r requirements.txt
```

## 3. Configure database connection
Copy `.env.example` to `.env` and replace `YOUR_PASSWORD` with the PostgreSQL password used on your machine.

Example:
```env
DATABASE_URL=postgresql+psycopg2://postgres:my_password@localhost:5432/todo_app
```

The application automatically loads `DATABASE_URL` from this `.env` file.

## 4. Run server
```bash
uvicorn main:app --reload
```

API base URL: `http://127.0.0.1:8000`

Interactive API documentation: `http://127.0.0.1:8000/docs`

## 5. Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/tasks` | Add a task |
| GET | `/api/tasks?user_id=1` | List tasks for a user |
| GET | `/api/tasks/{task_id}?user_id=1` | View one task |
| PUT | `/api/tasks/{task_id}?user_id=1` | Update task fields |
| DELETE | `/api/tasks/{task_id}?user_id=1` | Delete a task |
| GET | `/api/health` | Check API and DB connection |

`user_id` is required for read/update/delete so a task can only be accessed in the context of its owner. For create, send `user_id` in the JSON body.

## 6. Example POST body
```json
{
  "user_id": 1,
  "category_id": null,
  "title": "Complete internship task",
  "description": "Build CRUD APIs",
  "status": "pending",
  "priority": "high",
  "due_date": "2026-11-25"
}
```

## 7. Example update body
```json
{
  "title": "Finish To-Do backend",
  "status": "in_progress",
  "priority": "medium"
}
```

Allowed status values: `pending`, `in_progress`, `completed`.
Allowed priority values: `low`, `medium`, `high`.

## Important integration note
The current frontend still loads `js/mock-data.js`, which stores tasks in browser `localStorage`. The backend API is separate until the frontend JavaScript is changed to call these endpoints using `fetch()`.

Also, the current frontend demo login stores a name/email in browser storage; it does not authenticate against the PostgreSQL `users` table. For this CRUD assignment, the API accepts a database `user_id`. Do not expose this as production authentication: before deployment, connect login to a secure backend authentication system and derive the user ID from the authenticated session/token rather than trusting a user-supplied ID.
