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

## 最终提交的独立运行时与限定浏览器复验

控制者随后验证了提交 **6b245910e7599ddb64feb10733370796b5c881eb**，其中执行代码为 **49e6439**。这是本轮修复后的新增证据，与前面的旧提交记录分别保留。

**Node 22.12.0：2026-10-14T06:46:04Z–06:46:22Z。** 使用同一官方校验过的临时运行时，对该提交重新 git archive 到新目录。npm ci --ignore-scripts（同上官方 registry / 独立 cache 参数）安装成功：added 27 packages、audited 28 packages、found 0 vulnerabilities。npm test 为 **188 tests / 188 pass / 0 fail / 0 cancelled / 0 skipped**；npm run typecheck、npm run build、构建后 CLI demo --out 与 inspect --input 全部 **exit 0**。demo 为 simulated、6 条、verifiedNetwork=false；inspect 为 offline，保留原始时间和摘要，verifiedNetwork=false。该复现只覆盖只读增量，不代表完整产品部署或真实 V3。

**实际浏览器：2026-10-14T06:51:07Z。** 对应同一 6b24591，本地生产预览的复验范围如下：

| 本次复验场景 | 实际观察 |
| --- | --- |
| 初始空态 | 未连接，无默认活动连接 |
| URL 形式配置 ID / 别名 | 明确拒绝，未创建观测；本次未计量浏览器网络请求次数 |
| 人工模拟 | 明确模拟标签，6 条，best 105 / finalized 104，原始采集时间保留 |
| 非 RPC localhost 失败 | 发布失败记录，best / finalized 未知，不复用旧模拟的 105 / 104 成功数据 |
| Stop | 保留失败记录，状态切换离线 |
| 控制台 | 本次观察到 0 个错误 |

Node 22 与 Node 26 的三个生产浏览器产物逐字节一致：

| 产物 | 字节 | SHA-256 |
| --- | --- | --- |
| assets/index-BM2netaj.js | 254378 | 568170597aec40840aeee8e37fd4d7ff80c566521b00a756c47153e95262c062 |
| assets/index-CQUFryG3.css | 6119 | cc077c13a2cbaaf1b9d101444f56134ea4a1e3c7ef0badb321bae420dac318c2 |
| index.html | 420 | e767efa4196c667d07b342582e7433a7d305685ee75a87c87d277c84dd585d6a |

本次没有重跑实际下载、文件输入导入 / 篡改、390px 布局或 print-media 检查，这些证据仍只对应 **2f1a91e**。产物一致性不替代未重跑的浏览器场景，也不构成托管或远端读回证据。

## 紧凑端点写法的限定补正

独立复核在前述版本发现：已接受的 http:localhost/sensitive-path 写法会绕过要求 :// 的扫描快捷返回，公开来源字段和节点回显可保留原始端点。限定代码范围为 **bb82862..1d31ded7bd284519a68b57055c1291ad11e42ebd**，只改共享端点助手、快照证据摘要及新增回归。

先在重新编译的 bb82862 基线上运行 node --test tests/endpoint-closing.test.mjs，实际 **7 fail / 0 pass**，覆盖原文 / 规范化形式、节点紧凑等价回显、请求前公共字段拒绝、真实 localhost 传输到报告导入、摘要截断前保护和键名碰撞。最小修复后同样 7 项 **7 pass / 0 fail**；另补快照键名碰撞的异常记录测试，最终 npm test 为 **196 tests / 196 pass / 0 fail / 0 cancelled / 0 skipped**。npm run typecheck、npm run build、git diff --check 均退出 0，环境仍为实现者 Node 26.8.2 / npm 11.19.1。

1d31ded 当时先处理原始 / 规范化字符串，再核对支持 scheme 的 URL token；该顺序后来被发现会拆断完整等价 URL，已由下文 d58e695 的 round 1 调整。快照字符串和键名在有界截断前脱敏，碰撞显示异常而不静默覆盖；报告继续处理身份字段及严格导入。无关公共来源链接、异常数值、byte window、依赖和 RPC 白名单未扩展。此逻辑仍是针对配置端点的保护，不是任意秘密发现。

**补正后的独立复验：c6bf4a04373e055929ffed0d5b6798b7cbe55209，执行代码 1d31ded。** 控制者于 **2026-10-14T07:11:48Z–07:12:07Z** 使用官方校验过的临时 Node 22.12.0，将该提交 git archive 到全新目录。npm ci --ignore-scripts、npm test（**196 tests / 196 pass / 0 fail / 0 cancelled / 0 skipped**）、npm run typecheck、npm run build、构建后 CLI demo --out 及 inspect --input 全部 **exit 0**。demo 保持 simulated / 6 条 / verifiedNetwork=false，inspect 保持 offline / 原始时间与摘要 / verifiedNetwork=false。安装日志为 added 27 packages、audited 28 packages、found 0 vulnerabilities。

