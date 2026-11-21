@echo off
setlocal
cd /d "%~dp0backend"
if not exist .venv (
  echo Creating Python virtual environment...
  python -m venv .venv || goto :error
)
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt || goto :error
if not exist .env (
  copy .env.example .env
  echo.
  echo Created backend\.env. Please edit it now and set JWT_SECRET and MASTER_ADMIN_PASSWORD.
  notepad .env
)
echo.
echo Setup complete. When .env is configured, run START_TASKFLOW.bat.
pause
exit /b 0
:error
echo Setup failed. Check the error above.
pause
exit /b 1
