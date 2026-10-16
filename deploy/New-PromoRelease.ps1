param([string]$OutputDirectory)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$marketingRoot = Join-Path $repoRoot 'marketing'
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $repoRoot 'release\promo' }
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
$releaseName = 'paperswipe-promo-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
$packageRoot = Join-Path $OutputDirectory $releaseName
if (Test-Path -LiteralPath $packageRoot) { throw 'A release with this timestamp already exists.' }
$assets = @(
    'site.css', 'site.js', 'logo.png', 'explore.png', 'explore-back.png',
    'library.png', 'schedule.png', 'calendar.png', 'settings.png', 'login.png',
    'reading-editorial.png', 'trending-user-20261015.png',
    'product-demo-20261015.mp4', 'video-poster.jpg'
)
foreach ($asset in $assets) {
    if (-not (Test-Path -LiteralPath (Join-Path $marketingRoot "paperswipe-assets\$asset") -PathType Leaf)) {
        throw "Missing public asset: $asset"
    }
}
$html = Get-Content -LiteralPath (Join-Path $marketingRoot 'index.html') -Raw
if (-not $html.Contains('粤ICP备2026152562号-1')) { throw 'The verified website ICP number is missing.' }
$assetTarget = Join-Path $packageRoot 'site\paperswipe-assets'
New-Item -ItemType Directory -Path $assetTarget -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $marketingRoot 'index.html') -Destination (Join-Path $packageRoot 'site\index.html')
foreach ($asset in $assets) {
    Copy-Item -LiteralPath (Join-Path $marketingRoot "paperswipe-assets\$asset") -Destination (Join-Path $assetTarget $asset)
}
$utf8 = [Text.UTF8Encoding]::new($false)
$serverScript = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'publish-promo.sh')).Replace("`r`n", "`n")
[IO.File]::WriteAllText((Join-Path $packageRoot 'publish.sh'), $serverScript, $utf8)
$publicNames = @('site/index.html') + @($assets | ForEach-Object { 'site/paperswipe-assets/' + $_ })
$manifest = foreach ($name in $publicNames) {
    $digest = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $packageRoot $name)).Hash.ToLowerInvariant()
    "$digest  $name"
}
[IO.File]::WriteAllText((Join-Path $packageRoot 'SHA256SUMS'), (($manifest -join "`n") + "`n"), $utf8)
$archive = Join-Path $OutputDirectory ($releaseName + '.tar.gz')
& tar -czf $archive -C $OutputDirectory $releaseName
if ($LASTEXITCODE -ne 0) { throw 'Archive creation failed.' }
$members = & tar -tzf $archive
if ($LASTEXITCODE -ne 0 -or ($members | Where-Object { -not $_.StartsWith("$releaseName/") })) {
    throw 'Archive verification failed.'
}
$archiveHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash.ToLowerInvariant()
$readme = @"
PaperSwipe 腾讯云宣传页发布

这是新版公开宣传页，不是 App 程序更新。包含用户的新视频、P2 趋势截图和备案链接。

1. 腾讯云 DNSPod → paperswipe.site → 添加记录：
   主机记录 intro；类型 A；线路默认；记录值 118.89.156.215；TTL 默认。
   不要修改 @、www、其他记录或域名 DNS 服务器；intro 若已存在先检查，不重复添加。

2. 上传 $releaseName.tar.gz 到服务器 /opt/paperswipe-beta/。
   不要上传整个仓库、.env.beta、其他平台的账号配置或用户数据。

3. 在腾讯云服务器终端完整粘贴以下命令：

cd /opt/paperswipe-beta && printf '%s  %s\n' '$archiveHash' '$releaseName.tar.gz' | sha256sum -c - && tar -xzf '$releaseName.tar.gz' && bash '$releaseName/publish.sh'

看到 PROMO DEPLOYMENT SUCCESS 后，打开 https://intro.paperswipe.site/。
初次发布会短暂重建网站代理，已有网站入口可能短暂中断；不会重启 app、换 App 镜像、修改邀请码或删除用户数据。
脚本会先验证 DNS、文件完整性、当前镜像与配置，再备份配置；激活失败会尝试恢复，并报告回滚是否正常。
如果 STOP / DEPLOYMENT STOPPED / ROLLBACK NEEDS ATTENTION，停止重复操作，把输出截图发给维护者。
HTTPS 检查在服务器上完成；上线后仍需在手机 Wi-Fi、移动网络及微信中实际访问验收。

旧的宣传页压缩包可保留。本次请仅使用这个文件名及配套命令。
备份和历史版本留在服务器，不自动删除。
备案号：粤ICP备2026152562号-1，来源为用户确认的腾讯云备案截图。
SHA256: $archiveHash
"@
$instructions = Join-Path $OutputDirectory ($releaseName + '-使用步骤.txt')
[IO.File]::WriteAllText($instructions, $readme.Replace("`r`n", "`n"), $utf8)
Write-Output "PACKAGE READY: $archive"
Write-Output "INSTRUCTIONS: $instructions"
Write-Output "SHA256: $archiveHash"
