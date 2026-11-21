# TaskFlow Local Demo Guide

TaskFlow uses the FastAPI backend and persistent database. Do not use the old localStorage demo mode.

1. Complete backend setup in the project README.
2. Start the API at `http://127.0.0.1:8000`.
3. Start the frontend using VS Code Live Server (normally `http://127.0.0.1:5500`).
4. Register a regular user and create tasks.
5. Register an administrator request.
6. Log in as the configured Master Admin, approve the request, and provide the verification code (email if SMTP is configured; otherwise copy the code from the approval alert).
7. Log in as the new administrator after verifying the code.

Demo seed accounts are optional and must be enabled/configured in `backend/.env`.
