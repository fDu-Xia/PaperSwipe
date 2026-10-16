# PaperSwipe 宣传页

双击 `index.html` 即可打开。移动、发送或上传时，必须同时保留旁边的整个 `paperswipe-assets` 文件夹。无需安装依赖，也不依赖外部字体或图片网站。

这是独立宣传页，不会修改产品后端或部署线上服务。“立即体验”跳转至 https://paperswipe.site/login。

## 内容与素材

- 保留原宣传页的紫色品牌、核心标题与 Explore / Library / Schedule / Trending 导航。
- `logo.png`：沿用当前项目 `web/assets/paperswipe-logo.png`，没有重新设计品牌标志。
- 探索、翻面、文献库、日程、日历、设置和登录截图：当前本地前端的真实界面，使用虚构演示文献；没有读取真实用户数据或调用付费 AI。
- 趋势截图 `trending-user-20261015.png`：用户提供的 P2 原图（424 × 680），完整展示主题与相关论文列表，不裁切、不重绘。与自动截图使用不同文件名，避免重新运行截图脚本覆盖此图。
- `product-demo-20261015.mp4`：用户提供的 `C:/Users/Administrator/Desktop/10月15日.mp4`，完整时长约 55 秒，保留原画幅与音轨，转为 H.264/AAC、1080p、30 fps 和快速起播格式，大小约 4.5 MiB。原文件保持不变。海报 `video-poster.jpg` 来自视频第 1 秒。旧视频及其字幕已不被页面引用，发布包不包含它们。
- `reading-editorial.png`：内置图片生成工具新生成的研究文稿配图，已保存在本素材目录，不依赖临时链接。
- Trending 明确标注预置演示，不宣传为实时热榜。App 不提供尚未发布的下载链接。
- 腾讯云版本依据用户提供的备案截图，在页底显示网站备案号 `粤ICP备2026152562号-1`，链接至工信部备案网站；仅增加必要的备案行，不恢复已删除的品牌页脚。

## 更新与检查

1. 修改 `index.html` 和素材目录里的 `site.css` / `site.js`。
2. 需要重新截图时运行 `python marketing/capture_demo.py`（需要 Python Playwright 和 Edge）。它用隔离的本地模拟服务，不连接生产环境。它生成的旧示例录屏不再用于网页；当前网页使用用户提供的新视频。
3. 运行 `python marketing/test_page.py`，检查直接打开文件和本地 HTTP 两种方式，以及 320 / 390 / 1024 / 1440 宽度、主题、图片、视频、键盘切换和弹窗。
4. 将 HTML 和整个素材目录一起交付；不要包含 `recordings/` 原始录屏目录。

自动检查通过全部 8 个视口/协议组合。另运行 `python marketing/test_interactions.py`，覆盖 320 至 2560 宽度、FAQ 完整分句、双向展开动画、快速反复点击、窗口缩放、弹窗关闭和减少动态效果。

2026-10-15 第二版按反馈删除页脚、首屏小标题、三步流程条和日程下方说明。交互反馈使用原生 CSS / Web Animations API，无新增动画库，键盘操作和减少动态效果偏好均保留。

首版 Lighthouse 本地移动模拟审计：性能 75、无障碍 100、最佳实践 100；原始图片较大是主要优化项。审计报告成功生成，但 Windows 上浏览器临时目录清理出现 EPERM。此分数未在第二版重测，只是首版本地记录，不代表正式服务器结果，也不替代真机测试。

## 配图提示词记录

使用内置 imagegen，非 API/CLI 回退。最终文件：`paperswipe-assets/reading-editorial.png`。

Use case: ads-marketing. Asset type: supporting editorial illustration for PaperSwipe, a real research-paper discovery app with an existing violet brand. Create a sophisticated photorealistic studio still life, wide 3:2 landscape composition, of a small stack of scientific manuscript sheets with understated abstract line charts and two-column illegible typesetting, gently fanned into a curved arc above a cool pale silver-white desk. One single rich muted violet paper bookmark passes through the pages, conveying choosing what is worth reading. Paper fibers, crisp folded corners, physical soft shadows, quiet natural side light. Minimal premium digital-product campaign photography; beautifully sculptural but grounded. Composition fills the frame with ample breathing room, high fidelity materials. No devices, no logos, no words that can be read, no slogans, no fake screenshots, no people, no excessive glowing or gradient blobs, no watermark. The visual will sit beside a short paragraph about spending time reading instead of sorting search results. Output landscape 1536x1024.
