# Build VocabApp Android APK
# Usage: powershell -ExecutionPolicy Bypass -File tools\build-apk.ps1 [-DebugBuild] [-JdkPath <path>]
# Default: release build (JS bundled into APK, runs without Metro)
# -DebugBuild: debug build (requires Metro, dev only)
# JDK 17 path resolution (RN 0.76 recommends JDK 17; Java 21 breaks gradle-plugin), in order:
#   -JdkPath param > JAVA_HOME env > auto-detect (~\.jdks\jdk-17*, Program Files\Java\jdk-17*, Adoptium)
param([switch]$DebugBuild, [string]$JdkPath)

$ErrorActionPreference = 'Stop'
# Force UTF-8 output to avoid encoding issues
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$root = Split-Path $PSScriptRoot -Parent

# --- Resolve JDK 17 (portable) ---
if (-not $JdkPath) { $JdkPath = $env:JAVA_HOME }
if (-not $JdkPath -or -not (Test-Path (Join-Path $JdkPath 'bin\java.exe'))) {
    $candidates = @(
        (Join-Path $env:USERPROFILE '.jdks'),
        'C:\Program Files\Java',
        'C:\Program Files\Eclipse Adoptium'
    )
    foreach ($dir in $candidates) {
        $hit = Get-ChildItem $dir -Directory -Filter 'jdk-17*' -ErrorAction SilentlyContinue |
            Sort-Object Name -Descending | Where-Object { Test-Path (Join-Path $_.FullName 'bin\java.exe') } |
            Select-Object -First 1
        if ($hit) { $JdkPath = $hit.FullName; break }
    }
}
$jdk17 = $JdkPath

# Verify JDK exists
if (-not $jdk17 -or -not (Test-Path (Join-Path $jdk17 'bin\java.exe'))) {
    Write-Host "[ERROR] JDK 17 not found (tried: '$jdk17')" -ForegroundColor Red
    Write-Host "Install JDK 17 or pass -JdkPath <path> / set JAVA_HOME." -ForegroundColor Red
    exit 1
}

# Android SDK: ANDROID_HOME env wins, default per-user location
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "$env:LOCALAPPDATA\Android\Sdk" }
if (-not (Test-Path $sdk)) {
    Write-Host "[ERROR] Android SDK not found at: $sdk" -ForegroundColor Red
    exit 1
}

# Gradle home (default per-user; override with GRADLE_USER_HOME env).
# Note: keep it on the system drive — some mounts (D:) do not support atomic moves.
$gradleHome = if ($env:GRADLE_USER_HOME) { $env:GRADLE_USER_HOME } else { Join-Path $env:USERPROFILE '.gradle' }
if (-not (Test-Path $gradleHome)) {
    New-Item -ItemType Directory -Force -Path $gradleHome | Out-Null
}

# Set env vars (in current process, so gradlew.bat inherits them)
$env:JAVA_HOME = $jdk17
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$env:GRADLE_USER_HOME = $gradleHome

# Ensure node is on PATH for gradle subprocess (settings.gradle calls node)
$nodePath = Split-Path (Get-Command node).Source -Parent
if ($env:PATH -notlike "*$nodePath*") {
    $env:PATH = "$nodePath;$env:PATH"
}

$variant = if ($DebugBuild) { 'Debug' } else { 'Release' }
Write-Host "=== Build $variant ===" -ForegroundColor Cyan
Write-Host "JAVA_HOME = $env:JAVA_HOME" -ForegroundColor Cyan
Write-Host "ANDROID_HOME = $env:ANDROID_HOME" -ForegroundColor Cyan
Write-Host "GRADLE_USER_HOME = $env:GRADLE_USER_HOME" -ForegroundColor Cyan
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
    & $gradlew $task --console=plain
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
