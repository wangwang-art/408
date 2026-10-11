@echo off
chcp 936 >nul
setlocal
cd /d "%~dp0"

rem ---- 运行时完整则跳过 ----
if exist "%~dp0runtime\python\python.exe" (
    echo Python runtime already configured.
    echo You can double-click 一键启动.bat to run AudioQC.
    echo.
    pause
    exit /b 0
)

echo ============================================
echo   AudioQC 一键配置（下载 Python 运行时 + 安装依赖）
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
if errorlevel 1 (
    echo 解压失败，可能是下载不完整，请删除 runtime 文件夹后重试。
    echo.
    pause
    exit /b 1
)
del /q "%~dp0runtime\python-embed.zip"
for %%F in ("%~dp0runtime\python\python*._pth") do (
    powershell -NoProfile -Command "(Get-Content -LiteralPath '%%F') -replace '^#import site','import site' | Set-Content -LiteralPath '%%F' -Encoding ASCII"
)

echo [4/5] 安装 pip（清华镜像）...
rem get-pip.py 若上次下载不完整（小于1MB）则删除重下
if exist "%~dp0runtime\get-pip.py" (
    for %%A in ("%~dp0runtime\get-pip.py") do if %%~zA LSS 1000000 del /q "%~dp0runtime\get-pip.py"
)
if not exist "%~dp0runtime\get-pip.py" (
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
del /q "%~dp0runtime\get-pip.py"

echo [5/5] 安装项目依赖（清华镜像）...
"%~dp0runtime\python\python.exe" -m pip install -r "%~dp0requirements.txt" -i https://pypi.tuna.tsinghua.edu.cn/simple
if errorlevel 1 (
    echo 依赖安装失败，请检查网络后重试。
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================
echo   配置完成！
echo   双击 一键启动.bat 即可运行音频质检工具（端口 7860）
echo   如需 Flask 版，双击 启动Flask版.bat（端口 5000）
echo ============================================
echo.
pause