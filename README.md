# PortalPulse

赛道：**Node Operations & Tooling（节点运营与开发工具）**。

**2026-10-17：官方替代 RPC 已公布，真实只读观测已完成。** 新端点返回 `PortaldotV3 Test`、运行时3002 /metadataV14，EVM Chain ID420420777与公告一致。修复新元数据超过1MiB的问题后，四次真实采集无RPC失败；身份仍未验证，CLI按预期退出2，未启用写入。修复通过45项聚焦、470项全套及类型/构建检查。现有打印、Deck与原型视频继续可用；探针部署、真实执行/回读和Check-in仍待完成。配置、可导入的真实历史报告、来源与限制见[10月17日接入记录](docs/v3-readonly-20261017.md)。下文带日期的进度保留其原检查点归属。

**2026-10-16 当前进度：离线原型的实际打印验收和 Check-in 材料已准备。** 五种合成场景共 26 页 A4 报告已检查，其中 65 块连续祖先链为 14 页；一次控制 WebCrypto 摘要延迟的浏览器导出→清空→释放测试没有触发旧下载。八页英文 Deck（PDF / 可编辑 PPTX）、92 秒无声英文字幕原型截图讲解和报告样例见[参赛材料索引](https://portalpulse-jokerfufu-2026-readonly.jokerfu.chatgpt.site/materials/)及[材料与验收范围](docs/checkin-materials.md)。视频由真实 UI 截图和实际 PDF 组成，不是连续操作录屏或实链演示。认可 V3 配置、探针部署、真实执行与回读、Check-in 和最终提交仍待完成。

**[打开公开只读 M1 演示](https://portalpulse-jokerfufu-2026-readonly.jokerfu.chatgpt.site)**，进入后点击“加载模拟会话”。这是人工模拟数据演示，没有默认网络连接，不是已验证的真实 V3。源码已在 [GitHub](https://github.com/JokerFuFu/portaldot-hacker-house-2026-portalpulse) 公开。

**2026-10-14 状态：只读 M1 源码与公开原型已发布。** TypeScript 核心、CLI、人工模拟会话、报告验证与 React 控制台已完成本机单元 / SSR / localhost 测试及构建。提交 2f1a91e 已完成独立 Node 22.12 新目录安装与复现，以及实际浏览器模拟、下载 / 导入、篡改拒绝、390px 布局、打印 CSS 和非 RPC 失败 / Stop 检查。最终修复代码 49e6439 所在提交 6b24591 已通过独立 Node 22.12 新目录安装、188 项测试、类型检查、构建及 CLI demo / inspect，并完成空态、非法 URL 标识拒绝、模拟、非 RPC 失败和 Stop 的实际浏览器复验。下载 / 文件导入、390px 与打印 CSS 仍仅有 2f1a91e 的证据；打印 PDF 分页、真实 V3 接入、探针合约、交易执行 / 最终确认 / 状态回读、Check-in、最终提交、视频和 Deck 仍待完成。本机测试不代表真实测试网部署；新增源码与托管回读事实见[开发证据](docs/development-evidence.md)。

M1 历史端点补正代码 **d58e695** 先识别完整 URL token，再无条件处理配置原文及规范化字符串，避免重复路径的等价 URL 留下残片。该提交已通过独立 Node 22.12 新目录安装、**200/200** 测试、类型检查、构建及 CLI demo / inspect。实际浏览器使用明确非 Portaldot 的人工本地 RPC 夹具，验证含重复路径和 .. 的完整等价回显：链名称和 system_chain 结果都仅为 [endpoint]；缺少预期创世哈希时身份未验证，测得 27 次夹具 RPC，Stop 后离线并恢复模拟。本次未重验下载、文件导入、390px、打印或控制台错误。**d58e695 的独立限定源码复核已通过，原端点问题已关闭，限定只读 M1 源码可发布。** 随后 main 的 55b9c47 已公开并完成 43 个文件逐字节回读；公开网站匿名 HTTP 200，线上 JS / CSS 与部署产物逐字节一致。托管浏览器仅验证空态和加载模拟；真实 V3 与完整产品验收仍未完成。

PortalPulse 面向 Portaldot 节点运营者与 DApp 开发者，计划帮助他们判断网络是否推进、调用在哪一阶段失败，以及执行后保存的状态是否与预期一致。它将分别展示 RPC 可达、区块推进、交易纳入、执行结果、最终确认和状态回读，并导出能按网络、交易和区块重新核对的记录。

M2A 另提供本地[离线执行证据校验](docs/execution.md)：六项独立检查关联网络、提交、纳入、执行、最终确认路径和状态回读。固定示例与测试完全人工合成；正常只代表所给事实内部一致，始终 `mode=offline`、`verifiedNetwork=false`、`writeAllowed=false`、`fullVerification=false`。真实运行时解码、探针、签名、RPC 执行采集、实链读回仍待完成；本地网页执行复核见下述 M2C；公开只读 M1 网站不会因此自动更新。

**M2B 执行报告已于 2026-10-15 公开交付。** 最终校验代码为 3e7b607，文档检查点为 d842530；最终聚焦测试 **139/139**、完整测试 **424/424**、类型检查与构建通过，52 个公开源码文件及源码 ZIP 经匿名远端逐字节回读一致。初始 117a84c 的 419/419 是此前检查点，不能作为最终修订的测试归属。核心 / CLI 支持完整紧凑执行报告导出和严格导入，各限 **1 MiB UTF-8**，保留来源、原始时间、缺失 / 失败事实及大整数序号。SHA-256 仅检测内容改动；M2B 不包含托管执行界面或真实 V3 执行。详见[执行报告](docs/execution.md)与[开发证据](docs/development-evidence.md)。

**2026-10-16 M2C：离线执行复核网页已公开到原演示地址。** 默认“网络观测”保留原流程；切换“执行复核”停止采集并保留两种报告各自的状态。支持模拟、原始证据 / 严格执行报告的文件导入或粘贴、六阶段事实一致性报告、紧凑导出、打印入口和清空。输入全文限 **1 MiB UTF-8**，网络报告仍限 16 MiB；失败保留有效报告，旧异步结果不能覆盖较新操作。所有执行始终 offline，三个验证 / 写入标志永久为 false。初始代码 b54945c 的完整测试为 **453/453**；R1 反馈修复代码 812a8e2 为聚焦 **106/106**、完整 **460/460**。最终对齐行为代码 9b0f6e4 也已通过当前聚焦 **106/106**、全套 **460/460**、类型检查与构建；实现及证据检查点 f8249d3 已公开。

控制者在 **812a8e2** 的实际浏览器检查覆盖默认 M1 / 模拟、切换后分别保留网络 best 105 与 RPC 来源执行报告、六阶段 / 来源 / 原始时间 / uint64、clear→simulate 新提示、export→有效报告粘贴新提示、canonical 大小写篡改拒绝且保留原摘要、缺项未验证 / 执行失败异常 / RPC 来源仍离线及三个 false 标志；390×844 下 inner / document / body 宽均为 390，截图检查后已恢复视口。**2511 字节实际下载、严格核心重导入和文件选择器重导入仅对应 b54945c**；后续未改动该导出 / 核心路径，但没有把旧结果冒称每次修复都重验。对齐后的实际键盘复验已完成：桌面及 390 像素视口均定位到离线来源和结论开头，已恢复默认视口。

实际 print-media / 打印分页已于 **2026-10-16** 补验：完整、缺失、失败、RPC 来源、65 块长祖先链的实际 Chrome A4 导出共 26 页，保留来源、原始事实 / 时间、序号、摘要及离线限制；编辑器、操作和非活动视图不进入报告。一次控制 pending WebCrypto digest 的真实浏览器导出→清空→释放测试，等待摘要完成后观察到零次下载点击、报告为空、清空提示保留。该结果限定于所验场景。行为源码与既有 106 / 460 测试归属不变，本次没有重复跑套件。原公开 Site 的应用发布版本 **3** 保留 succeeded/public 交付证据；本轮材料发布另行记录。此站点版本不表示 Portaldot V3 实链已验证。认可 V3 身份、运行时、账户映射、测试币、探针、live 执行 / 最终确认 / 状态回读、Check-in 和最终提交仍待完成。详见[执行网页用法](docs/execution.md)与[材料](docs/checkin-materials.md)。

## 计划交付的六个模块

| 模块 | 计划行为 |
|---|---|
| 网络身份与能力 | 展示配置来源、创世哈希和运行时；身份不符时禁止写入 |
| 节点监控 | 采集请求耗时、区块及最终确认推进，区分无响应、陈旧与无推进 |
| 执行回读 | 关联当前交易的执行结果，最终确认后核对探针状态 |
| 探针合约 | 在认可测试网上为每个发起者保存测试序号，完成更新与读回 |
| 报告与复核 | 导出带来源与 SHA-256 摘要的版本化 JSON 和可打印报告，支持重新导入 |
| 命令行工具 | 本机监测网络、输出相同结构报告，并区分失败、超时和未验证 |

当前只读增量提供 TypeScript 7.0.2 / React 19.3.0 / Vite 8.3.4 网页和 Node.js >=22.12 命令行，依赖已锁定，见[依赖来源与许可](docs/dependencies.md)。合约工具链与 SDK 仍待活动 V3 环境确认后核验。探针只保存测试序号，不涉及资产转移、托管或质押。官方主网保持只读；部署和调用必须通过测试网身份与能力检查。

浏览器支持导入命令行记录；导入显示原始采集时间与来源，不能作为实时在线监测。单一 RPC 的记录受提供者可信度限制，不能当作独立轻客户端共识证明。

## 本地运行

需要 Node.js >=22.12 与 npm。当前 M2C 检查使用 Node 22.12.0 与既有锁定依赖；M1 独立新目录复现的历史检查点为 d58e695，浏览器历史证据按场景分别对应 2f1a91e、6b24591、c6bf4a0 和 d58e695。M2B / M2C 的后续检查与浏览器归属见上文。每轮验证的提交、命令和范围见[开发证据](docs/development-evidence.md)。

~~~sh
npm --userconfig /dev/null --cache /private/tmp/portalpulse-npm-cache --registry https://registry.npmjs.org ci --ignore-scripts
npm test
npm run typecheck
npm run build
npm run dev
~~~

开发服务在终端显示 localhost 地址。生产预览用 npm run preview；浏览器产物为 dist/site，构建保留 dist/cli、dist/core 和 dist/demo。以上命令只生成本地文件，不发布网站。

~~~sh
node dist/cli/main.js demo
node dist/cli/main.js demo --out /private/tmp/portalpulse-demo-report.json
node dist/cli/main.js inspect --input /private/tmp/portalpulse-demo-report.json
node dist/cli/main.js execution-inspect --input examples/execution-simulated.example.json
node dist/cli/main.js execution-report --input examples/execution-simulated.example.json --out /private/tmp/portalpulse-execution-report.json
node dist/cli/main.js execution-inspect --input /private/tmp/portalpulse-execution-report.json
~~~

输出路径必须不存在。模拟会话显示人工数据及固定采集日期；导入 JSON 永远显示离线与原始采集时间。网页默认“网络观测”且未连接，按“加载模拟会话”查看网络示例，或“导入 JSON”检查记录。自定义只读配置填完后须手动开始；停止、修改配置、切换执行复核和卸载界面都会中止旧网络请求。身份缺少预期创世哈希时保持未验证。HTTP 端点须允许 CORS，HTTPS 页面还受浏览器混合内容规则限制。

M1 监测报告导出紧凑 JSON 与导入都限 16 MiB；采集同时按 2,000 条和完整 UTF-8 报告字节预算保留最新观测，并显示累计丢弃条数及实际窗口时间。错误不会丢弃已有有效报告。SHA-256 只检测改动，不证明来源真实或单一 RPC 之外的共识。数据留在本机，刷新前先导出；配置端点原文及 URL 规范化等价形式不写入报告；ID / 别名中的 URL 会在请求前拒绝，其他公共来源链接保留。见[本地开发证据](docs/development-evidence.md)与[CLI 用法](docs/cli.md)。

## V3 接入准备状态

**现行状态（10/17）：** 替代配置已公布并完成只读观测，详见[新记录](docs/v3-readonly-20261017.md)。以下10/09–16说明与旧域名均为历史；部署继续等待独立身份依据、映射、资金和工具链核验。

**历史配置已失效，等待新的官方配置。** 2026-10-10 实际读取到主办方 Titus 于 10 月 9 日 17:40（北京时间）的[说明](https://discord.com/channels/1440212664751099996/1479446495643303997/1558051618581389395)：测试网正在升级，旧 RPC 信息不再可用，配置完成后将公布最新 RPC。下述指南地址仅保留为历史公布值，不能据此启用部署或写入。2026-10-14 上午核对的指南 main 仍为下述版本。同日已读取官方频道，并于北京时间 14:40 再次核对：当前读取到的[官方人员 LevelMax 于 10:15 的回复](https://discord.com/channels/1440212664751099996/1497976354157887680/1559751380879544332)尚未确认替代 RPC、恢复时间、首批 tPOT V3 发放，以及可推荐的官方本地节点 binary 或 chain spec。此状态只代表上述核验时点；旧地址不作为现行配置，本轮未重新探测旧 RPC，也未验证真实 V3 网络身份。

2026-10-15 09:43（北京时间）的[官方回复](https://discord.com/channels/1440212664751099996/1497976354157887680/1560105814705049772)仍未确认新的 EVM RPC / Chain ID / WebSocket、领币频道及地址格式、浏览器。此为该时点的资料状态，旧配置继续只作历史记录。

2026-10-16 10:12（北京时间）的[官方回复](https://discord.com/channels/1440212664751099996/1497976354157887680/1560475616669601833)仍未确认可用的 V3 端点、当前 Chain ID、方法 / 传输 / CORS 或本地 V3 源码 / binary。本段为控制者当日读取的时点状态，不推定恢复日期。

官方团队发布的 [V3 指南（固定版本）](https://github.com/ItsCogumellum/portaldot-v3-testnet-guide/tree/d671a32758573f4d9ab00d891b2dd6a48f36bcbb) 公布了 Substrate RPC `wss://testnetv3-node.feso-apps.xyz`、EVM RPC `https://testnetv3-eth-rpc.feso-apps.xyz`、Chain ID **420420777**、原生代币 **tPOTv3（精度 14）**及 [Node Explorer](https://node-console.feso-apps.xyz/)。这些是文档公布值。2026-10-09T08:49:30.897Z 开始的只读预检中，Substrate WebSocket 连接失败，EVM `eth_chainId([])` 返回 HTTP 502；未获得创世哈希、运行时、链 ID 响应或余额，也未验证部署或能力成功。完整记录与限制见[网络预检](docs/network-preflight.md)及[V3 只读证据](docs/evidence/v3-readonly-20261009.json)。

Substrate 保留为网络观测路径；指南中的 Revive / Solidity 是网络恢复后待验证的探针合约候选，编译器和运行时兼容性尚未实测。官方 PDK / FailLens 已覆盖基础开发与失败诊断；PortalPulse 的重点是持续监测、执行—最终确认—状态回读时间线及可导出复核记录，见[设计](docs/design.md)。

## 项目文档

- [10/17 官方新配置与真实只读观测](docs/v3-readonly-20261017.md)
- [产品流程与架构](docs/design.md)
- [离线执行证据与 CLI](docs/execution.md)
- [未来验收标准](docs/acceptance.md)
- [阶段与时间线](docs/roadmap.md)
- [网络预检与待确认条件](docs/network-preflight.md)
- [Check-in 与最终提交清单](docs/submission-checklist.md)
- [2026-10-09 主网只读观测](docs/evidence/mainnet-readonly-20261009.json)
- [2026-10-09 V3 失败只读预检](docs/evidence/v3-readonly-20261009.json)
- [2026-10-13 官方排期观察记录](docs/evidence/event-schedule-20261013.json)

活动依据：[Portaldot V3.0 Hacker House 2026 详情](https://dorahacks.io/hackathon/portaldot-hacker-house-2026/detail)及[官方赛道页](https://dorahacks.io/hackathon/portaldot-hacker-house-2026/tracks)。准备文档不计作比赛期要求的至少三次有效代码提交。现有主网观测也不能替代 V3 测试网部署与真实交互证据。

许可：[MIT](LICENSE)，2026 PortalPulse contributors。当前包含准备文档、历史只读预检与本地只读监测代码；已用依赖见来源清单，后续 SDK 与合约工具链须继续披露。
