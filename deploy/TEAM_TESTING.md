# 四人团队内部测试（当前服务器）

本说明针对 /opt/paperswipe-beta 下已运行的 compose.preflight.yaml。ICP 仍在审核，保持应用只监听服务器 127.0.0.1:18080，不开放公网 18080/8080，不启动 compose.public.yaml。此内部测试方案不等于公网发布许可。

## 1. 更新完整原型入口

将 paperswipe-full-beta-update-20260926.tar.gz 上传到 /opt/paperswipe-beta。更新包仅含三个前端文件和部署文档，不含 .env.beta、邀请码、用户数据或 Docker 配置。无需先 push GitHub。

在服务器逐行执行；任何一步报错就停止：

```sh
cd /opt/paperswipe-beta
tar -czf "web-before-full-beta-$(date +%Y%m%d-%H%M%S).tar.gz" web
docker image tag paperswipe-beta:local "paperswipe-beta:before-full-$(date +%Y%m%d-%H%M%S)"
tar -tzf paperswipe-full-beta-update-20260926.tar.gz
tar -xzf paperswipe-full-beta-update-20260926.tar.gz
docker compose -f compose.preflight.yaml build app
docker compose -f compose.preflight.yaml up -d --force-recreate app
docker compose -f compose.preflight.yaml ps
curl -fsS http://127.0.0.1:18080/api/health
```

构建失败时不要继续重建容器，旧容器仍可使用。此次没有存储格式变化。保留上面记录的旧镜像标签，必要时用 RELEASE_TAG=对应的before-full标签 docker compose -f compose.preflight.yaml up -d --no-build app 回退。不要删除数据卷，不要运行 down -v。

更新完成后保持你原来的 SSH 连接窗口打开，浏览器访问 http://127.0.0.1:18080，Ctrl+F5 刷新并重新登录。应有 Explore、Library、Schedule、Trending 四个入口，Schedule 内可打开阅读助手。

## 2. 给每位成员独立邀请

你保留现有 tester01；另外三人使用 tester02、tester03、tester04，不共用凭证。对每个人分别执行一次：

```sh
docker compose -f compose.preflight.yaml run --rm --no-deps app invite
```

把输出的 Private invite token 私下交给对应成员，用于网页登录；不要发群聊或截图。输出的 BETA_INVITES 条目默认名为 tester01，需要分别改为 tester02/03/04，再加入服务器 .env.beta 的 BETA_INVITES 行。保留已有 tester01 的条目，用英文逗号连接四个条目，不换行。生成命令本身不会保存配置。

结构示意（不可直接粘贴使用）：BETA_INVITES=tester01:原有哈希,tester02:第二人哈希,tester03:第三人哈希,tester04:第四人哈希。

保存后执行 docker compose -f compose.preflight.yaml up -d --force-recreate app。所有人需要重新登录，收藏保留。不要发送 .env.beta 文件或令牌截图。撤销某成员时移除其条目并重建；不要把旧 ID 分给新成员。

## 3. 队友如何连接

邀请凭证只能登录网页，不能登录 SSH。不要共享 root 密码、root 私钥或云平台账号。

每位队友先在自己电脑生成独立 SSH 密钥，例如 Windows PowerShell 运行 ssh-keygen -t ed25519 -C paperswipe-tester02。在提示保存位置时选用未使用过的文件名，不覆盖已有密钥；建议为私钥设置口令。将生成的 .pub 公钥交给管理员，私钥和口令始终留在自己电脑。

管理员收齐公钥后，需要先配置专用、无 sudo 权限的账号 ps-tester02/03/04，只允许本地 TCP 转发到 127.0.0.1:18080，禁止交互式 shell、远程转发、代理转发和其他目标连接。管理员应先检查服务器现有 SSH 配置，再添加并验证受限设置，避免锁死管理员登录。未完成此步骤，不要让队友使用 root 代替。

管理员验收：专用账号可以通过隧道打开网站；普通 SSH 执行命令被拒绝；转发其他端口和远程转发被拒绝。撤销成员时同时撤销 SSH 公钥与应用邀请。

账号配置完成后，成员在自己电脑运行（替换私钥路径及自己的账号）：

```sh
ssh -i "自己的私钥完整路径" -N -L 127.0.0.1:18080:127.0.0.1:18080 -o ExitOnForwardFailure=yes ps-tester02@118.89.156.215
```

首次连接核对管理员提供的主机指纹。连接窗口保持打开；浏览器打开 http://127.0.0.1:18080，使用自己的 Private invite token 登录。四人可使用相同本地端口，因为在各自电脑上。暂不使用域名分发，也不要让手机访问电脑的 127.0.0.1（那是手机自身）。

## 4. 第一轮测试：每人约 30 分钟

1. Explore：完成兴趣设置，检索两组真实关键词，查看摘要、论文原文链接，收藏和跳过。
2. Library：标记优先读、已读，刷新确认保存；检查导出。甲收藏独有论文后，乙确认自己的库不会出现甲的数据。
3. Schedule：安排日期、优先级、完成状态及周切换。当前安排与完成标记尚未完整持久化，刷新可能重置，不跨设备同步；用于交互测试，不作为正式日程工具。
4. Trending：切换榜单、展开主题及示例论文。榜单、数量和增幅是预置演示数据，不代表实时科研趋势。
5. 阅读助手：打开助手、尝试阅读计划和学习路线。当前是本地规则和预置路线，不是实时大模型问答，会话不持久保存，研究结论应核对原文。
6. 退出后确认需重新登录。管理员确认服务器重建后收藏仍在。每人每天检索/主题分析共 20 次，全站最多同时 2 个请求；等待和限额要与故障区分。

不启用生图或付费模型；保持 BETA_MODE=1。不要输入未公开敏感研究资料。检索会访问外部论文源，服务器健康检查成功不保证论文源可用。

## 5. 反馈记录

统一记录：测试成员 ID、时间、模块、操作步骤、预期结果、实际结果、设备/浏览器、已脱敏截图。不要记录邀请码、私钥、密码或完整配置。先处理不能登录、收藏丢失、跨账号泄漏、检索不可用，再处理显示和体验问题。

本轮自动验证：Go 测试和静态检查、使用模拟接口的浏览器导航检查。真实大陆服务器的论文检索、四人同时连接、数据备份恢复及 SSH 专用账号隔离，仍需按上述流程验收。
