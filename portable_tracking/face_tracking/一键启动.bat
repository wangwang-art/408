@echo off
chcp 936 >nul
cd /d "%~dp0"
"%~dp0..\runtime\python\python.exe" "%~dp0face_tracking.py"
pause
