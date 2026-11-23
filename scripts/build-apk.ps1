$ErrorActionPreference = 'Stop'
$env:JAVA_HOME = 'C:\Users\Angel\AppData\Local\BusyaBuild\jdk17'
$env:ANDROID_HOME = 'C:\Users\Angel\AppData\Local\BusyaBuild\Sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:Path"

Set-Location 'C:\Users\Angel\Desktop\Proyectos\detras_busya v15\android'
Write-Host "JAVA_HOME=$env:JAVA_HOME"
Write-Host "ANDROID_HOME=$env:ANDROID_HOME"
java -version

# local.properties
$lp = 'C:\Users\Angel\Desktop\Proyectos\detras_busya v15\android\local.properties'
"sdk.dir=$($env:ANDROID_HOME -replace '\\','\\\\')" | Set-Content -Path $lp -Encoding ASCII

Write-Host "Building debug APK..."
.\gradlew.bat assembleDebug --no-daemon 2>&1 | Tee-Object -FilePath 'C:\Users\Angel\Desktop\Proyectos\detras_busya v15\android\build.log'
Write-Host "BUILD_EXIT=$LASTEXITCODE"
