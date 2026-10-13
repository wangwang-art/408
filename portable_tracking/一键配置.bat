@echo off
chcp 936 >nul
setlocal
cd /d "%~dp0"

set "PYEXE=%~dp0runtime\python\python.exe"

rem 运行时完整（python + mediapipe）则直接跳过
if exist "%PYEXE%" (
    if exist "%~dp0runtime\python\Lib\site-packages\mediapipe" (
        echo Python runtime already configured.
        echo You can double-click the tracking bat under hand_tracking / face_tracking / body_tracking.
        echo.
        pause
        exit /b 0
    )
    echo 检测到 Python 已存在但依赖未装完，继续安装依赖...
    goto :install_deps
)

echo ============================================
echo   人体追踪 一键配置（Python 运行时 + 依赖 + 模型）
echo   需要联网，使用国内镜像源
echo ============================================
echo.

echo [1/5] 创建 runtime 文件夹...
if not exist "%~dp0runtime" mkdir "%~dp0runtime"

echo [2/5] 从华为云镜像下载 Python 3.12.10 embeddable...
curl -L --connect-timeout 30 --retry 3 -o "%~dp0runtime\python-embed.zip" "https://mirrors.huaweicloud.com/python/3.12.10/python-3.12.10-embed-amd64.zip"
if errorlevel 1 (
    echo 下载失败，请检查网络后重试。
    echo.
    pause
    exit /b 1
)

echo [3/5] 解压并启用 site-packages...
powershell -NoProfile -Command "Expand-Archive -Force -LiteralPath '%~dp0runtime\python-embed.zip' -DestinationPath '%~dp0runtime\python'"
del /q "%~dp0runtime\python-embed.zip"
for %%F in ("%~dp0runtime\python\python*._pth") do (
    powershell -NoProfile -Command "(Get-Content -LiteralPath '%%F') -replace '^#import site','import site' | Set-Content -LiteralPath '%%F' -Encoding ASCII"
)

:install_deps
echo [4/5] 安装 pip 和依赖（清华镜像）...
rem get-pip.py 若上次下载不完整（小于1MB）则删除重下
if exist "%~dp0runtime\get-pip.py" (
    for %%A in ("%~dp0runtime\get-pip.py") do if %%~zA LSS 1000000 del /q "%~dp0runtime\get-pip.py"
)
if not exist "%~dp0runtime\get-pip.py" (
    echo 下载 pip 引导脚本...
    curl -L --connect-timeout 30 --retry 3 -o "%~dp0runtime\get-pip.py" "https://bootstrap.pypa.io/get-pip.py"
    if errorlevel 1 (
        echo get-pip.py 下载失败，请检查网络后重试。
        echo.
        pause
        exit /b 1
    )
)
"%~dp0runtime\python\python.exe" "%~dp0runtime\get-pip.py" -i https://pypi.tuna.tsinghua.edu.cn/simple
if errorlevel 1 (
    echo pip 安装失败，请检查网络后重试。
    echo.
    pause
    exit /b 1
)
"%~dp0runtime\python\python.exe" -m pip install -r "%~dp0requirements.txt" -i https://pypi.tuna.tsinghua.edu.cn/simple
if errorlevel 1 (
    echo 依赖安装失败，请检查网络后重试。
    echo.
    pause
    exit /b 1
)

echo [5/5] 检查 MediaPipe 模型文件（缺失时自动下载）...
if not exist "%~dp0body_tracking\pose_landmarker.task" (
    echo   - 下载 pose_landmarker.task (身体追踪)
    curl -L --connect-timeout 30 --retry 3 -o "%~dp0body_tracking\pose_landmarker.task" "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
    if errorlevel 1 (
        echo 身体追踪模型下载失败，尝试手动下载：
        echo   https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task
        echo   下载后重命名为 pose_landmarker.task 放入 body_tracking\ 目录
    )
)
if not exist "%~dp0hand_tracking\hand_landmarker.task" (
    echo   - 下载 hand_landmarker.task (手部追踪)
    curl -L --connect-timeout 30 --retry 3 -o "%~dp0hand_tracking\hand_landmarker.task" "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
    if errorlevel 1 (
        echo 手部追踪模型下载失败，尝试手动下载：
        echo   https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task
        echo   下载后放入 hand_tracking\ 目录
    )
)
if not exist "%~dp0face_tracking\face_landmarker.task" (
    echo   - 下载 face_landmarker.task (脸部追踪)
    curl -L --connect-timeout 30 --retry 3 -o "%~dp0face_tracking\face_landmarker.task" "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
    if errorlevel 1 (
        echo 脸部追踪模型下载失败，尝试手动下载：
        echo   https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
        echo   下载后放入 face_tracking\ 目录
    )
)

echo.
echo ============================================
echo   配置完成！
echo   双击对应子目录下的 一键启动.bat 即可运行：
echo     body_tracking\一键启动.bat   身体追踪
echo     hand_tracking\一键启动.bat   手部追踪
echo     face_tracking\一键启动.bat   脸部追踪
echo ============================================
echo.
pause
