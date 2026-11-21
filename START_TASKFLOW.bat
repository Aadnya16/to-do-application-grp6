@echo off
setlocal
cd /d "%~dp0backend"
if not exist .venv\Scripts\python.exe (
  echo Run SETUP_TASKFLOW.bat first.
  pause
  exit /b 1
)
if not exist .env (
  echo backend\.env is missing. Run SETUP_TASKFLOW.bat and configure it.
  pause
  exit /b 1
)
call .venv\Scripts\activate.bat
python init_db.py || (echo Database initialization failed.& pause & exit /b 1)
start "TaskFlow API" cmd /k "cd /d ""%~dp0backend"" && call .venv\Scripts\activate.bat && uvicorn main:app --reload"
start "TaskFlow Frontend" cmd /k "cd /d ""%~dp0Frontend"" && python -m http.server 5500"
timeout /t 3 >nul
start http://127.0.0.1:5500/index.html
echo TaskFlow started. Keep both server windows open while using the app.
