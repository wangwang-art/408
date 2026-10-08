@echo off
setlocal
cd /d "%~dp0"

echo ================================================
echo   AudioQC - Flask Edition (Portable)
echo ================================================
echo.

if not exist "runtime\python\python.exe" (
    echo [ERROR] Embedded Python runtime not found.
    echo         Please re-download the FULL package with runtime folder.
    echo.
    pause
    exit /b 1
)

powershell -NoProfile -Command "if(Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue){exit 1}else{exit 0}"
if errorlevel 1 (
    echo [WARN] Port 5000 is already in use. Close the other AudioQC window first, then rerun.
    echo.
    pause
    exit /b 1
)

echo [OK] Starting Flask edition...
echo         URL: http://127.0.0.1:5000
echo         Close this window to stop the program.
echo.
if not exist "%~dp0data\.logs" mkdir "%~dp0data\.logs"
attrib +h "%~dp0data" >nul 2>&1
start /b powershell -NoProfile -Command "for($i=0;$i -lt 30;$i++){try{(New-Object Net.Sockets.TcpClient).Connect('127.0.0.1',5000)|Out-Null;Start-Process 'http://127.0.0.1:5000';break}catch{Start-Sleep -Seconds 2}}"
runtime\python\python.exe app_ai_quality_flask.py > "%~dp0data\.logs\app_5000.log" 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] Program exited with error. Please screenshot the message above and send it back.
    pause
)
