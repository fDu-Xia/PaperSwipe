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

在仓库 `mobile` 目录：

```powershell
npm ci
npm run doctor
npm run sync:android
cd android
.\gradlew.bat assembleDebug --no-daemon
```

输出：`mobile/android/app/build/outputs/apk/debug/app-debug.apk`。

本次本地构建被 Gradle 官方下载跳转后的网络超时阻断，尚未产出 APK。已改用体积更小的 binary 分发，并固定官网 SHA-256 校验值；未更换为不明镜像或关闭校验。网络恢复后可继续上述构建。

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
```

测试覆盖来源拒绝、CORS 预检、Cookie/bearer 隔离、账户数据隔离、会话到期/撤销、流式响应、凭证不发给第三方、触屏翻面/滑动、返回键和恢复事件。模拟浏览器测试不能替代 Android WebView/Keystore 真机测试。

Android 真机验收：首次登录 → 搜索/逐批卡片 → 收藏 → 日程 → 杀进程重开 → 飞行模式/恢复 → 返回键 → 外链 → 退出登录。检查小屏键盘、安全区域、深浅色主题和大字体。服务器重启后应提示重新登录而不是空白页。

依赖锁定在 `package-lock.json`。CLI 的 `xcode` 间接依赖通过 override 固定 `uuid@11.1.1`，消除旧版本漏洞；已验证其 UUID 生成调用兼容，iOS 完整构建仍需后续验证。不要运行未经审查的 `npm audit fix --force`。

实现参考：[Capacitor 环境要求](https://capacitorjs.com/docs/getting-started/environment-setup)、[Android 原生插件](https://capacitorjs.com/docs/android/custom-code)、[Android Keystore](https://developer.android.com/privacy-and-security/keystore)。