同一提交于 **2026-10-14T07:14:21Z**完成实际浏览器紧凑端点专项验证：输入紧凑 HTTP URL 连接人工本地 RPC 夹具，链名称及展开的 system_chain result 都显示 **[endpoint]**。未配置预期创世哈希，身份保持**未验证**；观察到 **4 条记录、夹具计量 36 次 RPC 请求**；Stop 后保留记录并显示 offline。此夹具明确**不是 Portaldot 网络**，不构成真实 V3 验证。专项没有重复下载、文件导入、390px 或打印检查。

新版三个浏览器产物已在 Node 22 / Node 26 间重新比对，逐字节一致：

| 产物 | 字节 | SHA-256 |
| --- | --- | --- |
| assets/index-B1MPIjXA.js | 254540 | ed4bbfbf36c91a7a01dbe42c5e2d3a145bcdc42cbe039f1c4a1805f2a92a2526 |
| assets/index-CQUFryG3.css | 6119 | cc077c13a2cbaaf1b9d101444f56134ea4a1e3c7ef0badb321bae420dac318c2 |
| index.html | 420 | c42207d96ca0d72106c10e80dd7ee7b787137b93f686ebac5170b7e4e7fbfc3c |

c6bf4a0 取得上述运行时 / 浏览器证据时，源码复核尚未完成；后续复核发现完整 URL 被字面替换拆断的顺序问题，由下文 d58e695 修正并通过限定复核。该历史浏览器专项只覆盖上述紧凑端点场景；6b24591 的其他限定浏览器证据及 2f1a91e 的下载 / 文件导入、390px / print-media 证据继续保留原提交归属。Task 4 的历史 RED 缺口没有补证或改写。

## 端点处理顺序补正 round 1

独立复核发现 1d31ded 的字面替换前置会把完整等价 URL 拆成残片，例如路径末尾再次出现相同配置路径时。代码 **d58e6951c2308a0935675232a30032a271f8cccd** 改为先核对完整支持 scheme 的 URL token，再无条件进行原文 / 规范化字符串 fallback；保留紧凑写法、截断前保护、碰撞检查和无关 citation。

在重新编译的 **0d58b71** 基线上，端点测试 **12 项 / 9 pass / 3 fail**，三个预期失败为直接组合等价形式，以及标准 / 紧凑配置的真实传输报告往返。修复后同一文件 **12/12**；全部模块为 **200/200**，typecheck / build 均通过。新增的精确 fallback 防回退检查初始即通过，没有被记作 RED。

**独立 Node 22.12：2026-10-14T07:34:06Z–07:34:23Z，revision=d58e695。** 官方校验的临时运行时、新 git archive 目录和 npm ci --ignore-scripts；install、npm test（**200 tests / 200 pass / 0 fail / 0 cancelled / 0 skipped**）、typecheck、build、构建后 CLI demo --out / inspect --input 全部 **exit 0**。安装 added 27 / audited 28 / found 0 vulnerabilities。CLI demo 保持 simulated / 6 条 / verifiedNetwork=false；inspect 保持 offline、原始时间和摘要、verifiedNetwork=false。

**实际浏览器：2026-10-14T07:45:24Z，revision=d58e695。** 人工本地 RPC 夹具明确不是 Portaldot；它回显含重复配置路径和 .. 的完整规范化等价 URL，界面链名称与展开的 system_chain result 都仅显示 **[endpoint]**。未提供 expected genesis，身份保持未验证；夹具计量 **27 次 RPC**。Stop 后 offline，并成功恢复模拟。该回执没有观测条数，不由请求次数推算条数；本次未复验控制台错误，也未重跑下载、文件导入、390px 或打印。

该版本 Node 22 / Node 26 的三个浏览器产物重新逐字节比对一致：

| 产物 | 字节 | SHA-256 |
| --- | --- | --- |
| assets/index-DK3QPmmH.js | 254540 | c22c2c5ddc24913057e596bbd0ade031baa925575c47a50b803ff9e3024573bb |
| assets/index-CQUFryG3.css | 6119 | cc077c13a2cbaaf1b9d101444f56134ea4a1e3c7ef0badb321bae420dac318c2 |
| index.html | 420 | 32b1a1267116dd170e3dc6b0a9a7bfbcc50385719bc3cd33859390746e7142b9 |

