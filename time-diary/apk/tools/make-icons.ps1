# 从 1024x1024 源图标生成 Android 全套 mipmap 图标
# 用法: powershell -ExecutionPolicy Bypass -File tools\make-icons.ps1 -Source resources\icon-1024.png
param(
    [string]$Source = (Join-Path $PSScriptRoot '..\resources\icon-1024.png')
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$apk = Split-Path $PSScriptRoot -Parent
$res = Join-Path $apk 'android\app\src\main\res'
if (-not (Test-Path $Source)) { throw "源图标不存在: $Source" }
if (-not (Test-Path $res)) { throw "先执行 npx cap add android 再生成图标" }

$src = [System.Drawing.Image]::FromFile((Resolve-Path $Source))
$bg = [System.Drawing.Color]::FromArgb(255, 0xFF, 0xF6, 0xF0)  # 奶油白背景

function New-Canvas([int]$size) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    return @{ bmp = $bmp; g = $g }
}

# 普通图标：整图铺满（ic_launcher / ic_launcher_round）
foreach ($d in @{ 'mipmap-mdpi' = 48; 'mipmap-hdpi' = 72; 'mipmap-xhdpi' = 96; 'mipmap-xxhdpi' = 144; 'mipmap-xxxhdpi' = 192 }.GetEnumerator()) {
    $dir = Join-Path $res $d.Key
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    foreach ($name in 'ic_launcher.png', 'ic_launcher_round.png') {
        $c = New-Canvas $d.Value
        $c.g.DrawImage($src, 0, 0, $d.Value, $d.Value)
        $c.bmp.Save((Join-Path $dir $name), [System.Drawing.Imaging.ImageFormat]::Png)
        $c.g.Dispose(); $c.bmp.Dispose()
    }
}

# 自适应图标前景：内容居中占 66%（安全区），四周透明 + 奶油底
foreach ($d in @{ 'mipmap-mdpi' = 108; 'mipmap-hdpi' = 162; 'mipmap-xhdpi' = 216; 'mipmap-xxhdpi' = 324; 'mipmap-xxxhdpi' = 432 }.GetEnumerator()) {
    $dir = Join-Path $res $d.Key
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $c = New-Canvas $d.Value
    $inner = [int]($d.Value * 0.66)
    $pad = [int](($d.Value - $inner) / 2)
    $c.g.Clear($bg)
    $c.g.DrawImage($src, $pad, $pad, $inner, $inner)
    $c.bmp.Save((Join-Path $dir 'ic_launcher_foreground.png'), [System.Drawing.Imaging.ImageFormat]::Png)
    $c.g.Dispose(); $c.bmp.Dispose()
}
$src.Dispose()

# 背景色（覆盖脚手架默认绿）
$valuesDir = Join-Path $res 'values'
New-Item -ItemType Directory -Force -Path $valuesDir | Out-Null
$bgFile = Join-Path $valuesDir 'ic_launcher_background.xml'
@'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#FFF6F0</color>
</resources>
'@ | Set-Content -Path $bgFile -Encoding UTF8

Write-Host "[make-icons] 图标生成完成（普通 + 圆形 + 自适应前景/背景）"
