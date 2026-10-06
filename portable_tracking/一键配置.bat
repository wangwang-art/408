@echo off
setlocal
cd /d "%~dp0"

if exist "%~dp0runtime\python\python.exe" (
    echo Python runtime already configured.
    echo You can double-click the tracking bat under hand_tracking / face_tracking / body_tracking.
    echo.
    pause
    exit /b 0
)

echo ============================================
echo   One-Click Setup for Tracking Apps
echo   It will download Python runtime and install dependencies.
echo   Network access to Chinese mirrors is required.
echo ============================================
echo.

echo [1/4] Creating runtime folder...
if not exist "%~dp0runtime" mkdir "%~dp0runtime"

echo [2/4] Downloading Python 3.12.10 embeddable from Huawei Cloud mirror...
curl -L --connect-timeout 30 -o "%~dp0runtime\python-embed.zip" "https://mirrors.huaweicloud.com/python/3.12.10/python-3.12.10-embed-amd64.zip"
if errorlevel 1 (
    echo Download failed. Please check network and retry.
    echo.
    pause
    exit /b 1
)

echo [3/4] Extracting and enabling site-packages...
powershell -NoProfile -Command "Expand-Archive -Force -LiteralPath '%~dp0runtime\python-embed.zip' -DestinationPath '%~dp0runtime\python'"
del /q "%~dp0runtime\python-embed.zip"
for %%F in ("%~dp0runtime\python\python*._pth") do (
    powershell -NoProfile -Command "(Get-Content -LiteralPath '%%F') -replace '^#import site','import site' | Set-Content -LiteralPath '%%F' -Encoding ASCII"
)

echo [4/4] Installing pip and dependencies from Tsinghua mirror...
curl -L --connect-timeout 30 -o "%~dp0runtime\get-pip.py" "https://bootstrap.pypa.io/get-pip.py"
"%~dp0runtime\python\python.exe" "%~dp0runtime\get-pip.py" -i https://pypi.tuna.tsinghua.edu.cn/simple
"%~dp0runtime\python\python.exe" -m pip install mediapipe opencv-python -i https://pypi.tuna.tsinghua.edu.cn/simple

echo.
echo Setup finished. You can now double-click the one-click bat under hand_tracking / face_tracking / body_tracking.
echo.
pause
