# PaperSwipe 邀请制内测部署

本次准备的是单实例、20～50 人邀请制 Web 内测版本。没有购买资源、发布到公网或上传数据。

## 已实现与范围

- 每人独立的 256-bit 随机邀请凭证；配置仅保存 SHA-256 哈希。凭证相当于个人密码，不是共享注册码。
- 服务端 HttpOnly / SameSite=Strict 会话，HTTPS 时设置 Secure；7 天过期，同一个凭证重新登录使旧会话失效。服务重启后需重新登录，收藏不受影响。
- 每人独立 `DATA_DIR/users/<id>.json`；客户端传入的身份不能改变读写归属。不会导入根目录现有 `data/state.json` 的收藏。
- 检索与主题分析合计每人每日 20 次（含失败和被校验拒绝的请求），北京时间零点重置；额度落盘。全站最多同时处理 2 个此类请求，超出返回 429。单次检索最多 30 篇。
- 登录全站每分钟最多 30 次，不依赖可伪造的代理 IP 请求头。大量失败尝试也可能暂时阻塞正常登录，应由接入层进一步防护。
- 内测禁用生图；开放 Explore、Library、Schedule、Trending 与阅读助手。Schedule 尚未完整持久化，Trending 为明确标注的预置示例，阅读助手为本地规则与预置路线。后面三个模块用于交互与需求验证，不代表正式完成的服务。
- 每人最多保存 2000 条论文状态记录（包含跳过记录）；账号 ID 统一转为小写。
- 停止静默填充示例论文、虚构奖项、随机引用数；阅读时长优先使用后端估计。真实引用数缺失目前显示 0，不能视为确切零引用。
- 生产关闭详细提示词日志；应用日志保留耗时及失败状态。

存储仍是每用户 JSON 文件，不是数据库；只允许一个应用进程/实例。不要用多个容器共享该卷。此版本不包含支付、短信、原生 App、持久化日程或完整 PWA。浏览器偏好按账号命名，但不跨设备同步。Zotero 凭据仍在 localStorage，勿在公用浏览器保存。

## 上线前团队准备

