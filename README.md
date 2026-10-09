# PortalPulse

赛道：**Node Operations & Tooling（节点运营与开发工具）**。

**2026-10-09 状态：准备阶段，实施尚未开始。** 本仓库提供项目设计、未来验收标准、参赛交付清单、公开主网只读观测及一次失败的官方 V3 测试网只读预检。尚无应用源码、探针合约、可运行演示或测试通过记录；没有安装或启动命令。核心代码计划主要在 2026-10-14 00:00 至 2026-11-06 12:00（Asia/Shanghai）的比赛开发期内产生。

PortalPulse 面向 Portaldot 节点运营者与 DApp 开发者，计划帮助他们判断网络是否推进、调用在哪一阶段失败，以及执行后保存的状态是否与预期一致。它将分别展示 RPC 可达、区块推进、交易纳入、执行结果、最终确认和状态回读，并导出能按网络、交易和区块重新核对的记录。

## 计划交付的六个模块

| 模块 | 计划行为 |
|---|---|
| 网络身份与能力 | 展示配置来源、创世哈希和运行时；身份不符时禁止写入 |
| 节点监控 | 采集请求耗时、区块及最终确认推进，区分无响应、陈旧与无推进 |
| 执行回读 | 关联当前交易的执行结果，最终确认后核对探针状态 |
| 探针合约 | 在认可测试网上为每个发起者保存测试序号，完成更新与读回 |
| 报告与复核 | 导出带来源与 SHA-256 摘要的版本化 JSON 和可打印报告，支持重新导入 |
| 命令行工具 | 本机监测网络、输出相同结构报告，并区分失败、超时和未验证 |

首版计划提供 TypeScript / React / Vite 网页和 Node.js 22+ 命令行。合约开发版本、SDK 与具体依赖将在活动 V3 环境确认后核验并锁定，届时补齐安装、运行、部署和来源说明。探针只保存测试序号，不涉及资产转移、托管或质押。官方主网保持只读；部署和调用必须通过测试网身份与能力检查。

浏览器无法连接 RPC 时，计划支持导入真实命令行记录；导入显示原始采集时间与来源，不能作为实时在线监测。单一 RPC 的记录受提供者可信度限制，不能当作独立轻客户端共识证明。

## V3 接入准备状态

官方团队发布的 [V3 指南（固定版本）](https://github.com/ItsCogumellum/portaldot-v3-testnet-guide/tree/d671a32758573f4d9ab00d891b2dd6a48f36bcbb) 公布了 Substrate RPC `wss://testnetv3-node.feso-apps.xyz`、EVM RPC `https://testnetv3-eth-rpc.feso-apps.xyz`、Chain ID **420420777**、原生代币 **tPOTv3（精度 14）**及 [Node Explorer](https://node-console.feso-apps.xyz/)。这些是文档公布值。2026-10-09T08:49:30.897Z 开始的只读预检中，Substrate WebSocket 连接失败，EVM `eth_chainId([])` 返回 HTTP 502；未获得创世哈希、运行时、链 ID 响应或余额，也未验证部署或能力成功。完整记录与限制见[网络预检](docs/network-preflight.md)及[V3 只读证据](docs/evidence/v3-readonly-20261009.json)。

Substrate 保留为网络观测路径；指南中的 Revive / Solidity 是网络恢复后待验证的探针合约候选，编译器和运行时兼容性尚未实测。官方 PDK / FailLens 已覆盖基础开发与失败诊断；PortalPulse 的重点是持续监测、执行—最终确认—状态回读时间线及可导出复核记录，见[设计](docs/design.md)。

## 项目文档

- [产品流程与架构](docs/design.md)
- [未来验收标准](docs/acceptance.md)
- [阶段与时间线](docs/roadmap.md)
- [网络预检与待确认条件](docs/network-preflight.md)
- [Check-in 与最终提交清单](docs/submission-checklist.md)
- [2026-10-09 主网只读观测](docs/evidence/mainnet-readonly-20261009.json)
- [2026-10-09 V3 失败只读预检](docs/evidence/v3-readonly-20261009.json)

活动依据：[Portaldot V3.0 Hacker House 2026 详情](https://dorahacks.io/hackathon/portaldot-hacker-house-2026/detail)及[官方赛道页](https://dorahacks.io/hackathon/portaldot-hacker-house-2026/tracks)。准备文档不计作比赛期要求的至少三次有效代码提交。现有主网观测也不能替代 V3 测试网部署与真实交互证据。

许可：[MIT](LICENSE)，2026 PortalPulse contributors。当前仅有准备文档与公开 RPC 只读预检；后续使用的官方 SDK、框架及第三方依赖必须分别披露来源与许可。
