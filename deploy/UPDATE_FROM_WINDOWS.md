# PaperSwipe 服务器部署说明书

适用：Windows 本地开发 → 腾讯云 Linux → Docker Compose → [paperswipe.site](https://paperswipe.site)

维护日期：2026-10-15

这是一份可反复使用的“已有网站更新手册”，不是新服务器从零安装教程。它会发布整个网页与 Go 后端，包含新版邀请码页面。本文和配套脚本只保存在本地，不代表服务器已经更新。

---

## 目录

1. 每次更新速查
2. 先认清在哪个窗口操作
3. 适用条件与不能动的东西
4. 第一次使用前准备
5. 每次更新的完整步骤
6. 更新成功后怎么验收
7. 重启、重新创建、更新有什么区别
8. 更新失败如何回滚
9. 常见报错与处理
10. 备份、旧压缩包和磁盘清理
11. GitHub、邀请码、API 配额与 App
12. 发布记录与技术说明

## 1. 每次更新速查

以后通常只需要完成下面四件事：

| 顺序 | 在哪里 | 做什么 |
| --- | --- | --- |
| 1 | Windows PowerShell | 运行打包工具，等待 PACKAGE READY |
| 2 | 腾讯云文件上传 | 上传同一个新生成文件夹内的压缩包和发布脚本 |
| 3 | Linux 服务器终端 | 进入部署目录，运行生成的那条 bash 命令 |
| 4 | 浏览器 | 用无痕窗口检查登录、已有数据和新功能 |

固定的本地打包命令：

```powershell
Set-Location 'C:\Users\Administrator\Documents\GitHub\PaperSwipe'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\deploy\New-Release.ps1
```

成功后会显示本次的文件夹位置、两个要上传的文件名和服务器执行命令。也会生成一份 `START-HERE.txt`，直接从里面复制本次命令。

**不要拿上次的命令、上次的压缩包或 `update-20261014.sh` 来更新下一版。**那个日期固定的脚本只适用于当时的压缩包。以后的新版统一使用本手册的打包工具。

## 2. 先认清在哪个窗口操作

### 电脑上的 Windows PowerShell

常见提示符：

```text
PS C:\Users\Administrator\Documents\GitHub\PaperSwipe>
```

用于：检查本地代码、运行打包工具、找生成的文件。

不要在这里运行服务器的 `cd /opt/paperswipe-beta`。

### 腾讯云里的 Linux 终端

常见提示符：

```text
[root@VM-0-4-opencloudos paperswipe-beta]#
```

用于：检查线上服务、运行上传的发布脚本、查看日志与回滚。

不要把 Windows 的 `C:\Users\...` 路径粘贴到这里。

### 浏览器地址栏

用于检查网站，正式邀请码页面是：

https://paperswipe.site/login

`C:/Users/.../web/login.html` 是本机文件，不是线上网站。直接双击网页文件可能导致图片和语言脚本无法加载，也不能验证服务端邀请码登录。

### 命令输入规则

- 只复制代码框内容，不复制 `PS ...>`、`[root@...]#` 或 Markdown 的三个反引号。
- 每行短命令粘贴完按回车；长命令视觉上折行不等于需要手动换行。
- 不要把 `--force-recreate` 拆成两个词。
- 光标后出现的灰色字可能只是终端建议，不代表命令已执行。
- 若当前输入已经乱了，且没有正在进行的部署，按 Ctrl+C 清掉当前输入，再重新输入短命令。
- 发布脚本已经运行时，不要随意 Ctrl+C 或关闭连接。中途断开后先检查状态，不要盲目重复运行。

## 3. 适用条件与不能动的东西

根据你提供的服务器截图，现有部署约定如下。脚本执行时还会做必要检查，但这里不是实时服务器状态。

| 项目 | 当前约定 |
| --- | --- |
| 本地项目 | `C:\Users\Administrator\Documents\GitHub\PaperSwipe` |
| 服务器目录 | `/opt/paperswipe-beta` |
| Compose 项目名 | `paperswipe-beta` |
| 服务器 Compose 文件 | `compose.public.yaml` |
| 应用服务 / 容器 | `app` / `paperswipe-beta-app-1` |
| 代理服务 / 容器 | `proxy` / `paperswipe-beta-proxy-1` |
| 用户数据卷 | `paperswipe-beta_app_data`，挂载到 `/app/data` |
| 服务器环境配置 | `.env.beta` |
| HTTPS 代理配置 | `deploy/Caddyfile` |
| 镜像名称 | `paperswipe-beta:<版本号>` |

服务器镜像配置必须支持 `RELEASE_TAG`，例如：

```yaml
image: paperswipe-beta:${RELEASE_TAG:-beta-20261013-v2}
```

默认值是旧版本或 `local` 都不影响脚本显式指定新版；但会影响不带版本号的手工重建，详见第 7 节。

### 本流程会更新

- Go 后端，以及嵌入程序中的整个 `web/`。
- 邀请码页面、图片资源、语言脚本、主页面。
- 应用镜像与应用容器。

### 本流程不会覆盖

- 服务器的 `.env.beta`：API Key、邀请码和其他配置。
- 现有用户数据卷：文献库、日程等。
- 服务器的 `compose.public.yaml` 和 `deploy/Caddyfile`。
- Caddy 的证书与配置卷。
- GitHub 仓库、DNS、云防火墙或已安装的手机 App。

**永远不要为了“更新”执行 `docker compose down -v`，也不要删除 `app_data`、Caddy 卷或用本地 `data/` 覆盖线上数据。**

如果改了 Compose、环境变量、数据库存储结构、Docker 构建目录或增加了新的服务，这就不再是纯源码常规发布。先制定相应配置/迁移步骤，不能指望本工具自动处理。

## 4. 第一次使用前准备

### 4.1 本地需要哪些文件和工具

项目里应有：

```text
deploy/
  New-Release.ps1          Windows 打包工具
  release-server.sh        通用 Linux 发布模板
  UPDATE_FROM_WINDOWS.md  本说明书
```

在 Windows PowerShell 检查：

```powershell
go version
node --version
tar --version
```

三个命令都应能输出版本。工具缺失时先安装对应工具并重新打开 PowerShell。Go 版本应满足项目 `go.mod`；本地 Node 用于语法检查。Windows 不需要安装 Docker，镜像是在服务器上构建的。

打包命令中的 `-ExecutionPolicy Bypass` 只作用于此次 PowerShell 子进程，不会永久修改全局执行策略。只对你确认可信的项目脚本这样执行。

### 4.2 服务器首次检查

在 Linux 终端逐行执行：

```bash
cd /opt/paperswipe-beta
ls -l compose.public.yaml deploy/Caddyfile
docker compose version
docker compose -p paperswipe-beta -f compose.public.yaml ps
docker inspect paperswipe-beta-app-1 --format 'Image={{.Config.Image}} Status={{.State.Status}}'
docker inspect paperswipe-beta-app-1 --format '{{range .Mounts}}{{println .Type .Name .Destination}}{{end}}'
grep -n 'image:.*paperswipe-beta' compose.public.yaml
command -v flock
df -h /opt/paperswipe-beta /var/lib/docker
docker system df
```

确认：

- app 与 proxy 存在，app 通常显示 healthy。
- 数据挂载包含 `volume paperswipe-beta_app_data /app/data`。
- 应用 image 使用上述 `RELEASE_TAG` 插值，而不是写死一个旧镜像。
- `flock` 有路径输出；它用于防止两个发布脚本同时执行。
- Docker Compose 支持 `--wait`、`--wait-timeout` 和 `cp -a`。
- 磁盘有足够空间容纳新镜像、构建缓存、源码和一份完整数据备份。压缩包只有几 MB 不代表发布只需几 MB。

不要粘贴完整 `.env.beta` 或无参数的 `docker compose config` 到群里，它们可能暴露密钥。截图分享前也检查日志里的私人数据。

## 5. 每次更新的完整步骤

### 第一步：保存代码，确认更新范围【Windows】

1. 在编辑器里保存所有改动。
2. 本地体验本次修改的功能，特别是手机端布局和中文/英文。
3. 推荐先提交正确的源码到 Git，以便以后追踪版本，但 Push 不是部署。
4. 不要提交 API Key、邀请码列表、`.env.beta`、备份、签名文件或本地运行数据。目前 `data/state.json` 已被跟踪，单纯写进 `.gitignore` 不能使它自动不再被跟踪。

打包工具取的是**当前已保存的工作目录**，包括未提交的新文件，不是自动从 GitHub 拉取。因此必须自己确认这就是要发布的版本。

### 第二步：运行打包工具【Windows】

```powershell
Set-Location 'C:\Users\Administrator\Documents\GitHub\PaperSwipe'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\deploy\New-Release.ps1
```

工具会：

1. 运行 Go 测试与检查，以及 `web/` 中 JavaScript 文件的语法检查。
2. 打包根目录的 Go 源码、`go.mod`、存在时的 `go.sum`、Dockerfile、.dockerignore 和整个 `web/`。
3. 计算压缩包 SHA256。
4. 自动生成绑定该文件名与 SHA256 的发布脚本，使用 Linux 换行。
5. 显示输出位置和本次要执行的服务器命令。

默认输出到 Windows 桌面下的 `PaperSwipe-Releases`，每次一个独立文件夹。若系统桌面被重定向到 OneDrive，以命令输出的真实路径为准。

示例结构（数字只是示例）：

```text
PaperSwipe-Releases/
  20261015-120000-a1b2c3/
    paperswipe-update-20261015-120000-a1b2c3.tar.gz
    deploy-20261015-120000-a1b2c3.sh
    SHA256.txt
    START-HERE.txt
```

看到 `PACKAGE READY` 才算打包成功。失败时不要上传半成品。

不需要手改文件名或校验码。生成后若又改了源代码，必须重新打包。不要修改已生成的压缩包，否则校验会失败。

测试通过不等于真实手机、AI 服务和生产环境已经验收；打包工具不替代第 6 节的人工检查。

### 第三步：上传两个配套文件【腾讯云】

通过腾讯云终端的文件上传功能，将同一个输出文件夹内的：

- `paperswipe-update-....tar.gz`
- `deploy-....sh`

上传到：

```text
/opt/paperswipe-beta/
```

`SHA256.txt` 留作本地核对，`START-HERE.txt` 用于复制命令，不必上传。

不要只上传压缩包，也不要混用不同文件夹里的脚本。不要上传整个仓库来覆盖服务器目录。

若上传工具默认放到别处，应在工具中选对目标目录；不要凭感觉去执行找不到的文件。

### 第四步：执行发布【Linux】

打开本次生成的 `START-HERE.txt`。复制里面的两行服务器命令，逐行执行。

形式如下，**文件名以你本次输出为准，不要直接照抄此示例日期**：

```bash
cd /opt/paperswipe-beta
bash deploy-20261015-120000-a1b2c3.sh
```

这是主动发布动作，会在备份和切换阶段短暂停服。建议选择内测用户少的时段，提前通知大家稍后可能要重新登录。

本流程没有 `yes` 提示，不要再粘贴以前那段包含 `read -r verified` 的长代码。脚本自动验证你生成的 SHA256；校验只保证两个文件配套及传输完整，不是防篡改数字签名，只运行自己可信电脑生成的脚本。

### 第五步：观察执行阶段【Linux】

| 阶段 | 正常现象 | 对网站的影响 |
| --- | --- | --- |
| 校验与预检查 | 压缩包名称后出现 OK | 不替换应用 |
| 解压与构建 | Docker 下载、编译、构建日志 | 旧应用仍在运行；构建可能占用 CPU/内存 |
| 数据备份 | Briefly stopping app… | 暂停应用，复制完整 /app/data |
| 切换与检查 | 新应用启动，等待 healthy | 短时不可用，代理不重建 |
| 完成 | DEPLOYMENT SUCCESS | 新镜像已运行，仍需浏览器验收 |

构建时间受服务器性能与下载速度影响，不承诺固定几分钟。看到下载/编译进度时不要重复点击或同时再开一个发布。

成功会打印：

```text
DEPLOYMENT SUCCESS
Version: beta-...
Backup: /opt/paperswipe-beta/backups/beta-...
Rollback tag: rollback-beta-...
```

保留这三项，截图或记入第 12 节发布记录。

脚本使用 UTC 给服务器镜像命名，比北京时间早 8 小时；本地压缩包按电脑当地时间命名，所以两者日期/时间不同并不表示传错版本。

## 6. 更新成功后怎么验收

### 6.1 检查实际运行镜像

在 Linux：

```bash
docker inspect paperswipe-beta-app-1 --format 'Image={{.Config.Image}} ID={{.Image}} Status={{.State.Status}}'
docker compose -p paperswipe-beta -f compose.public.yaml ps
```

Image 应与发布成功输出的版本一致，app 应 healthy。脚本还会比较运行镜像 ID 和刚构建的镜像 ID，而不仅仅看容器创建时间。

### 6.2 检查邀请码页面

用无痕窗口打开 https://paperswipe.site/login ：

- 新版布局正常。
- 左上角图片不破损。
- 中文/英文切换正常，中文状态下功能标签没有漏译。
- 邀请码输入、显示/隐藏、错误提示、登录按钮工作正常。
- 使用自己的个人邀请码登录，不要为了测试公开邀请码。

普通窗口仍旧时，电脑可按 Ctrl+Shift+R。手机关闭旧标签页，再打开新的无痕/私密标签页。

### 6.3 检查登录后的数据与功能

- 原有文献库、收藏、日程是否保留。
- 搜索、卡片翻面、下一张卡片、语言切换。
- 文献库分类横滑、全选/取消全选。
- 日程顶部日期能否打开日历并跳转周。
- 仅用可丢弃的测试文献验证删除；不要删除其他内测成员的数据。
- Android/iPhone 的真实浏览器都应检查一次重要交互。

重启会丢失内存中的登录会话，可能需要重新输入邀请码；这不等于收藏丢失。

健康接口通过只代表应用能响应，不保证 DeepSeek 余额、外部论文源、DNS、HTTPS和所有交互都正常。少量 AI 验收调用可能消耗额度，不要用反复刷新来做压力测试。

## 7. 重启、重新创建、更新有什么区别

### 7.1 只是重启当前程序，不发布新代码

Linux：

```bash
docker restart paperswipe-beta-app-1
```

它重启已有容器，继续用现有镜像；不会重新编译源码，也不会重新读取改变后的容器环境配置。可能造成短暂中断和重新登录。

### 7.2 修改了源码，要发布新版

重新执行本手册第 5 节：本地打包 → 上传两个文件 → 执行新脚本。

不要用 `restart` 冒充更新，也不要在服务器旧根目录随手执行 `docker compose build`。本工具把新源码存放在 `releases/<版本>`，不会覆盖旧根目录源码。

### 7.3 为什么不直接执行普通的 docker compose up

你的 Compose 默认值曾是 `beta-20261013-v2`。本工具不修改该文件，只在发布时显式设置 `RELEASE_TAG`。

因此：

- 关闭终端不会让已运行的新容器自己变旧。
- Docker 按原容器重启策略启动它，也不是重新选镜像。
- 但是无版本号地重新执行 Compose `up`，可能按照旧默认值创建旧版容器！

**日常发布只使用生成的脚本。不要脱离流程随手运行不带版本号的 up。**

确实需要用同一版本重新创建应用（例如明确修改了服务器 `.env.beta`）时，先备份配置，再确认当前镜像，显式填写其冒号后的完整标签：

```bash
docker inspect paperswipe-beta-app-1 --format '{{.Config.Image}}'
```

下面的占位符必须改成上一条输出中 `paperswipe-beta:` 后的部分；这不是日常更新必做步骤：

```bash
RELEASE_TAG='这里填当前完整版本标签' docker compose -p paperswipe-beta -f compose.public.yaml up -d --no-deps --no-build --force-recreate --wait --wait-timeout 120 app
```

如果希望彻底更换默认版本管理机制，应单独规划配置变更，不能把 `.env.beta` 中添加变量误认为一定会控制 Compose 镜像插值；服务的 env_file 与 Compose 自身的变量来源不是一回事。

## 8. 更新失败如何回滚

### 8.1 先看失败在哪一步

脚本会输出 `UPDATE STOPPED: stage=...`：

- `preflight`：文件、校验、挂载、工具或配置检查失败。尚未切换版本。
- `extract-and-build`：解压/构建失败。尚未主动停止旧应用；仍应检查其健康状态。
- `data-backup`：备份失败，脚本会尽力重新启动旧容器，不进入新版切换。必须自行确认已恢复。
- `switch-and-healthcheck`：已经尝试切换，网站可能不可用。查看日志，必要时显式回滚。

不要在失败后看到命令行提示符，就认为它成功了。只有 `DEPLOYMENT SUCCESS` 是完整成功标志。

### 8.2 安全地查看状态与日志

```bash
cd /opt/paperswipe-beta
docker compose -p paperswipe-beta -f compose.public.yaml ps
docker logs --tail 100 paperswipe-beta-app-1
```

日志可能包含用户输入，分享前打码。不要用截图展示环境文件。

### 8.3 回退到发布前的程序

优先使用脚本失败时打印的完整回滚命令。

或在该次 `backups/<版本>/release.txt` 查找 `ROLLBACK_TAG`。先列目录：

```bash
ls -lt /opt/paperswipe-beta/backups
```

把下面路径中的占位符替换为本次的具体目录名：

```bash
cat /opt/paperswipe-beta/backups/本次版本目录名/release.txt
```

该记录只有版本、镜像 ID、压缩包校验与完成标记，不含 API Key；同目录的环境备份含密钥，不要混淆。

将 `ROLLBACK_TAG=` 后的完整值填入：

```bash
cd /opt/paperswipe-beta
RELEASE_TAG='这里填完整回滚标签' docker compose -p paperswipe-beta -f compose.public.yaml up -d --no-deps --no-build --force-recreate --wait --wait-timeout 120 app
```

随后重新检查状态和网页。回滚也会短暂中断服务。

### 8.4 回滚程序不等于恢复用户数据

回滚命令继续使用当前的数据卷，不把数据恢复到发布前。新版本上线后产生的新收藏不会被脚本主动用旧备份覆盖。

但旧程序可能不识别新字段，并在后续写入时丢弃它们。涉及存储结构迁移时，不保证任意版本互相兼容。

数据确需恢复时：先停写、备份当前卷、确认恢复时间点及数据损失范围，再制定恢复操作。本说明书故意不提供直接覆盖生产卷的一行命令。

## 9. 常见报错与处理

| 现象 | 可能原因 | 先做什么 |
| --- | --- | --- |
| 只有文件路径或灰色建议，没有输出 | 命令还没执行 | 确认输入后按回车 |
| Windows 提示 go/node/tar 找不到 | 本地工具未安装或未进入 PATH | 检查第 4.1 节，重开 PowerShell |
| Go 测试/JS 检查失败 | 当前源码未通过基础检查 | 修复错误再打包，不跳过检查硬上线 |
| No such file / Missing file | 上传目录不对或文件名不对 | 进入 /opt/paperswipe-beta 后用 ls 核对 |
| SHA256 FAILED | 脚本和压缩包不是同一批、传输不完整或包被改动 | 从同一输出目录重新上传配套文件；不要改期望哈希绕过 |
| Invalid archive filename | 手工改名或用了旧版压缩包 | 用 New-Release.ps1 重新生成，不混用旧脚本 |
| unexpected token / $'\\r' / bad interpreter | 脚本被编辑器转换为 Windows 换行 | 重新上传工具原样生成的 .sh；不要再经记事本改写 |
| Another deployment is running | 另一个新版发布脚本持有锁 | 等它结束并检查状态，不删除锁文件绕过 |
| flock 找不到 | 服务器缺少锁工具 | 请管理员安装适合该 Linux 的工具；不要去掉检查硬跑 |
| unknown flag: --wait-timeout | Compose 版本不支持 | 安排升级 Compose 插件后再发布，不现场猜替代命令 |
| Compose does not select the new RELEASE_TAG | image 写死旧标签或有不同配置 | 核对 compose.public.yaml 的 app image 行 |
| 挂载检查失败但没有明显报错 | 现有卷名/路径与本项目约定不同 | 运行第 4.2 节检查，先确认真正的数据位置 |
| 拉取基础镜像超时、TLS、网络错误 | Docker 镜像源或网络问题 | 检查连接；不要关闭 TLS 校验或改用不明镜像 |
| no space left on device | Docker/备份所在磁盘空间不足 | df -h、docker system df；按第 10 节规划清理 |
| 编译被 killed | 可能内存不足，也可能其他系统问题 | 查看系统资源和构建日志，避免高峰发布；不要盲目归因 |
| 120 秒健康等待超时 | 启动错误或启动较慢 | 先查看 app 状态/日志；不可用时考虑回滚 |
| 502 Bad Gateway | 代理无法连接后端，备份停服时也可能短暂出现 | 等脚本结束；持续出现时检查 app 与 proxy 日志 |
| 登录要求重新输入邀请码 | 应用重启后会话失效 | 使用原个人邀请码；再确认数据仍在 |
| app 健康但还是旧页面 | 运行旧镜像、查看了本地文件或浏览器缓存等 | 先核对运行版本与镜像 ID，再无痕访问域名 |
| 登录页正常，AI 请求失败 | 可能是 API 配置、余额、限额或外部源问题 | 看脱敏错误；部署成功不等于 AI 配额充足 |
| 发布途中连接断了 | 脚本可能中止，也可能还在运行 | 重新连接先查 ps 和该次 release.txt，不重复发布 |

服务器上快速找上传文件：

```bash
cd /opt/paperswipe-beta
ls -lh paperswipe-update-*.tar.gz deploy-*.sh
```

这只是列出文件，不能把最新排序结果当成授权自动执行的依据；仍要认准本次文件名。

“页面仍旧”的排查顺序：

1. 本地打包是否在保存最新代码之后？
2. 上传的压缩包与脚本是否来自本次同一个文件夹？
3. 是否看到 DEPLOYMENT SUCCESS？
4. 运行镜像是否等于本次打印的版本？
5. 是否打开 https://paperswipe.site/login，而不是本地文件/旧预览？
6. 无痕窗口仍旧时，再检查代理、DNS/CDN和是否访问了同一服务器。

不要一遇到旧页面就删除数据、清空所有 Docker 镜像或重复生成邀请码。

## 10. 备份、旧压缩包和磁盘清理

### 10.1 每次发布保存了什么

```text
/opt/paperswipe-beta/
  releases/<新版本>/       本次解压的源码，构建从这里进行
  backups/<新版本>/
    .env.beta              发布前的环境配置（含密钥）
    compose.public.yaml    发布前的 Compose
    Caddyfile              发布前的代理配置
    release.txt            新旧镜像、压缩包、校验与完成标记
    data/                  停止应用写入后复制的用户数据
```

如果发布在备份前失败，可能只有部分目录。只有 `release.txt` 中出现 `DATA_BACKUP_COMPLETE=yes` 才表示脚本的数据复制步骤完成；它也不替代定期恢复演练。

备份与源码在同一台服务器上，不能防服务器整盘损坏。定期把必要备份加密复制到另一处受控存储，并限制访问权限。不要提交到 GitHub。

### 10.2 老版本压缩包能删吗

可以有计划地删，但不是看到新版本运行就立刻全删。

- `.tar.gz` 是传输用源码包，不是正在运行的程序。
- Docker 镜像是可运行程序；回滚依赖保留的旧镜像。
- 数据卷是用户数据；不能拿它当缓存清理。
- `backups/` 是恢复依据，里面有敏感数据。
- `releases/` 保存每次源码；根目录旧源码未被覆盖。

建议至少保留当前稳定版本和上一个已验证可用版本的源码、镜像、配套配置及数据备份。存在迁移或尚未验收时保留更多。确认有其他可靠副本后，再按明确文件名逐个清理更老的传输包。

这里不提供批量删除命令，避免误删日期相近的有效版本。不要直接运行 `docker system prune -a --volumes`、`docker volume prune` 或递归删除整个部署目录。

### 10.3 发布会不会永久越来越占空间

会。每次会增加源码目录、镜像/构建缓存和一份用户数据备份。本工具不自动清理，因为它无法代你判断哪些版本已验收、哪些备份仍需保留。

定期检查：

```bash
df -h /opt/paperswipe-beta /var/lib/docker
docker system df
du -sh /opt/paperswipe-beta/releases /opt/paperswipe-beta/backups
```

“安全清理”应是另一次明确操作，不要在发布报错时临时全盘清空。

## 11. GitHub、邀请码、API 配额与 App

### Push 后为什么网站没变化

GitHub Push 只是上传代码。本项目的检查工作流负责验证，不等于当前腾讯云服务器自动更新。本手册的上传和执行发布步骤仍然需要做。

### 新版邀请码页面需要单独部署吗

不需要。它与所有网页、翻译和资源一起嵌入 Go 程序。打包工具包含整个 `web/`，新镜像包含这些页面。

只替换服务器上的 `web/login.html` 而不重新构建镜像，不会改变现有容器里的嵌入页面。

### 原来的邀请码需要重新生成吗

常规更新不需要。脚本保留服务器 `.env.beta`，不替换邀请码配置。是否需要更改邀请码是独立管理操作。

### 这能防止内测成员用完我的 DeepSeek 余额吗

不能。部署工具不修改 API 使用政策，也不等于总金额硬上限。API 预算、账号配额、并发限制、异常监控需要单独配置和验证；不要因为发布成功就认为费用风险消失。

### 服务器更新后，手机 App 会同步变新吗

- 浏览器访问的网站：访问新服务后使用新网页，必要时刷新。
- 已安装、内置网页资源的 Android App：后端可以更新，但客户端资源还需要重新构建、签名并安装/发布新版 APK。
- iOS、Windows 客户端的打包、签名和分发：是独立流程，不在这份服务器手册里。

不要把这里生成的 tar.gz 当 APK 发给内测用户，也不要把服务器凭证或 API Key 打进客户端。

## 12. 发布记录与技术说明

### 12.1 每次留一份发布记录

可在自己的私人运维记录里填写：

```text
发布时间（北京时间）：
本次功能：
Git 提交号 / 是否含未提交源码：
压缩包文件名：
SHA256：
运行镜像标签：
运行镜像 ID：
备份目录：
回滚标签：
是否看到 DEPLOYMENT SUCCESS：
邀请码页面验收：
中文/英文验收：
文献库与日程数据验收：
手机验收：
发现的问题 / 是否回滚：
```

只记录标识，不记录 API Key、完整邀请码或其他人的阅读数据。

### 12.2 配套工具的边界

- 新打包工具不上传、不登录服务器、不发布到 GitHub。
- 发布模板会检查当前数据卷约定和镜像变量，但不能验证任意配置改动的全部安全性。结构发生变化就先停止使用此常规流程。
- 打包基于当前项目“根目录 Go 文件 + web”布局；如果未来新增 internal、cmd 等编译目录，必须一起修改打包清单和 Dockerfile。
- 如果引入第三方 Go 模块，需确认 Dockerfile 正确处理 go.sum 和依赖下载。当前打包器虽会包含存在的 go.sum，但不能代替修正 Docker 构建步骤。
- 环境配置、数据库迁移、代理/域名变更不自动发布。
- 脚本对一般命令失败会停止；备份阶段失败会尽力启动旧容器。断电、强制杀进程、磁盘故障等不保证自动恢复。
- 切换失败不自动回滚，避免未经检查就用旧程序写入可能已变化的数据。脚本打印回滚命令，由你决定执行。
- 新版脚本使用文件锁避免它们彼此并发，但不能阻止你另开终端手工改动 Docker。
- 校验与文件权限不是完整供应链安全体系。只使用自己的可信打包文件，保存好服务器权限。

### 12.3 参考依据

当前项目：Dockerfile 的 COPY web，以及 main.go 的 go:embed web，说明网页需要随程序重新构建。

官方说明：

- [源码或构建目录改变后重新构建](https://docs.docker.com/reference/cli/docker/compose/build/)
- [Compose up、保留挂载卷及健康等待参数](https://docs.docker.com/reference/cli/docker/compose/up/)
- [Compose cp 与保留属主权限的 archive 参数](https://docs.docker.com/reference/cli/docker/compose/cp/)

本文流程针对已有 PaperSwipe 部署。换服务器、改项目名或做存储迁移时，先更新此说明书和脚本，不要直接沿用旧路径。
