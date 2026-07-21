# PaperSwipe

PaperSwipe 是一个手机优先的论文筛选 H5：输入研究方向，系统抓取候选论文、生成判断卡片，然后通过四向滑动完成快速取舍。

## 已实现

- Semantic Scholar、arXiv、OpenAlex 多源检索与自动降级
- 论文卡片：问题、创新、方法、结果、适合人群、保留理由
- 左滑跳过、右滑 Interested、上滑 Key、下滑 Read；同时支持按钮和方向键
- Explore、Library、Network、Settings 四个手机端页面
- Interested / Key / Read 分类、智能排序、详情抽屉、原文/PDF 链接
- 设置页可重设研究主题、发现风格、阅读复杂度与 Light/System/Dark 显示主题
- 本地 JSON 持久化，原子写入，不需要数据库
- 可选 OpenAI-compatible LLM 摘要；无 Key 时使用本地证据抽取
- 可选按需论文视觉图生成，避免搜索时自动产生生图费用
- 远端论文源都不可用时展示明确标记的离线示例，不白屏

## 启动

需要 Go 1.24+。

```bash
go run .
```

打开 [http://localhost:8080](http://localhost:8080)。

常用命令：

```bash
go test ./...
gofmt -w *.go
```

## 配置

所有配置都是可选的：

| 环境变量 | 默认值 | 用途 |
|---|---|---|
| `ADDR` | `:8080` | 服务监听地址 |
| `DATA_DIR` | `data` | 本地状态目录 |
| `SEMANTIC_SCHOLAR_API_KEY` | 空 | 提高 Semantic Scholar 限额 |
| `ZHIPU_API_KEY` | 空 | 智谱文本与图片模型共用的后端密钥 |
| `LLM_API_KEY` | 空 | 单独覆盖文本模型密钥 |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | OpenAI-compatible API 地址 |
| `LLM_MODEL` | `gpt-4.1-mini` | 摘要模型名 |
| `LLM_THINKING` | 空 | 支持 `enabled` / `disabled` 的模型思考模式 |
| `IMAGE_API_KEY` | 空 | 单独覆盖图片模型密钥 |
| `IMAGE_BASE_URL` | 继承 `LLM_BASE_URL` | 图片生成 API 地址 |
| `IMAGE_MODEL` | 空 | 图片模型名；留空时关闭生图功能 |
| `IMAGE_SIZE` | `1280x1280` | 生成图片尺寸 |

程序启动时会读取项目根目录的 `.env.local`，系统环境变量优先级更高。复制 `.env.example` 后即可配置智谱：

```bash
cp .env.example .env.local
# 编辑 .env.local，填写 ZHIPU_API_KEY
go run .
```

当前智谱配置使用 `glm-4.5-air` 理解论文、使用 `glm-image` 按需生成论文视觉图。API Key 只在 Go 后端使用，不会下发到浏览器；`.env.local` 已被 `.gitignore` 排除。

## API

- `GET /api/search?q=AI%20agent%20memory&limit=8`
- `POST /api/topic-plan`
- `POST /api/paper-image`
- `POST /api/actions`，action 为 `dismiss`、`save`、`priority` 或 `read`
- `GET /api/library`
- `GET /api/stats`
- `GET /api/searches`
- `GET /api/health`

## 目录

```text
.
├── main.go            # 服务启动与静态文件托管
├── api.go             # HTTP API
├── papers.go          # Semantic Scholar / arXiv / OpenAlex 抓取与排序
├── summarizer.go      # 本地摘要与可选 LLM 摘要
├── store.go           # JSON 状态存储
├── models.go          # 数据模型
└── web/               # 零构建 H5
```

## 当前边界

这是核心 MVP，不包含登录、多用户隔离、云端数据库和 PDF 全文解析。卡片判断基于开放元数据和摘要，重要结论仍需回到论文原文核验。
