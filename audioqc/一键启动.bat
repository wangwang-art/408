@echo off
chcp 936 >nul
setlocal
cd /d "%~dp0"

echo ================================================
echo   AudioQC 音频质检 - 本地启动
echo ================================================
echo.

if not exist "runtime\python\python.exe" (
    echo [错误] 未找到 Python 运行时（runtime 文件夹）。
    echo        请先双击 一键配置.bat 完成首次配置（需联网）。
    echo.
    pause
    exit /b 1
)

powershell -NoProfile -Command "if(Get-NetTCPConnection -LocalPort 7860 -State Listen -ErrorAction SilentlyContinue){exit 1}else{exit 0}"
if errorlevel 1 (
    echo [提示] 端口 7860 已被占用。
    echo        可能已有一个 AudioQC 正在运行，请先关闭它，或双击 释放端口.bat。
    echo.
    pause
    exit /b 1
)

echo [1/2] 正在启动本地服务，首次加载模型约需 5-15 秒，请耐心等待...
echo.
echo   * 浏览器会自动打开 http://127.0.0.1:7860
echo   * 没有自动打开时，请手动在浏览器输入该地址
echo   * 服务运行期间本窗口会保持显示，请勿关闭
echo     （关闭本窗口 = 停止服务；用完直接关窗即可）
echo.
if not exist "%~dp0data\.logs" mkdir "%~dp0data\.logs"
attrib +h "%~dp0data" >nul 2>&1
start /b powershell -NoProfile -Command "for($i=0;$i -lt 60;$i++){try{(New-Object Net.Sockets.TcpClient).Connect('127.0.0.1',7860)|Out-Null;Start-Process 'http://127.0.0.1:7860';break}catch{Start-Sleep -Seconds 2}}"
echo [2/2] 服务器进程中，稍候浏览器将自动打开页面...
runtime\python\python.exe app_ai_quality_mobile.py > "%~dp0data\.logs\app_7860.log" 2>&1
echo.
echo 服务已停止。
pause