1. 在模型供应商后台撤销此前仓库示例文件中的旧凭据。修改文件不能撤销凭据，也不能清除 Git 历史中的副本。核对历史和账单；本次未重写 Git 历史。
2. 准备中国大陆 Linux 服务器、域名与 HTTPS 所需 DNS。大陆网站备案由团队和接入商办理；邀请制不要当作自动豁免。核对 [工信部备案规定](https://www.miit.gov.cn/gyhxxhb/jgsj/cyzcyfgs/bmgz/xxtxl/art/2024/art_84a0cfa0ebd049bbbe751dca9a008e56.html)，备案展示信息需要上线前补充。
3. 准备正式运营联系入口、隐私说明与数据删除流程。当前登录页为内测数据流提示，联系邀请发放者，不是完整法律文本。
4. 验证服务器对三个论文源和选定模型的网络连接。开发机访问成功不代表大陆服务器可用；不绕过网络限制。检索失败会明确显示，不伪造结果。

## 本地预览（Windows PowerShell）

先运行 `go run . invite`，会输出一次性展示的原始凭证与 `tester01:<hash>` 配置条目。自己保存原始凭证；服务端无法从哈希恢复。

```powershell
go run . invite
$env:BETA_MODE = '1'
$env:PUBLIC_ORIGIN = 'http://127.0.0.1:8080'
$env:ADDR = '127.0.0.1:8080'
$env:DATA_DIR = Join-Path $env:LOCALAPPDATA 'PaperSwipeBeta'
$env:BETA_INVITES = 'tester01:替换为生成的哈希'
$env:LLM_API_KEY = ''
$env:ZHIPU_API_KEY = ''
go run .
```

打开 `http://127.0.0.1:8080`，输入对应原始凭证。HTTP 仅允许 localhost/127.0.0.1，公网配置必须为 HTTPS。Origin 精确匹配，不要混用 localhost 与 127.0.0.1。

## 服务器部署（Linux / Docker Compose）

配置 Docker Engine 与 Compose 插件，上传源码（排除 `.env.local`、`data/` 和已有二进制）。Docker 构建上下文已采用白名单，不会包含旧数据和密钥。

```sh
cp deploy/beta.env.example .env.beta
chmod 600 .env.beta
docker compose build
docker compose run --rm --no-deps app invite
```

编辑 `.env.beta`：PUBLIC_ORIGIN 填实际域名完整 HTTPS Origin，无尾斜线；BETA_INVITES 填每人条目，以逗号分隔，用户 ID 必须不同。最初保持模型密钥为空，验证基本检索后再配置新的模型密钥。每次创建邀请都运行一次生成命令。

将域名解析到服务器，开放 80/443；不要开放应用 8080。然后：

```sh
docker compose up -d
docker compose ps
docker compose logs --tail=100 app
```

Caddy 自动申请 HTTPS 证书；首次签发要求 DNS 与入站端口可达。SSE 使用 `text/event-stream`，Caddy 对此自动即时转发，代理读取超时设为 360 秒。配置依据 [Caddy 官方文档](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)。不要在外层 CDN 开启事件流缓存。

应用数据在 `app_data` 命名卷；禁止 `docker compose down -v`。模型调用上限是请求额度，不是精确人民币预算：在供应商后台另设余额提醒/消费限制，先用少量邀请验证实际消耗。

## 邀请撤销、删除、备份与回滚

- 增加/撤销邀请：修改 `.env.beta` 后 `docker compose up -d --force-recreate app`。此操作会清掉全部内存会话，大家重新登录；已保存数据仍在。
- 凭证丢失：生成新凭证，用新哈希替换同一个用户 ID 后重建 app，保留该用户文件。
- 删除账号数据：先撤销凭证，再停应用，把该用户 JSON 移出数据卷按团队保留策略处理；备份副本同样需要处理。不要把一个旧用户 ID 分配给其他人。
- 备份：在仓库根目录执行 `sh deploy/backup.sh`，会短暂停止 app，复制完整数据后自动启动。配置 `.env.beta` 另做加密备份，不写进 Git。至少每日备份并异地保存。
- 恢复演练：在隔离部署中创建 app 容器但先不启动，把备份的 data 内容恢复进 `/app/data`，确保用户 UID/GID 为 10001，再启动。用两个测试邀请确认收藏和额度正确；不要用生产实例试恢复。
- 发布前记录镜像标签：例如 `RELEASE_TAG=beta-001 docker compose build`，随后使用相同标签启动。保留旧镜像及对应源码/配置；回滚使用旧源码下 `RELEASE_TAG=beta-001 docker compose up -d --no-build app`。如果未来改变存储格式，回滚前必须核对兼容性。

## 验收与当前验证边界

```sh
go test ./...
go vet ./...
node --check web/app.js
node --check web/bootstrap.js
```

自动化测试涵盖：未登录拒绝、跨用户数据隔离、持久化、跨站写入拒绝、退出/过期/重新登录失效、每日额度保存与重置、登录限流。CI 还运行 Go race 检测和 Docker 构建。

正式邀请前在真实服务器验收：HTTPS；错误邀请；两个账户隔离；手机搜索/收藏/刷新；网络失败提示；配额限制；重启后恢复；备份恢复；模型费用。健康检查只说明 HTTP 进程可响应，不验证论文源、模型余额和写盘能力。

当前开发环境未安装 Docker，无法本机执行容器构建/代理签证书。Windows 当前未启用 CGO，race 检测需由 Linux CI 执行。尚未执行真实大陆云服务器网络验收或生产备份恢复演练。

本次本地已通过 Go 测试、go vet、JavaScript 语法检查，成功构建 Linux amd64 和 Windows amd64 可执行文件（`release/`，未纳入 Git）。独立临时数据目录中已用浏览器跑通邀请登录、初始化、本地规则主题分析、真实 arXiv 检索、收藏、刷新后保留及退出；未使用付费模型。Python Playwright 未安装，浏览器检查使用应用内浏览器完成。
