# PaperSwipe 移动端（Android 第一阶段）

## 已完成与未完成

- Capacitor 8.5.3 Android 工程，开发包标识 `site.paperswipe.app`。正式上架前确认包名；发布后不要随意改动。
- 与网页共用 `../web`，构建时复制到安装包，不使用 `server.url` 远程套壳。修改网页后必须重新构建 App，服务器更新不会替换 App 内的界面。
- App 经 HTTPS 请求现有 Go 后端，继续使用逐批返回的 AI 摘要。浏览器继续使用原来的 Cookie 登录。
- Android 会话用 Keystore 的 AES-GCM 密钥加密后存储。邀请码和模型密钥不写入安装包或本地存储。不使用 localStorage 保存会话。
- Android 返回键优先关闭卡片/弹窗/设置，回到 Explore 后再将 App 切至后台；恢复前台只同步账户和 Library，不自动重做付费检索。
- 尚未完成真机验证、正式签名、上架审核、原生分享/推送、完整离线阅读。不能将 debug APK 视作正式发布包。
- iOS、HarmonyOS NEXT 工程尚未建立。iOS 后续需要 Keychain 对应实现及 macOS/Xcode；鸿蒙另做平台工程，Android APK 不等于鸿蒙 NEXT 应用。

## Windows 构建

需要 Node 22+、JDK 21、Android SDK Platform 36 和对应构建工具。不要将机器专属路径提交进 Git。

推荐在仓库根目录执行：

```powershell
.\mobile\Build-Android.ps1
```

脚本自动寻找 JDK 21，安装锁定依赖、同步最新界面、构建并验证 APK 签名，然后将带时间戳的测试包导出到 `release/android/`。只修改当前进程环境，结束后恢复；不上传、不部署。若 JDK / SDK 在其他位置，可使用 `-JdkDirectory` / `-SdkDirectory` 指定目录。

在仓库 `mobile` 目录：

```powershell
npm ci
npm run doctor
npm run sync:android
cd android
.\gradlew.bat assembleDebug --no-daemon
```

输出：`mobile/android/app/build/outputs/apk/debug/app-debug.apk`。

2026-10-15 已完成本地构建并生成 `0.1.0` debug APK（6,746,190 字节），签名校验通过。上次 Gradle 下载超时已解决：从腾讯云镜像取得相同 8.14.3 binary 分发后，验证其 SHA-256 与仓库固定的官方校验值完全相等，再放入本机构建缓存。没有修改项目的官方分发 URL 或关闭校验。首次在新电脑构建仍需要下载依赖。

Windows Java 临时路径导致的 `Unable to establish loopback connection` 已通过本次构建进程专用的 `.gradle/paperswipe-tmp` 目录解决，处理已写入构建脚本；未更改防火墙或系统全局 Java 配置。

本机 debug 签名由 Android 工具生成在用户 `.android/debug.keystore`，未放入源码或安装包。请勿将 debug 包当作正式群测/商店发布包；后续换正式签名时不保证直接覆盖安装。已有数据存服务端，但卸载会清除手机本地登录状态。

也提供了手动 GitHub Actions 工作流 `Android internal test package`：提交代码后，在 Actions 中手动运行，成功后下载 APK artifact。此工作流尚未运行；本次没有 push、触发远程构建或发布安装包。它用临时 debug 签名，仅供小范围测试，不保证跨运行签名一致，也不能用于持续正式升级。正式群测分发前需配置稳定签名并验证更新路径。

本次电脑已有 Java 21，但默认 `JAVA_HOME` 指向 17。可仅对当前终端设置（不更改系统环境）：

```powershell
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-21.0.6+7'
$env:ANDROID_HOME = 'C:\Users\Administrator\AppData\Local\Android\Sdk'
```

默认 API 地址为 `https://paperswipe.site`。独立测试环境可在构建前设置 `PAPERSWIPE_API_ORIGIN` 为另一个 HTTPS origin（无路径/密钥）。不要通过关闭 TLS 检查调试。`npm run build` 只复制 `web`，不会读取 `.env.local`、`.env.beta`、邀请码表或 `data`。

构建目录 `www` 是生成物，不要手改。共享源码文件移除时应重新创建干净的构建输出以避免旧文件残留；正式发布应使用干净检出执行构建。

## 服务器前置条件（本次未部署）

1. 先备份生产数据和当前镜像，部署包含 `mobile_auth.go` 的这一版后端。
2. 保留 `BETA_MODE=1`、`PUBLIC_ORIGIN=https://paperswipe.site`、原有邀请码和数据卷。在服务器 `.env.beta` 增加 `ENABLE_MOBILE_APP=1`，重建/重建容器时确认使用正确的新镜像。不要用本地 `data/state.json` 替换生产数据。
3. 默认不启用 App 接口。只有 `https://localhost`（Android）和 `capacitor://localhost`（预留 iOS）允许跨域，且所有私有接口仍需有效 bearer session。不是任意来源放行，也不允许跨域 Cookie。
4. 手机使用现有专属邀请码即可访问同一账户数据。每个邀请码最多一个网页会话加一个 App 会话；新手机登录替换旧手机会话，不踢掉网页。会话最多七天，后端重启或退出登录会使相应会话失效。
5. CORS 不是 App 身份证明。仍由随机会话、邀请码、额度限制保障访问。勿把邀请码/会话放 URL、分享二维码、日志或公开仓库。密钥失效只在 App 本地清除会话，不能当作服务端撤销成功。

服务器未更新时，App 会明确提示移动端接口未启用，不能仅靠安装新 APK 解决。

## 验证

仓库根目录：

```powershell
go test ./...
go vet ./...
node --test tests/native_transport.cjs
python tests/mobile_stability.py
python tests/android_package.py
```

以上检查以及 `go vet ./...` 本次均通过。APK 内容检查逐文件比对当前 `web`，确认包含新版登录页、语言文件和周日历，无旧文件残留、`.env`、用户数据或 keystore 文件。签名通过 APK v2 校验，最低系统声明为 Android 7.0（API 24），目标 API 36。未连接安卓真机，未执行真机安装、WebView、Keystore 和仪器测试。

2026-10-15 对线上接口仅进行了一次不带凭据的 OPTIONS 检查，服务器返回 403「App 接口未启用或请求来源无效」。因此当前包可交付安装测试，但线上 App 登录尚未就绪；未修改服务器或消费 AI 额度。

测试覆盖来源拒绝、CORS 预检、Cookie/bearer 隔离、账户数据隔离、会话到期/撤销、流式响应、凭证不发给第三方、触屏翻面/滑动、返回键和恢复事件。模拟浏览器测试不能替代 Android WebView/Keystore 真机测试。

Android 真机验收：首次登录 → 搜索/逐批卡片 → 收藏 → 日程 → 杀进程重开 → 飞行模式/恢复 → 返回键 → 外链 → 退出登录。检查小屏键盘、安全区域、深浅色主题和大字体。服务器重启后应提示重新登录而不是空白页。

依赖锁定在 `package-lock.json`。CLI 的 `xcode` 间接依赖通过 override 固定 `uuid@11.1.1`，消除旧版本漏洞；已验证其 UUID 生成调用兼容，iOS 完整构建仍需后续验证。不要运行未经审查的 `npm audit fix --force`。

实现参考：[Capacitor 环境要求](https://capacitorjs.com/docs/getting-started/environment-setup)、[Android 原生插件](https://capacitorjs.com/docs/android/custom-code)、[Android Keystore](https://developer.android.com/privacy-and-security/keystore)。
