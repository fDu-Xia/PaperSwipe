# PaperSwipe 项目导航

本次改动与验证结果见 [整理记录](ORGANIZATION_REPORT.md)。

## 先找对文件

| 要做的事 | 修改位置 | 不要误改 |
| --- | --- | --- |
| 产品页面、卡片、文献库、日程 | `web/` | `mobile/www/` 是生成结果 |
| 检索、摘要、邀请认证、额度、数据保存 | 根目录的 Go 文件 | 旧目录中的二进制不是源码 |
| 产品宣传网站 | `marketing/`，先看其中的 README | `archive/legacy/` 是历史展示页 |
| Android 壳、原生桥接和打包 | `mobile/` | 应用页面仍来自 `web/` |
| 腾讯云部署与更新 | `deploy/` | 发布包里的副本不是日常开发入口 |
| 迁移记录、使用说明 | `docs/` | 历史记录不代表所有功能均已上线 |
| 测试与回归验证 | `*_test.go`、`tests/` | 测试使用模拟数据，不使用真实邀请码 |
| 构建结果、APK、路演生成材料 | `release/`（不提交 Git） | 不放回源码根目录 |
| 整理前的本地备份 | `backups/`（不提交 Git） | 可能包含私有状态，不上传 |

后端继续采用一个 Go 包，并按业务拆文件。这对当前规模是合理的，不为目录整齐而强行增加多层包和接口。

## 前端职责

- `index.html`：页面结构与脚本装配；`bootstrap.js`：认证检查后加载主应用。
- `app.js`：页面状态、事件绑定、渲染与业务协调。
- `bibliography.js`：纯数据转换，生成 BibTeX 文本和 Zotero 条目；不读状态、不下载文件、不请求网络。
- `event-stream.js`：解析服务端的 LF 分隔 JSON 事件流；不决定页面如何显示。
- `client-api.js` / `platform.js`：服务端写入与 Web/原生请求边界。
- `card-gestures.js` / `schedule-state.js` / `schedule-calendar.js`：手势与日程状态、选周交互。
- `i18n.js` / `locales.js` / `content-language.js` / `paper-text.js`：界面语言、论文翻译缓存与文本清理。
- `mockdata/`：趋势榜单和学习路线的演示数据，与真实检索结果分开维护。
- `styles.css`：当前样式入口。尚未按功能拆分；后续应先检查层叠顺序和多端截图，再拆分。

这些脚本仍采用当前项目的浏览器全局命名空间，不增加框架或新的运行依赖。新增脚本必须在使用它的脚本之前装配到 `index.html`。

## 后端职责

| 文件 | 职责 |
| --- | --- |
| `main.go`、`config.go` | 启动、嵌入前端资源、配置 |
| `api.go` | 路由、请求校验、HTTP/SSE 响应 |
| `beta.go`、`mobile_auth.go`、`admission.go` | 邀请身份、移动端会话、请求准入 |
| `papers.go` | 开放论文源与论文元数据 |
| `summarizer.go`、`summary_retry.go`、`translation.go` | 摘要、重试、翻译 |
| `library.go`、`schedule.go`、`preferences.go` | 文献库、日程、偏好 |
| `store.go`、`search_cache.go` | 状态持久化与缓存 |

## 日常检查

在项目根目录运行：

```powershell
go test ./...
go vet ./...
node --test tests/*.cjs
python tests/project_structure.py
```

页面或交互改动后，再运行（需要安装 Playwright 和 Edge；CI 用 Chromium）：

```powershell
python tests/mobile_stability.py
python tests/language_ui.py
python tests/login_ui.py
python tests/translation_priority.py
```

移动端共享资源检查：先在 `mobile/` 安装依赖，再运行 `npm run build`。这只生成网页资源，不等于完成 APK 打包或真机验证。

部署脚本回归：`python tests/deployment_tools.py` 和 `python tests/promo_deployment.py`。需要 Bash；Windows 可用 Git Bash。测试使用假 Docker，不部署线上服务。

## 防止再次混乱

1. 产品代码只在这个仓库维护；桌面宣传页和发布包是交付副本，不会自动同步。
2. 打包应用用 `./deploy/New-Release.ps1 -OutputDirectory ./release/app`；宣传页用 `./deploy/New-PromoRelease.ps1`，不要压缩整个仓库。这里只生成本地发布包，不会自动上传。
3. 不提交 `.env*` 私密配置、邀请码、用户数据、签名密钥、依赖目录和生成产物。仓库已跟踪的 `data/state.json` 此次保留，不能直接当垃圾删掉；提交前单独核对。
4. 抽取模块以职责为单位，不按固定行数切文件；模块输入数据、输出结果，避免新增隐藏全局依赖。
5. 先给当前行为补测试，再小步重构。不要把新功能、接口改动和大规模整理混在一起。
6. `archive/legacy/` 中的素材仍有历史价值。确认不再需要、并有可恢复备份之前，不删除。

## 本次整理边界（2026-10-16）

归档旧宣传页、素材与旧二进制；集中项目文档；拆出导出、事件流和趋势演示数据，补自动测试。未更改 API、认证方式、数据格式、线上服务或原生登录链路；也没有宣称所有大文件已经完成重构。`app.js` 中的卡片渲染、助手和日程仍是后续可按业务逐步拆分的部分。
