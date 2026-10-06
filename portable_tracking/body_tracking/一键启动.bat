@echo off
cd /d "%~dp0"
"%~dp0..\runtime\python\python.exe" "%~dp0body_tracking.py"
pause
