# 从 Windows 更新 paperswipe.site（现有 Docker 部署）

适用于此前截图中的部署：目录 `/opt/paperswipe-beta`，项目名 `paperswipe-beta`，配置 `compose.public.yaml`，容器 `paperswipe-beta-app-1`。**这些是历史截图信息，不是当前服务器检查结果；第一步检查不匹配就先停止，不要猜路径。**

本轮仅准备本地代码与操作指南，没有上传、重启或更新服务器。网页与后端可按下文一起更新；已安装的 Android App 内置前端，需要另外重新构建、签名并安装新版 APK，不会仅靠更新服务器而更新。

## 1. 提交前检查（Windows）

在 GitHub Desktop 中检查改动，提交需要的源码、测试、文档与 Android 项目。当前 `data/state.json` 是已被 Git 跟踪的本地运行数据，本次不要勾选它；不要提交 `.env.local`、`.env.beta`、邀请码、密钥、签名文件、APK、备份或上传压缩包。仅增加 `.gitignore` 不会自动取消跟踪已有数据。

本轮新增的 `library.go`、`library_test.go`、`web/paper-text.js` 及前几轮新增的 `.go` / `web/*.js` 文件都需要提交。不要只提交 `app.js`，否则删除接口与共享模块会缺失。提交后再 Push；Push 本身不会部署这台服务器。

## 2. 打包最新本地源码（Windows PowerShell）

下面使用源码白名单，包含未提交的新 `.go` 文件；不包含数据、环境配置、邀请码、Android 产物。压缩包放在系统临时目录，避免误提交。

```powershell
Set-Location 'C:\Users\Administrator\Documents\GitHub\PaperSwipe'
$releaseName = 'paperswipe-update-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
$releaseArchive = Join-Path $env:TEMP ($releaseName + '.tar.gz')
$releaseFiles = @('go.mod', 'Dockerfile', '.dockerignore', 'web') + @(Get-ChildItem -File -Filter '*.go' | ForEach-Object { $_.Name })
if (Test-Path 'go.sum') { $releaseFiles += 'go.sum' }
if (Test-Path -LiteralPath $releaseArchive) { throw '压缩包已存在，请重新生成版本名。' }
tar -czf $releaseArchive @releaseFiles
if ($LASTEXITCODE -ne 0) { throw '打包失败，停止上传。' }
Get-FileHash -Algorithm SHA256 -LiteralPath $releaseArchive
Write-Output $releaseArchive
```

通过腾讯云终端的文件上传功能，将这个文件上传到 `/opt/paperswipe-beta/`。保存本地输出的 SHA256。不要把整个仓库连同数据、环境文件压缩上传。

## 3. 检查现有服务器（Linux 终端）

```sh
cd /opt/paperswipe-beta
ls -l compose.public.yaml deploy/Caddyfile
docker compose -p paperswipe-beta -f compose.public.yaml ps
docker inspect paperswipe-beta-app-1 --format 'Image={{.Config.Image}} ID={{.Image}}'
docker inspect paperswipe-beta-app-1 --format '{{range .Mounts}}{{println .Name .Destination}}{{end}}'
grep -n 'image:.*paperswipe-beta' compose.public.yaml
```

应确认：应用容器存在；`/app/data` 使用现有 `paperswipe-beta_app_data` 卷；应用镜像一行支持 `paperswipe-beta:${RELEASE_TAG:-local}`。如果是硬编码旧镜像名、其他项目名或其他卷，先调整发布方案，不要继续。

## 4. 构建、备份、切换（Linux 终端）

把下面第一行的文件名替换成实际上传文件名；其余作为一整块执行。此过程会短暂停止应用以备份数据，建议提前通知内测用户。**确认本地和服务器 SHA256 一致后再输入 `yes`。**

新源码保存在独立 `releases/<版本号>` 目录，并明确从该目录构建；不覆盖旧目录的源码和服务器配置。后续也应从对应 release 目录构建，不要回旧根目录执行默认 build。

