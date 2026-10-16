param(
    [string]$JdkDirectory = '',
    [string]$SdkDirectory = '',
    [string]$OutputDirectory = ''
)

# Local test APK only: no production deployment, account access or release signing.
$ErrorActionPreference = 'Stop'
$appRoot = $PSScriptRoot
if (-not $SdkDirectory) { $SdkDirectory = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
if (-not $OutputDirectory) { $OutputDirectory = Join-Path (Split-Path $appRoot -Parent) 'release\android' }
if (-not $JdkDirectory) {
    $candidates = @($env:JAVA_HOME)
    foreach ($parent in @('C:\Program Files\Java', 'C:\Program Files\Microsoft')) {
        if (Test-Path -LiteralPath $parent) {
            $candidates += @(Get-ChildItem -LiteralPath $parent -Directory | Where-Object Name -Like '*21*' | Select-Object -ExpandProperty FullName)
        }
    }
    foreach ($candidate in $candidates) {
        if (-not $candidate) { continue }
        $release = Join-Path $candidate 'release'
        if ((Test-Path -LiteralPath $release) -and ((Get-Content -Raw -LiteralPath $release) -match 'JAVA_VERSION="21[."]')) {
            $JdkDirectory = $candidate
            break
        }
    }
}
if (-not $JdkDirectory -or -not (Test-Path -LiteralPath (Join-Path $JdkDirectory 'bin\javac.exe'))) {
    throw 'JDK 21 not found. Pass -JdkDirectory with your JDK 21 folder.'
}
if (-not (Test-Path -LiteralPath (Join-Path $SdkDirectory 'platforms\android-36\android.jar'))) {
    throw 'Android SDK Platform 36 not found. Pass -SdkDirectory with your Android SDK folder.'
}
$savedJava = $env:JAVA_HOME
$savedSdk = $env:ANDROID_HOME
$savedOptions = $env:JAVA_TOOL_OPTIONS
try {
    $env:JAVA_HOME = $JdkDirectory
    $env:ANDROID_HOME = $SdkDirectory
    # A normal, short local directory avoids Windows/MSIX Unix socket temp-path issues.
    $appTemp = Join-Path $env:USERPROFILE '.gradle\paperswipe-tmp'
    New-Item -ItemType Directory -Force -Path $appTemp | Out-Null
    $javaTemp = $appTemp.Replace('\', '/')
    $env:JAVA_TOOL_OPTIONS = "$savedOptions -Djdk.net.unixdomain.tmpdir=`"$javaTemp`" -Djava.io.tmpdir=`"$javaTemp`""
    Push-Location $appRoot
    try {
        & npm.cmd ci
        if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
        & npm.cmd run doctor
        if ($LASTEXITCODE -ne 0) { throw 'Build environment check failed.' }
        & npm.cmd run sync:android
        if ($LASTEXITCODE -ne 0) { throw 'Latest UI synchronization failed.' }
        Push-Location (Join-Path $appRoot 'android')
        try {
            & .\gradlew.bat assembleDebug --no-daemon --console=plain
            if ($LASTEXITCODE -ne 0) { throw 'Android build failed. No new APK was exported.' }
        } finally { Pop-Location }
    } finally { Pop-Location }
    $apk = Join-Path $appRoot 'android\app\build\outputs\apk\debug\app-debug.apk'
    $buildTools = Get-ChildItem -LiteralPath (Join-Path $SdkDirectory 'build-tools') -Directory |
        Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'apksigner.bat') } |
        Sort-Object Name -Descending | Select-Object -First 1
    if (-not $buildTools) { throw 'Android apksigner was not found.' }
    & (Join-Path $buildTools.FullName 'apksigner.bat') verify $apk
    if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed.' }
    New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
    $destination = Join-Path $OutputDirectory ('PaperSwipe-android-debug-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.apk')
    Copy-Item -LiteralPath $apk -Destination $destination
    Write-Output "APK: $destination"
    Get-FileHash -LiteralPath $destination -Algorithm SHA256 | Format-List
    Write-Output 'Local test build only. Server mobile login must be enabled separately; no server was changed.'
} finally {
    $env:JAVA_HOME = $savedJava
    $env:ANDROID_HOME = $savedSdk
    $env:JAVA_TOOL_OPTIONS = $savedOptions
}
