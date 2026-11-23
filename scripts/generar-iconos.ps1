$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$logoPath = (Resolve-Path 'estilos\img\logo.jpeg').Path
$logo = [System.Drawing.Image]::FromFile($logoPath)

function New-Canvas($w, $h, $bg) {
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear($bg)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    return @{ Bmp = $bmp; G = $g }
}

function Draw-Centered($g, $img, $w, $h, $scale) {
    $size = [Math]::Min($w, $h) * $scale
    $nw = [int]$size; $nh = [int]$size
    $x = [int](($w - $nw) / 2); $y = [int](($h - $nh) / 2)
    $g.DrawImage($img, $x, $y, $nw, $nh)
}

$blue = [System.Drawing.Color]::FromArgb(255, 37, 99, 235)
$white = [System.Drawing.Color]::White

# Densidades para iconos (dp -> px)
$dens = @{ mdpi=1; hdpi=1.5; xhdpi=2; xxhdpi=3; xxxhdpi=4 }
$base = 48

foreach ($d in $dens.Keys) {
    $scale = $dens[$d]
    $size = [int]($base * $scale)

    # ic_launcher.png (legacy, fondo azul)
    $c = New-Canvas $size $size $blue
    Draw-Centered $c.G $logo $size $size 0.75
    $out = "android\app\src\main\res\mipmap-$d\ic_launcher.png"
    $c.Bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
    $c.G.Dispose(); $c.Bmp.Dispose()

    # ic_launcher_round.png (mismo)
    Copy-Item $out "android\app\src\main\res\mipmap-$d\ic_launcher_round.png" -Force

    # ic_launcher_foreground.png (adaptive, transparente, logo con padding)
    $fg = New-Canvas ([int]($size * 2.25)) ([int]($size * 2.25)) ([System.Drawing.Color]::Transparent)
    Draw-Centered $fg.G $logo ($size*2.25) ($size*2.25) 0.55
    $fgOut = "android\app\src\main\res\mipmap-$d\ic_launcher_foreground.png"
    $fg.Bmp.Save($fgOut, [System.Drawing.Imaging.ImageFormat]::Png)
    $fg.G.Dispose(); $fg.Bmp.Dispose()
}

# Splash screens (port y land)
$splashFiles = Get-ChildItem android\app\src\main\res -Recurse -Filter splash.png
foreach ($sf in $splashFiles) {
    $img = [System.Drawing.Image]::FromFile($sf.FullName)
    $w = $img.Width; $h = $img.Height
    $img.Dispose()
    $c = New-Canvas $w $h $blue
    Draw-Centered $c.G $logo $w $h 0.35
    $c.Bmp.Save($sf.FullName, [System.Drawing.Imaging.ImageFormat]::Png)
    $c.G.Dispose(); $c.Bmp.Dispose()
}

# ic_launcher_background vector -> azul solido
$bgXml = @'
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportHeight="108"
    android:viewportWidth="108">
    <path android:fillColor="#2563EB" android:pathData="M0,0h108v108h-108z" />
</vector>
'@
Set-Content -Path 'android\app\src\main\res\drawable\ic_launcher_background.xml' -Value $bgXml -Encoding UTF8

# color resource
Set-Content -Path 'android\app\src\main\res\values\ic_launcher_background.xml' -Value '<?xml version="1.0" encoding="utf-8"?><resources><color name="ic_launcher_background">#2563EB</color></resources>' -Encoding UTF8

$logo.Dispose()
Write-Host "ICONOS_Y_SPLASH_OK"
