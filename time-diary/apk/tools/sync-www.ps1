# 同步网页源码到 www/（Capacitor webDir）
# 用法: powershell -ExecutionPolicy Bypass -File tools\sync-www.ps1
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$apk = Split-Path $PSScriptRoot -Parent
$src = Split-Path $apk -Parent   # time-diary 根目录
$www = Join-Path $apk 'www'

if (Test-Path $www) { Remove-Item $www -Recurse -Force }
New-Item -ItemType Directory -Force -Path $www | Out-Null

# SPA：单入口 index.html + css/js/assets（vendor 已本地化，离线可用）
Copy-Item (Join-Path $src 'index.html') (Join-Path $www 'index.html')
Copy-Item (Join-Path $src 'css')     (Join-Path $www 'css')     -Recurse
Copy-Item (Join-Path $src 'js')      (Join-Path $www 'js')      -Recurse
Copy-Item (Join-Path $src 'assets')  (Join-Path $www 'assets')  -Recurse

$count = (Get-ChildItem $www -Recurse -File | Measure-Object).Count
$sizeMB = [math]::Round(((Get-ChildItem $www -Recurse -File | Measure-Object Length -Sum).Sum) / 1MB, 1)
Write-Host "[sync-www] www/ 同步完成：$count 个文件，$sizeMB MB"
