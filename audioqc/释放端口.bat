@echo off
setlocal
cd /d "%~dp0"

echo ================================================
echo   AudioQC - Release Port 7860 / 5000
echo ================================================
echo.
echo This script force-stops programs occupying port 7860 or 5000.
echo If you are NOT sure other important software uses these ports,
echo please close this window now.
echo.
powershell -NoProfile -Command "$ports=7860,5000; $found=$false; $conns=Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue; foreach($cn in $conns){ if($ports -contains $cn.LocalPort){ Write-Host ('Port '+$cn.LocalPort+' owned by PID '+$cn.OwningProcess+' - stopped'); Stop-Process -Id $cn.OwningProcess -Force -ErrorAction SilentlyContinue; $found=$true } }; if(-not $found){ Write-Host 'No process is listening on 7860 / 5000. Nothing to do.' }"
echo.
echo Done. Now you can run 一键启动.bat or 启动Flask版.bat again.
echo.
pause
