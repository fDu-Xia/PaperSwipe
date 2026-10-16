# Create a source archive and its matching Linux deployment script. No upload.
[CmdletBinding()]
param([string]$OutputDirectory)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Write-LinuxText([string]$Path, [string]$Text) {
    [System.IO.File]::WriteAllText($Path, ($Text -replace "`r`n", "`n"), $utf8NoBom)
}

Push-Location $repoRoot
try {
    foreach ($command in @('go', 'node', 'tar')) {
        if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
            throw "Required command not found: $command. Nothing was uploaded."
        }
    }
    foreach ($required in @('go.mod', 'Dockerfile', '.dockerignore', 'web/login.html', 'deploy/release-server.sh')) {
        if (-not (Test-Path -LiteralPath $required -PathType Leaf)) {
            throw "Missing required file: $required"
        }
    }

    Write-Host '[1/3] Checking Go and JavaScript...'
    & go test ./...
    if ($LASTEXITCODE -ne 0) { throw 'Go tests failed. Release not created.' }
    & go vet ./...
    if ($LASTEXITCODE -ne 0) { throw 'Go vet failed. Release not created.' }
    foreach ($js in (Get-ChildItem -LiteralPath web -Filter '*.js' -File -Recurse)) {
        & node --check $js.FullName
        if ($LASTEXITCODE -ne 0) { throw "JavaScript check failed: $($js.Name)" }
    }

    if (-not $OutputDirectory) {
        $desktop = [Environment]::GetFolderPath('Desktop')
        if (-not $desktop) { $desktop = [Environment]::GetFolderPath('MyDocuments') }
        $OutputDirectory = Join-Path $desktop 'PaperSwipe-Releases'
    }
    $stamp = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + ([guid]::NewGuid().ToString('N').Substring(0, 6))
    $bundleDir = Join-Path $OutputDirectory $stamp
    $null = New-Item -ItemType Directory -Path $bundleDir
    $bundleDir = (Resolve-Path -LiteralPath $bundleDir).Path
    $archiveName = "paperswipe-update-$stamp.tar.gz"
    $scriptName = "deploy-$stamp.sh"
    $archivePath = Join-Path $bundleDir $archiveName
    $releaseFiles = @('go.mod', 'Dockerfile', '.dockerignore', 'web') + @(Get-ChildItem -File -Filter '*.go' | ForEach-Object { $_.Name })
    if (Test-Path -LiteralPath 'go.sum') { $releaseFiles += 'go.sum' }

    Write-Host '[2/3] Packing current saved source files...'
    & tar -czf $archivePath @releaseFiles
    if ($LASTEXITCODE -ne 0) { throw 'Archive creation failed. Do not upload this folder.' }
    $sha = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
    $template = [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot 'release-server.sh'))
    # Positional arguments bind this script to exactly one archive and checksum.
    $boundScript = "#!/usr/bin/env bash`nset -- '$archiveName' '$sha'`n" + $template
    Write-LinuxText (Join-Path $bundleDir $scriptName) $boundScript
    Write-LinuxText (Join-Path $bundleDir 'SHA256.txt') "$sha  $archiveName`n"
    $instructions = @"
Upload ONLY these two matching files to /opt/paperswipe-beta/:
$archiveName
$scriptName

In the SERVER Linux terminal, execute one line at a time:
cd /opt/paperswipe-beta
bash $scriptName

Wait for DEPLOYMENT SUCCESS. No yes prompt is required.
If UPDATE STOPPED appears, do not repeat blindly; read the log and manual.
Manual in the source project: deploy/UPDATE_FROM_WINDOWS.md
Preview: https://paperswipe.site/login

This package contains saved working-tree source, including uncommitted files.
It does not contain server secrets, user data, Compose config, or Android builds.
Archive SHA256: $sha
"@
    Write-LinuxText (Join-Path $bundleDir 'START-HERE.txt') ($instructions + "`n")
    Write-Host '[3/3] PACKAGE READY (not uploaded or deployed).'
    Write-Host "Folder: $bundleDir"
    Write-Host "Upload: $archiveName"
    Write-Host "Upload: $scriptName"
    Write-Host 'Server commands:'
    Write-Host 'cd /opt/paperswipe-beta'
    Write-Host "bash $scriptName"
} finally {
    Pop-Location
}