**独立限定源码复核已通过：固定范围 0d58b71..d58e695，原 Important 已标为 ADDRESSED，本次两文件小 diff 未发现新的 Critical / Important / Minor。** 原缺陷正向复现与共享配置请求前拒绝的独立检查均退出 0。结合既有只读增量审查和已同步证据，**限定只读 M1 源码已具备发布条件**；这是当时的发布准备结论，后续实际发布与回读见下文，仍不代表完成整项产品。新证据只覆盖上述 revision 和场景；旧浏览器下载 / 导入、390px、print-media 以及既有控制台观察均保留原来的提交归属。

## 限定只读 M1 源码与公开原型发布

**2026-10-14，源码 revision=55b9c47eebb4c520237af656aef1db68922975b8。** 控制者完成 [GitHub main 源码发布](https://github.com/JokerFuFu/portaldot-hacker-house-2026-portalpulse/tree/55b9c47eebb4c520237af656aef1db68922975b8)，并对 **43 个文件逐字节回读一致**。已验证的执行代码仍为 d58e695；此前测试与浏览器收据保持原提交归属，不倒填为新的测试执行。

**[公开只读 M1 原型](https://portalpulse-jokerfufu-2026-readonly.jokerfu.chatgpt.site)**：进入后点击“加载模拟会话”。没有默认活动端点，人工模拟不代表真实 Portaldot V3。

Sites 初始**版本 1**部署于 **2026-10-14T08:19:10Z** 成功，最初为 owner-private。随后按用户明确授权将 Access 切换为 **public（revision 2）**；保留这一先私有部署、后开放访问的顺序，不把最初收据改写为公开部署。

| 发布标识 | 值 |
| --- | --- |
| project ID | appgprj_6acf36997c488191b4df2d9382028e0f |
| version ID | appgprj_6acf36997c488191b4df2d9382028e0f~appgver_eed84fda66448191950bb79faac58797 |
| deployment ID | appgdep_6acf3af571848191b69c2085e2b8a604 |
| Site source commit | 7c5203c2787d362298bf5344247eee0a91962088 |
| canonical source commit | 55b9c47eebb4c520237af656aef1db68922975b8 |

**2026-10-14T08:32:47Z 匿名回读**：没有认证头，HTTP **200**，标题与 script 匹配；线上两个资产与部署产物逐字节一致：

| 线上资产 | 字节 | SHA-256 |
| --- | --- | --- |
| assets/index-DK3QPmmH.js | 254540 | c22c2c5ddc24913057e596bbd0ade031baa925575c47a50b803ff9e3024573bb |
| assets/index-CQUFryG3.css | 6119 | cc077c13a2cbaaf1b9d101444f56134ea4a1e3c7ef0badb321bae420dac318c2 |

控制者另在托管站实际浏览器读回**空态与加载模拟会话**。线上未新增验证文件上传 / 导入、下载、390px、打印或真实 RPC；旧场景证据仍只属于对应历史提交。源码发布、托管可访问及资产一致性不证明实链、合约或交易成功。后续文案或代码版本需由控制者单独推送、部署和回读，不能自动继承此处 55b9c47 / Sites 版本 1 的发布状态。

## 尚未验证及过程限制

Node 22.12 新目录复现已更新到 **d58e695**，其完整等价 URL 脱敏专项浏览器复验范围如上；该提交的独立限定源码复核已通过，发布准备结论仅适用于只读 M1 源码。A07 的下载 / 文件导入和篡改浏览器场景仍只有 **2f1a91e** 证据，不能自动扩大到最终修复版本。A09 仅补 **d58e695** 只读增量的干净环境复现及按提交记录的限定浏览器场景，完整产品仍未通过。A01 错误身份与 A02 实际超时的浏览器场景、完整键盘流、所有浏览器、真实 RPC CORS和打印 PDF 分页继续待验。源码 55b9c47 与 Sites 版本 1 的有限发布 / 回读范围见上文；后续版本不自动算作已发布或已回读。

Task 4 的 view-model / live-session 历史上缺少实现前可执行的行为 RED；本轮新增真实 RED 不补证或改写那段历史。真实 V3、完整 SCALE 解码、探针、交易执行 / 最终确认 / 状态回读、Check-in、最终提交、视频和 Deck 均仍待完成。A03–A08 的执行 / 探针场景和完整 A09 不能由 localhost 测试判通过。

## M2A 离线执行证据增量：实现者验证

**2026-10-14，代码 revision=a79281b4b0f2eec2f1bb5bfdaaa0d20299bb2a80，baseline=c333e57920f1af5a21dd11d815880636ba234902。** 本轮实现严格执行证据格式、纯离线六项校验、execution-inspect CLI、人工固定示例与行为测试。未修改依赖、M1 报告验证或 RPC 白名单；未接入钱包、网络采集或真实运行时。当前独立审查、公开源码发布及线上更新尚未执行，不能继承 M1 的发布状态。[格式与边界](execution.md)。

实现者实际使用官方已校验的临时 **Node.js 22.12.0（macOS arm64）**与已安装的锁定依赖。以下均为本轮真实执行，不复制此前 200 项作为本轮总数。

| 实际命令 / 步骤 | 实际结果 |
| --- | --- |
| npm run build:core（添加测试，尚未实现） | exit 0 |
| node --test tests/execution*.test.mjs（修正测试的缺失 API 门槛后，尚未实现） | **110 tests / 8 pass / 102 fail**，exit 1；缺少公开 evaluator/parser API，以及 CLI 未知命令；8 个原有拒绝输入行为已通过，不记为新功能 RED |
| node --test tests/execution*.test.mjs（初次实现） | **110 pass / 0 fail**，exit 0 |
| node --test --test-name-pattern='cycle back\|self-parent' tests/execution.test.mjs（新增终端 parent cycle 回归，修复前） | **2 tests / 0 pass / 2 fail**，exit 1；终端回指祖先与单块自指环错误地 normal |
| npm run build:core；node --test tests/execution*.test.mjs（终端 cycle 修复后） | 两命令 exit 0；**112 tests / 112 pass / 0 fail** |
| npm test（受限 sandbox） | exit 1；**312 tests / 225 pass / 87 fail**；87 项为 localhost listener 的 listen EPERM 环境拒绝，完整输出保留 |
| npm test（授权 localhost fixture listener 后） | exit 0；**312 tests / 312 pass / 0 fail / 0 cancelled / 0 skipped** |
| npm run typecheck | 两个 tsc 检查 exit 0 |
| npm run build | exit 0；Vite 8.3.4，24 modules transformed |
| node dist/cli/main.js execution-inspect --input examples/execution-simulated.example.json | exit 0；offline / simulated / evidenceComplete=true / status=normal；verifiedNetwork=false、writeAllowed=false、fullVerification=false；expected/observedSequence=9007199254740993 |
| node dist/cli/main.js demo --out （新的本地私有文件） | exit 0；simulated，6 条，verifiedNetwork=false；原始固定时间与摘要保留 |
| node dist/cli/main.js inspect --input （上述文件） | exit 0；offline，verifiedNetwork=false；采集历史陈旧仍显式 abnormal，离线有效导入不等于当前健康 |
| git diff --check | exit 0，无空白错误 |

RED/GREEN 的完整原始输出、sandbox 失败与后续成功输出均保存于忽略的本地实施证据区，未删除或改写最初的试运行。最初测试夹具生成遇到系统 Python/Xcode license 环境错误，已改用同一 Node 22.12 生成；缺失 API 导致负向 assert.throws 可能误过的测试在生产实现前增加公开 API 存在检查，并再次真实运行上述确认 RED。

新增测试覆盖逐阶段缺失、错误/缺失 genesis、主网/自定义网络拒绝、已知主网伪装 testnet、交易 / 索引 / 区块关联、失败执行不被后续读回覆盖、ancestry 链接 / 高度 / 精确两端 / 重复 / cycle、同块 finality、读回上下文与值、uint64 上界 / JS 精度边界 / 零、严格结构 / 非有限值 / 数组与字符串上限 / canonical 时间 / 时间倒退 / 大小写 / 非变异，以及真实 CLI 文件输入、退出码、错误输出与参数拒绝。所有执行事实均为人工构造，既有 HTTP/WS 测试仅运行命名 localhost 夹具。

此证据只确认离线内部一致性和本地行为。真实 V3 身份、完整运行时解码、探针部署与更新、钱包签名、live inclusion / execution / finality、固定最终区块状态回读、网页执行集成、统一执行报告、实链 A03–A08 / 完整 A09、Check-in、视频、Deck 与最终提交继续待完成。历史已知主网 genesis 仅作拒绝值，没有补造未知 V3 身份允许名单。

## M2A 矛盾缺项修复与验证检查点

**2026-10-14T15:12:12Z 验证检查点：M2A 公开发布在此检查点仍待控制者执行。** 上述 a79281b 的 112 / 312 结果及当时审查、发布待办保留原归属。本节补录两个实际修复版本；此检查点尚未完成最终限定复审、源码推送或远端回读，也没有上线执行界面。

**第一轮修复 revision=cc13082030ece14fb7c56f97634f724197d141ab，实际 commit 时间 2026-10-14T22:51:15+08:00。** 纳入记录自身的 transactionHash 与 transactions[index] 对比不再依赖 submitted 存在。既有完整原始输出和实际子进程退出回执记录：重新编译基线 exit 0；focused RED **116 tests / 114 pass / 2 fail，exit 1**（API 错误地 unverified、CLI 错误地 exit 2）；修复后的 focused GREEN **116/116，exit 0**；完整 npm test **316 tests / 316 pass / 0 fail / 0 cancelled / 0 skipped，exit 0**；typecheck、build 与构建后模拟样例均 exit 0。这些是第一轮实现者记录的运行，按 execution.ts SHA-256 `0a01796e6b5db4229b9965d29800e3afb4f9de1a11f7b4a6dba5428b4ceb12c2` 关联到 cc13082，不表述为本节新执行。

**最终修复代码 revision=83bae1a095b625e9ca0797f98ef50ceb021c7311，实际 commit 时间 2026-10-14T23:11:37+08:00，baseline=cc13082。** 已有 submission / execution 直接比较交易身份；finality 与已有 expected / observed genesis 分别比较，readback 与已有 expected / observed / finality genesis 分别比较。缺少中间证据不能掩盖可直接证明的矛盾；一致的缺项保持 unverified。没有推定缺失 identity / inclusion / finality，明确执行失败仍优先保留，既有索引、ancestry / cycle 和 expected / observedSequence 行为保持。

| 本次实际命令 | 时间（UTC，2026-10-14） | 实际结果 |
| --- | --- | --- |
| npm run build:core（新增测试，生产修复前） | 15:08:47–15:08:48 | exit 0 |
| node --test tests/execution.test.mjs tests/execution-cli.test.mjs（RED） | 15:08:48–15:08:51 | **147 tests / 137 pass / 10 fail / 0 cancelled / 0 skipped，exit 1**；5 项 API 为 unverified 而非 abnormal，5 项实际 CLI 为 2 而非 1 |
| npm run build:core（修复后） | 15:09:22–15:09:23 | exit 0 |
| node --test tests/execution.test.mjs tests/execution-cli.test.mjs（GREEN） | 15:09:23–15:09:27 | **147 tests / 147 pass / 0 fail / 0 cancelled / 0 skipped，exit 0** |
| npm test（授权 localhost 夹具监听） | 15:09:46–15:10:21 | **347 tests / 347 pass / 0 fail / 0 cancelled / 0 skipped，exit 0** |
| npm run typecheck | 15:10:15–15:10:16 | 两个 tsc 检查 exit 0 |
| npm run build | 15:10:16–15:10:18 | exit 0；24 modules transformed，既有 M1 网页资产名称保持 |
| node dist/cli/main.js execution-inspect --input examples/execution-simulated.example.json | 15:10:18 | exit 0；offline / simulated，六项 normal，evidenceComplete=true，三个验证 / 写入标志均 false，expected / observedSequence=9007199254740993 |
| 构建后 CLI 的两个原始重现场景及各自一致缺项控制 | 15:12:12 | 缺少 inclusion 的交易矛盾、缺少 observed genesis 的回读矛盾均实际 exit 1 / abnormal；对应一致缺项均实际 exit 2 / unverified，evidenceComplete=false，三个标志均 false |
| git diff --check | 15:11:37 | exit 0 |

上述 GREEN / 完整测试 / typecheck / build / 样例与提交的 execution.ts SHA-256 均为 `548c5713290d5a1f9ce4dce30e7336c49eb84b71bb745a1b93d820f5ade79b36`；测试文件也逐字节关联到同一代码提交，运行后没有修改生产代码或测试。typecheck / build / 样例在完整测试结束前运行，源代码与测试保持同一版本；完整日志和实际退出回执保存在私有实施证据区。新增 31 项行为检查覆盖全部已有 genesis 身份对、缺项一致控制、大小写和执行失败优先级；没有以实现计算预期结果。原始 RED / GREEN / 完整输出与全部历史证据均保留。

M1 发布事实仍独立归属：2026-10-14 的源码 c333e579 及 43 个远端文件回读、Sites 版本 2 的公开访问、匿名 HTML / JS / CSS 匹配和限定浏览器空态 / 模拟 / 待办文案检查已完成。本轮只纠正 design / roadmap 的过期待办措辞，没有进行新的线上核验或部署。M2A 仅离线 API / CLI；真实 V3、运行时解码、探针、钱包、执行采集、实链最终确认 / 状态回读与完整产品验收继续待完成。
