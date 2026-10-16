<## Snapshot tracked and untracked source before local reorganization.
Ignored secrets, dependencies and generated releases stay in their original locations.
The backup is local-only; do not publish it (tracked data may contain private state).
##>
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$backup = Join-Path $repo ('backups/source-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
Push-Location $repo
try {
    $files = @(git -c core.quotepath=false ls-files --cached --others --exclude-standard)
    if ($LASTEXITCODE -ne 0) { throw 'Unable to list source files.' }
    New-Item -ItemType Directory -Path $backup | Out-Null
    $manifest = foreach ($relative in ($files | Sort-Object -Unique)) {
        $source = Join-Path $repo $relative
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { continue }
        $destination = Join-Path (Join-Path $backup 'source') $relative
        New-Item -ItemType Directory -Force -Path (Split-Path $destination) | Out-Null
        Copy-Item -LiteralPath $source -Destination $destination
        $before = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
        $after = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash
        if ($before -ne $after) { throw "Backup verification failed: $relative" }
        [pscustomobject]@{ Path = $relative; SHA256 = $after }
    }
    $manifest | Export-Csv -LiteralPath (Join-Path $backup 'manifest.csv') -NoTypeInformation -Encoding utf8
    git status --short | Out-File -LiteralPath (Join-Path $backup 'git-status.txt') -Encoding utf8
    git diff --binary | Out-File -LiteralPath (Join-Path $backup 'working-tree.patch') -Encoding utf8
    git diff --cached --binary | Out-File -LiteralPath (Join-Path $backup 'index.patch') -Encoding utf8
    Write-Output "Verified $($manifest.Count) files. Local backup: $backup"
} finally {
    Pop-Location
}
