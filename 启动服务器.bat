@echo off
chcp 65002 >nul 2>&1
set "PYTHON=C:\Users\ZXHDHF\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe"
if not exist "%PYTHON%" (
    echo ERROR: Python not found
    pause
    exit /b
)
echo Starting local server...
cd /d "%~dp0"
"%PYTHON%" -m http.server 8080
pause