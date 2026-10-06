# Build VocabApp Android APK
# Usage: powershell -ExecutionPolicy Bypass -File tools\build-apk.ps1
# Default: release build (JS bundled into APK, runs without Metro)
# -DebugBuild: debug build (requires Metro, dev only)
param([switch]$DebugBuild)

$ErrorActionPreference = 'Stop'
# Force UTF-8 output to avoid encoding issues
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$root = Split-Path $PSScriptRoot -Parent

# JDK 17 path (RN 0.76 recommends JDK 17; Java 21 breaks gradle-plugin)
$jdk17 = 'C:\Users\51070\.jdks\jdk-17.0.20+8'

# Verify JDK exists
$javaExe = Join-Path $jdk17 'bin\java.exe'
if (-not (Test-Path $javaExe)) {
    Write-Host "[ERROR] JDK 17 not found at: $jdk17" -ForegroundColor Red
    Write-Host "Please install JDK 17 or update the path in this script." -ForegroundColor Red
    exit 1
}

$sdk = "$env:LOCALAPPDATA\Android\Sdk"
if (-not (Test-Path $sdk)) {
    Write-Host "[ERROR] Android SDK not found at: $sdk" -ForegroundColor Red
    exit 1
}

# Gradle cache dir (D drive mount does not support atomic move, use C drive)
$cacheDir = 'C:\Users\51070\.gradle\caches\vocab-app'
if (-not (Test-Path $cacheDir)) {
    New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null
}

# Set env vars (in current process, so gradlew.bat inherits them)
$env:JAVA_HOME = $jdk17
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk

# Ensure node is on PATH for gradle subprocess (settings.gradle calls node)
$nodePath = Split-Path (Get-Command node).Source -Parent
if ($env:PATH -notlike "*$nodePath*") {
    $env:PATH = "$nodePath;$env:PATH"
}

$variant = if ($DebugBuild) { 'Debug' } else { 'Release' }
Write-Host "=== Build $variant ===" -ForegroundColor Cyan
Write-Host "JAVA_HOME = $env:JAVA_HOME" -ForegroundColor Cyan
Write-Host "ANDROID_HOME = $env:ANDROID_HOME" -ForegroundColor Cyan
Write-Host "Gradle cache = $cacheDir" -ForegroundColor Cyan
Write-Host "Node path = $nodePath" -ForegroundColor Cyan

# Verify java executable (java -version writes to stderr by design)
$prevEAP = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$javaVersion = (& $javaExe -version 2>&1 | Select-Object -First 1).ToString()
$ErrorActionPreference = $prevEAP
Write-Host "Java: $javaVersion" -ForegroundColor Cyan

Push-Location (Join-Path $root 'android')
try {
    $task = if ($DebugBuild) { 'assembleDebug' } else { 'assembleRelease' }
    $gradlew = Join-Path $root 'android\gradlew.bat'
    Write-Host "`n>>> Running: $gradlew $task`n" -ForegroundColor Yellow
    & $gradlew $task --console=plain --project-cache-dir $cacheDir
    if ($LASTEXITCODE -ne 0) {
        throw "Gradle build failed (exit $LASTEXITCODE)"
    }

    $apk = Join-Path $root "android\app\build\outputs\apk\$($variant.ToLower())\app-$($variant.ToLower()).apk"
    if (Test-Path $apk) {
        $target = Join-Path $root "VocabApp-v1.0.0-$($variant.ToLower()).apk"
        Copy-Item $apk $target -Force
        $sizeMB = [math]::Round((Get-Item $target).Length / 1MB, 1)
        Write-Host "`n=== BUILD SUCCESS ===" -ForegroundColor Green
        Write-Host "APK: $target" -ForegroundColor Green
        Write-Host "Size: $sizeMB MB" -ForegroundColor Green
    } else {
        throw "Build claimed success but APK not found at: $apk"
    }
} finally {
    Pop-Location
}
