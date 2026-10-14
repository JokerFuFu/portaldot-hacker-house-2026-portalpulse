# 本地只读增量开发证据

2026-10-14。本页按提交区分实现者验证、独立最低运行时复现和实际浏览器观察。没有真实 V3 接入、探针、钱包、签名、交易或提交证据。全部浏览器及 RPC 测试使用本地人工数据或命名 localhost 夹具。

## 原提交的独立复现

提交 **2f1a91eea623c4f4852b6ab56e8eb3c18732d91f**。独立控制者于 2026-10-14T03:34:52Z–03:35:05Z 使用干净 git archive、新目录及 **Node.js 22.12.0（macOS arm64）**运行以下流程。Node 运行时来自 nodejs.org 官方 v22.12.0 发行包，已与官方 SHASUMS256.txt 校验；仅用于临时验证，没有全局安装。

| 实际步骤 / 命令 | 结果 | 范围 |
| --- | --- | --- |
| npm --userconfig /dev/null --cache /private/tmp/portalpulse-npm-cache --registry https://registry.npmjs.org ci --ignore-scripts | exit 0 | 新目录、锁定依赖、官方 registry |
| npm test | 176 tests / 176 pass / 0 fail; exit 0 | 核心、CLI、网页模型与 localhost 传输 |
| npm run typecheck | exit 0 | 核心和网页 TypeScript |
| npm run build | exit 0 | dist/site；保留 dist/cli、dist/core、dist/demo |
| node dist/cli/main.js demo --out （新的临时文件） | exit 0；mode=simulated；verifiedNetwork=false | 构建后 CLI 人工模拟仍可运行 |
| node dist/cli/main.js inspect --input （上述文件） | exit 0；mode=offline；原始时间保留 | 保存与离线导入往返 |

## 原提交的实际浏览器观察

同一提交 **2f1a91e**，控制者于 **2026-10-14T04:05:53Z**记录实际浏览器结果，访问本地生产预览。以下为脱敏后的观察摘要，不包含用户文件目录或账号资料。

| 操作 | 实际观察 | 边界 |
| --- | --- | --- |
| 加载模拟会话 | 明确模拟与未连接标签；6 条观测；best 105 / finalized 104 | 人工数据，不是 V3 |
| 下载 JSON 并用核心独立导入 | 下载文件 19,076 字节；摘要 6bbce53e82846430f03f661a9c3b54ff5d0255e9dc86e018b5a1475d0a12a661；导入成功 | 验证实际下载内容，不是点击即视为完成 |
| 文件输入导入 | 显示离线；原始结束时间 2026-10-14T00:00:50.100Z | 不证明当前在线 |
| 篡改导入 | 明确拒绝并保留原有效报告 | A07 的本地报告场景 |
| 390px 视口 | pageWidth=bodyWidth=390；无横向溢出 | 一种窄屏宽度；不是所有设备 |
| print-media | CSS 生效，操作与配置隐藏；检查后恢复媒体状态 | 没有验证实际打印 PDF 分页 |
| 手动连接非 RPC localhost 后 Stop | 失败可见，best / finalized 未知，无旧正常数据复用；停止后离线 | 非 RPC 失败不是错误身份或真实 8 秒超时场景 |
| 控制台 | 观察到的错误数 0 | 此次操作范围 |

## 最终修复波次

代码范围 **2f1a91e..49e643979fd5ceb1bf500a8164453290ee910c31**。实现者环境 **Node.js 26.8.2 / npm 11.19.1 / macOS arm64**。先新增 9 个行为回归，实际结果 **0 pass / 9 fail**，分别确认端点规范化泄露、非有限数值阻断报告、合法宽观测溢出和公共标识在拒绝前已经发出请求。生产修复后这 9 项全部通过，另补充默认端口 / 主机名大小写等价、严格非有限值导入拒绝及异常 CLI 报告保存，总计新增 12 项。

| 实际命令 | 实际结果 |
| --- | --- |
| node --test tests/final-regressions.test.mjs（最初 9 项，修复前） | 9 fail / 0 pass；预期行为失败 |
| node --test tests/final-regressions.test.mjs（最初 9 项，修复后） | 9 pass / 0 fail |
| npm test | **188 tests / 188 pass / 0 fail / 0 cancelled / 0 skipped** |
| npm run typecheck | 两个 tsc 检查均 exit 0 |
| npm run build | exit 0；Vite 8.3.4，24 modules transformed |
| node dist/cli/main.js demo --out （新的临时文件，生产构建后） | exit 0；simulated；6 条；verifiedNetwork=false |
| node dist/cli/main.js inspect --input （上述文件） | exit 0；offline；verifiedNetwork=false |
| git diff --check | exit 0，无空白错误 |

新回归使用真实 localhost HTTP → 快照 → 报告 → 导入，覆盖原始 / 规范化端点、JSON 1e999、异常观测后健康直播、128 个合法长方法名的 2,000 次 CLI 观测、完整 UTF-8 字节窗口及连续发布。直播窗口测试只把测试时钟中的 10 秒轮询等待压缩；传输、采样、报告、摘要与导入仍是真实实现，因此不构成长时间浏览器性能证明。现有 count 上限、CLI 参数、schema、非有限值拒绝、HTTP / WS、取消和离线模式回归保持通过。

报告按观测数及完整序列化 UTF-8 大小共同保留最新窗口，累计 discarded/droppedSamples，起止时间属于实际保留观测。端点脱敏只针对配置端点及 URL 标准规范化等价形式，不宣称发现任意秘密；无关公开来源链接继续保留。不可表示的节点数值变为有界诊断文本并保留异常 validation 记录，导入器仍拒绝原始非有限数字。

## 尚未验证及过程限制

上述 Node 22.12 新目录和实际浏览器证据对应 **2f1a91e**，不能自动扩大到 **49e6439**；本轮新增代码尚待独立复核及浏览器重验。A07 仅补本地浏览器报告篡改场景；A09 仅补当时只读增量的干净环境复现，完整产品仍未通过。A01 错误身份与 A02 实际超时的浏览器场景、完整键盘流、所有浏览器、真实 RPC CORS、打印 PDF 分页、公开托管和远端最终代码回读继续待验。

Task 4 的 view-model / live-session 历史上缺少实现前可执行的行为 RED；本轮新增真实 RED 不补证或改写那段历史。真实 V3、完整 SCALE 解码、探针、交易执行 / 最终确认 / 状态回读、Check-in、最终提交、视频和 Deck 均仍待完成。A03–A08 的执行 / 探针场景和完整 A09 不能由 localhost 测试判通过。
