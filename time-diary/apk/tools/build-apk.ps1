# 时间日记 · 一键打包 Android APK（工具链位置可移植：参数/环境变量优先，默认 F 盘）
# 用法:
#   powershell -ExecutionPolicy Bypass -File tools\build-apk.ps1            # debug 包（直接可装）
#   powershell -ExecutionPolicy Bypass -File tools\build-apk.ps1 -Release   # release 包（自动生成签名）
# 工具链位置（换机时改其一即可，优先级从高到低）：
#   -ToolsDir 参数 > 环境变量 TD_BUILD_TOOLS > 默认 F:\android-build-tools
#   -JdkPath  参数 > 环境变量 TD_JDK       > $ToolsDir 下 jdk-21* 自动探测
param(
    [switch]$Release,
    [string]$ToolsDir,
    [string]$JdkPath
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$apk = Split-Path $PSScriptRoot -Parent
$ver = (Get-Content (Join-Path $apk 'package.json') -Raw | ConvertFrom-Json).version

# ---------- 工具链定位（可移植） ----------
if (-not $ToolsDir) { $ToolsDir = $env:TD_BUILD_TOOLS }
if (-not $ToolsDir) { $ToolsDir = 'F:\android-build-tools' }
$tools = $ToolsDir
$sdk = Join-Path $tools 'android-sdk'

if (-not $JdkPath) { $JdkPath = $env:TD_JDK }
if (-not $JdkPath) {
    $cand = Get-ChildItem $tools -Directory -Filter 'jdk-21*' -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending | Select-Object -First 1
    if ($cand) { $JdkPath = $cand.FullName }
}
if (-not $JdkPath -and $env:JAVA_HOME -and (Test-Path (Join-Path $env:JAVA_HOME 'bin\java.exe'))) { $JdkPath = $env:JAVA_HOME }
$jdk = $JdkPath

if (-not $jdk -or -not (Test-Path (Join-Path $jdk 'bin\java.exe'))) { Write-Host "[ERROR] 缺少 JDK21（已尝试: '$jdk'；可用 -JdkPath 或环境变量 TD_JDK 指定）" -ForegroundColor Red; exit 1 }
if (-not (Test-Path (Join-Path $sdk 'platforms\android-35'))) { Write-Host "[ERROR] 缺少 Android SDK 平台: $sdk（可用 -ToolsDir 或环境变量 TD_BUILD_TOOLS 指定）" -ForegroundColor Red; exit 1 }

$env:JAVA_HOME = $jdk
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$env:GRADLE_USER_HOME = Join-Path $tools '.gradle'          # gradle 全局缓存 → F 盘
$env:npm_config_cache = Join-Path $tools '.npm-cache'
$nodePath = Split-Path (Get-Command node).Source -Parent
if ($env:PATH -notlike "*$nodePath*") { $env:PATH = "$nodePath;$env:PATH" }

Write-Host "=== 时间日记 APK 打包（$($(if ($Release) {'release'} else {'debug'}))）===" -ForegroundColor Cyan
Write-Host "JAVA_HOME=$env:JAVA_HOME"; Write-Host "ANDROID_HOME=$env:ANDROID_HOME"; Write-Host "GRADLE_USER_HOME=$env:GRADLE_USER_HOME"

# ---------- 1. 同步网页 ----------
& powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'sync-www.ps1')
if ($LASTEXITCODE -ne 0) { throw "www 同步失败" }

# ---------- 1.5 关键：把 www 拷进 Android 工程（cap copy），否则打的是旧资源 ----------
Push-Location $apk
try {
    & npx cap copy android
    if ($LASTEXITCODE -ne 0) { throw "cap copy 失败" }
} finally {
    Pop-Location
}
$pubIndex = Join-Path $apk 'android\app\src\main\assets\public\index.html'
$pubRaw = Get-Content $pubIndex -Raw
if ($pubRaw -notmatch 'id="app"') { throw "Android assets 内不是 SPA 入口（cap copy 未生效），中止打包" }
if ($pubRaw -match 'http-equiv="refresh"') { throw "Android assets 内仍是旧版跳转页，中止打包" }
$pubRouter = Join-Path $apk 'android\app\src\main\assets\public\js\router.js'
if (-not (Test-Path $pubRouter)) { throw "Android assets 缺少 js/router.js，中止打包" }
Write-Host ">>> Android assets 已更新为 SPA 版本" -ForegroundColor Yellow

# ---------- 2. release 签名（首次自动生成 keystore，全部存 apk\resources 下） ----------
if ($Release) {
    $ksDir = Join-Path $apk 'resources'
    $ksPath = Join-Path $ksDir 'timediary-release.keystore'
    $ksPropFile = Join-Path $apk 'android\keystore.properties'
    if (-not (Test-Path $ksPath)) {
        Write-Host ">>> 首次打包：生成 release 签名 keystore" -ForegroundColor Yellow
        $pass = 'timediary2026'
        & (Join-Path $jdk 'bin\keytool.exe') -genkeypair -v -keystore $ksPath `
            -alias timediary -keyalg RSA -keysize 2048 -validity 10000 `
            -storepass $pass -keypass $pass `
            -dname 'CN=TimeDiary, OU=Personal, O=wangyouhong, L=Hangzhou, ST=Zhejiang, C=CN'
        if ($LASTEXITCODE -ne 0) { throw "keystore 生成失败" }
    }
    $pass2 = 'timediary2026'
    @"
storeFile=$($ksPath -replace '\\', '/')
storePassword=$pass2
keyAlias=timediary
keyPassword=$pass2
"@ | Set-Content -Path $ksPropFile -Encoding ASCII
    Write-Host ">>> 签名配置已写入 keystore.properties" -ForegroundColor Yellow
}

# ---------- 3. Gradle 构建 ----------
$gradlew = Join-Path $apk 'android\gradlew.bat'
$task = if ($Release) { 'assembleRelease' } else { 'assembleDebug' }
$variant = if ($Release) { 'release' } else { 'debug' }
Push-Location (Join-Path $apk 'android')
try {
    Write-Host "`n>>> gradlew $task （首次构建需下载 Gradle 与依赖，耐心等待）`n" -ForegroundColor Yellow
    & $gradlew $task --console=plain --no-daemon
    if ($LASTEXITCODE -ne 0) { throw "Gradle 构建失败 (exit $LASTEXITCODE)" }

    $built = Join-Path $apk "android\app\build\outputs\apk\$variant\app-$variant.apk"
    if (-not (Test-Path $built)) { throw "构建完成但未找到 APK: $built" }
    $out = Join-Path $apk "TimeDiary-v$ver-$variant.apk"
    Copy-Item $built $out -Force
    $mb = [math]::Round((Get-Item $out).Length / 1MB, 1)
    Write-Host "`n=== 打包成功 ===" -ForegroundColor Green
    Write-Host "APK: $out ($mb MB)" -ForegroundColor Green
} finally {
    Pop-Location
}