```sh
(
set -eu
cd /opt/paperswipe-beta
archive='替换为实际上传文件名.tar.gz'
test -f "$archive"
test -f .env.beta
test -f compose.public.yaml
sha256sum "$archive"
printf '与 Windows 的 SHA256 一致？确认后输入 yes: '
read -r verified
test "$verified" = yes

umask 077
tag="beta-$(date -u +%Y%m%d-%H%M%S)"
release_dir="/opt/paperswipe-beta/releases/$tag"
backup_dir="/opt/paperswipe-beta/backups/$tag"
mkdir -p /opt/paperswipe-beta/releases /opt/paperswipe-beta/backups
mkdir "$release_dir" "$backup_dir"

# 仅解压自己生成、校验一致的源码包。
tar -xzf "$archive" -C "$release_dir"
test -f "$release_dir/library.go"
test -f "$release_dir/web/paper-text.js"
old_id=$(docker inspect paperswipe-beta-app-1 --format '{{.Image}}')
rollback="rollback-$tag"
docker image tag "$old_id" "paperswipe-beta:$rollback"
cp -p .env.beta compose.public.yaml "$backup_dir/"
cp -p deploy/Caddyfile "$backup_dir/Caddyfile"
printf 'RELEASE_TAG=%s\nROLLBACK_TAG=%s\nOLD_IMAGE_ID=%s\n' "$tag" "$rollback" "$old_id" > "$backup_dir/release.txt"

# 先构建成功再停止旧应用，构建失败不会中断现有服务。
docker build -t "paperswipe-beta:$tag" "$release_dir"
export RELEASE_TAG="$tag"
docker compose -p paperswipe-beta -f compose.public.yaml config -q
docker compose -p paperswipe-beta -f compose.public.yaml config --images

# 停止写入后完整备份现有用户卷，失败也尽力启动原应用。
trap 'docker compose -p paperswipe-beta -f compose.public.yaml start app' EXIT
docker compose -p paperswipe-beta -f compose.public.yaml stop app
docker compose -p paperswipe-beta -f compose.public.yaml cp -a app:/app/data "$backup_dir/data"
docker compose -p paperswipe-beta -f compose.public.yaml start app
trap - EXIT

# 此处 --no-build 使用的是刚刚明确构建的新 tag，而不是旧 local 镜像。
docker compose -p paperswipe-beta -f compose.public.yaml up -d --no-deps --no-build --force-recreate --wait --wait-timeout 120 app
expected=$(docker image inspect "paperswipe-beta:$tag" --format '{{.Id}}')
actual=$(docker inspect paperswipe-beta-app-1 --format '{{.Image}}')
test "$actual" = "$expected"
docker compose -p paperswipe-beta -f compose.public.yaml ps
docker exec paperswipe-beta-app-1 wget -q -O - http://127.0.0.1:8080/api/health
printf '\n新版本：%s\n备份目录：%s\n回滚标签：%s\n' "$tag" "$backup_dir" "$rollback"
)
```

任何一行报错就停止，不要继续“试着多点几次”。若停在启动或健康检查阶段，保存输出，检查日志并按下方回滚。日志不要公开粘贴邀请码、密钥或私人搜索内容。

`export RELEASE_TAG` 只在本次发布块里有效。**以后重建容器必须再次明确指定正确版本号**，不能直接运行无标签的 `up`，否则配置可能退回旧 `local` 镜像。查版本：`docker inspect paperswipe-beta-app-1 --format '{{.Config.Image}}'`。对应源码、配置和回滚标签记录在本次 release / backup 目录。

## 5. 验收

- 打开 `https://paperswipe.site/`，电脑按 Ctrl+Shift+R；手机关闭页面后重开。重启应用会清除内存会话，可能需要重新输入个人邀请码，收藏应保留。
- 先用自己的测试账号检查搜索、语言切换、卡片翻面及学科栏横滑。
- 在文献库检查全选 → 取消全选。只用可丢弃的测试收藏验证删除、取消确认、刷新后不再出现，以及对应日程消失；不要拿其他人的文献测试。
- 检查页面是否还显示原样 `\textbf{…}`。浏览器 UI 与服务端应一起更新。
- 健康检查通过只说明应用进程可响应，不代表模型、论文源、网络或真实手机均已验收。

如果仍是旧页面，先比对运行镜像 ID，不要首先反复清缓存；本项目前端嵌入 Go 二进制，只上传 `web/` 或只重启旧镜像不会替换程序。

## 6. 回滚

从上一步输出或 `backups/<版本号>/release.txt` 找到 `ROLLBACK_TAG`，将下面占位符替换为其完整值；不覆盖或还原数据卷。

```sh
cd /opt/paperswipe-beta
RELEASE_TAG='替换为完整回滚标签' docker compose -p paperswipe-beta -f compose.public.yaml up -d --no-deps --no-build --force-recreate --wait --wait-timeout 120 app
docker inspect paperswipe-beta-app-1 --format 'Image={{.Config.Image}} ID={{.Image}}'
```

旧版程序可能不认识新日程字段并在后续写入时丢弃它们，因此回滚不是数据恢复。保留完整数据备份，需要恢复数据时应另行停服核对，不要直接覆盖生产用户数据。

始终保留当前版本与至少一个可用回滚镜像，以及配置和用户数据备份。**不要执行 `docker compose down -v`，不要删除 `app_data`、Caddy 证书卷或 `.env.beta`。** 备份含账号数据与密钥，不要提交或公开分享，另做加密异地备份。

Docker 官方说明：[源码变更后重新构建](https://docs.docker.com/reference/cli/docker/compose/build/)；[使用 up 重建容器并保留挂载卷](https://docs.docker.com/reference/cli/docker/compose/up/)。
