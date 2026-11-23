$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$root = 'C:\Users\Angel\AppData\Local\BusyaBuild'
$sdk  = Join-Path $root 'Sdk'
$jdk  = Join-Path $root 'jdk17'
New-Item -ItemType Directory -Force -Path $root, $sdk | Out-Null

if (-not (Test-Path (Join-Path $jdk 'bin\java.exe'))) {
    Write-Host 'Descargando JDK 17...'
    $zip = Join-Path $root 'jdk17.zip'
    Invoke-WebRequest -Uri 'https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse?project=jdk' -OutFile $zip -TimeoutSec 600
    Write-Host 'Extrayendo JDK 17...'
    Expand-Archive $zip -DestinationPath $root -Force
    $extracted = Get-ChildItem $root -Directory | Where-Object { $_.Name -like 'jdk-17*' } | Select-Object -First 1
    if (-not $extracted) { throw 'No se encontro la carpeta del JDK extraido.' }
    if (Test-Path $jdk) { Remove-Item $jdk -Recurse -Force }
    Rename-Item $extracted.FullName 'jdk17'
    Remove-Item $zip -Force -ErrorAction SilentlyContinue
}

$env:JAVA_HOME = $jdk
$env:Path = "$jdk\bin;$env:Path"
Write-Host "JAVA_HOME=$jdk"

$sdkmanager = Join-Path $sdk 'cmdline-tools\latest\bin\sdkmanager.bat'
if (-not (Test-Path $sdkmanager)) {
    Write-Host 'Descargando Android command-line tools...'
    $cmdZip = Join-Path $root 'cmdline-tools.zip'
    Invoke-WebRequest -Uri 'https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip' -OutFile $cmdZip -TimeoutSec 600
    $tmp = Join-Path $root 'cmdline-tmp'
    if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
    Expand-Archive $cmdZip -DestinationPath $tmp -Force
    New-Item -ItemType Directory -Force -Path (Join-Path $sdk 'cmdline-tools') | Out-Null
    $latest = Join-Path $sdk 'cmdline-tools\latest'
    if (Test-Path $latest) { Remove-Item $latest -Recurse -Force }
    Move-Item (Join-Path $tmp 'cmdline-tools') $latest
    Remove-Item $cmdZip -Force -ErrorAction SilentlyContinue
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host 'Aceptando licencias del Android SDK...'
$yes = ("y`n" * 40)
$yes | & $sdkmanager --licenses

Write-Host 'Instalando platform-tools, android-34 y build-tools 34.0.0...'
& $sdkmanager 'platform-tools' 'platforms;android-34' 'build-tools;34.0.0'

Write-Host "SETUP_OK"
Write-Host "JAVA_HOME=$jdk"
Write-Host "ANDROID_HOME=$sdk"
