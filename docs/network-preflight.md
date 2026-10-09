# 2026-10-09 网络只读预检

这是一次有时间边界的公开 RPC 观测，未发送交易、部署合约或签名调用。它证明所记录时点主网端点返回了列出的结果，不能证明活动 V3 测试网已经可用，也不能作为连续可用性或当前在线状态证据。

## 成功主网观测

来源端点：`wss://mainnet.portaldot.io`。观测时间：**2026-10-09T06:11:37.820Z**（北京时间 2026-10-09 14:11:37.820）。完整成功记录：[mainnet-readonly-20261009.json](evidence/mainnet-readonly-20261009.json)，保留原始字段和结果；文件仅含该主网记录。

| 项目 | 返回内容 |
|---|---|
| system_chain | Portaldot Mainnet |
| system_properties | ss58Format 42；tokenSymbol POT；tokenDecimals 14 |
| 运行时 | specName portaldot；specVersion 1002；implName substrate-node；implVersion 0；authoringVersion 10；transactionVersion 2 |
| 报告的主网创世哈希（chain_getBlockHash 返回值） | `0x83b5212c69f85f3996f8696bb35bf913af51b176a5f53d0a74fd3a83dc0b8a54` |
| chain_getFinalizedHead | `0x34b5f1fbe951360c9fb41ce86ef6f0789db301cf752e7e9b6931209cc9eca114` |
| 元数据 | 前缀 `0x6d6574610d`，版本 V13，153205 bytes |
| rpc_methods | version 1；报告 93 个方法 |
| legacy 合约 RPC | contracts_call、contracts_getStorage、contracts_instantiate、contracts_rentProjection |
| EVM 相关命名 | 该端点所报列表未出现 eth_ 或 evm_ 前缀方法 |

原始记录没有保存请求参数，因此无法仅从保存的 JSON 证明 `chain_getBlockHash` 使用了高度 0。上述哈希沿用预检的主网创世标识；实施时必须用 `chain_getBlockHash(0)` 显式重新核验，并留存参数，才用于主网写入拒绝。身份未确认前不启用任何写入。

RPC 列表声明有某方法，不等于方法已实际调用成功。本次只读记录没有验证 legacy 合约部署、交易执行、钱包集成或工具链兼容。没有 eth_ / evm_ 命名的结论只限该端点、该时点的所报列表，不能推广为 V3 网络没有 EVM 能力。

## 第三方节点失败观测

参考端点：`wss://drip-node-production.up.railway.app`。观测时间：2026-10-09T06:11:37.867Z（北京时间 14:11:37.867）。结果为空，错误为 `WebSocket connection error`。

失败原因尚未确定；不能据此称该主机永久不可用。该失败没有混入名为 mainnet-readonly 的成功证据 JSON；也没有把第三方节点认作主办方活动 V3 测试网。

## 官方公布的 V3 配置与失败预检

官方团队的英文 V3 指南于 2026-10-03 发布；本次依据 [README / FAQ 固定版本](https://github.com/ItsCogumellum/portaldot-v3-testnet-guide/tree/d671a32758573f4d9ab00d891b2dd6a48f36bcbb)，revision 为 `d671a32758573f4d9ab00d891b2dd6a48f36bcbb`（2026-10-07）。以下配置与工作流是指南公布内容，不能当作 RPC 返回值或本项目验证结果。

| 项目 | 官方文档公布值 |
|---|---|
| Substrate RPC | `wss://testnetv3-node.feso-apps.xyz` |
| EVM RPC | `https://testnetv3-eth-rpc.feso-apps.xyz` |
| EVM Chain ID | 420420777 |
| 原生代币 | tPOTv3；精度 14 |
| Node Explorer | [Node Explorer](https://node-console.feso-apps.xyz/)；尚未验证查询结果 |
| 合约候选路径 | Solidity / Revive；经 EVM 工具或原生 `reviveApi` / `Revive.call` 交互，尚未验证编译器、SDK 或运行时兼容性 |

只读预检始于 **2026-10-09T08:49:30.897Z**（北京时间 16:49:30.897）。完整原始记录：[v3-readonly-20261009.json](evidence/v3-readonly-20261009.json)。未签名、发送交易或部署合约。

| 路径 | 时间（UTC） | 实际结果 |
|---|---|---|
| Substrate WebSocket | 08:49:30.898 至 08:49:33.023 | `WebSocket connection error`；未建立连接，未发送原生 RPC 请求 |
| EVM `eth_chainId([])` | 请求 08:49:31.088；结束 08:49:32.396 | HTTP 502，HTML 错误页；没有链 ID 响应 |

这是有时间边界的失败观测，不能断言端点永久不可用，也不能由此归因网络故障。尚未观察到 V3 创世哈希、运行时、metadata、EVM 链 ID 响应、余额、部署或能力成功；Chain ID 420420777 仍仅为文档公布值。失败结果独立保存，没有混入主网证据。

## 仍须核验的 V3 接入条件

| 条件 | 当前证据状态 |
|---|---|
| 官方 V3 RPC 与配置来源 | 已公布，端点实测失败；恢复后须重新只读核验 |
| 测试网创世哈希、网络身份、运行时与 metadata | 尚未取得 |
| EVM 实际 Chain ID 与账户映射 | 尚未取得链 ID 响应；映射尚未查询 |
| 测试币领取路径 | 有日期的官方说明拟在 RPC 更新后手动分发；当前领取方式及到账未验证 |
| explorer / 等效查询方式 | Node Explorer 已公布，查询能力未验证 |
| 合约工具链、SDK 版本及 VM 接口 | Revive / Solidity 已有官方工作流，实际兼容与部署未验证 |

正式写入必须回读全部接入条件。主网保持只读，拒绝已知主网创世哈希；测试网身份不符、能力未知或元数据不足也禁止写入。Substrate 用于网络观测，Revive / Solidity 为待验证的合约候选，不要求同时实现 legacy WASM 与 EVM，也不把旧主网 rent-era Contracts / ink! 配置直接套用到 V3。跨 VM 可组合性尚未验证。

原生账户与 H160 映射须以 `reviveApi.accountId` 的实际查询为依据；原生到 EVM 账户注资前必须先查询该映射，不能从已有 SS58 地址推定 EVM 部署者。完整边界见[设计](design.md)。

## 分层来源

- **活动官方规则**：[本届 V3 Hacker House 详情](https://dorahacks.io/hackathon/portaldot-hacker-house-2026/detail)与[赛道页](https://dorahacks.io/hackathon/portaldot-hacker-house-2026/tracks)，用于参赛资格与交付要求。
- **官方公开链资料**：[Chain Info](https://portaldot-dev.readthedocs.io/en/latest/chain-info.html)，列出主网 WebSocket、SS58 42 和 POT 精度 14；该页面属于 Developer v1 文档，不等于本届 V3 测试网配置。
- **官方 SDK 文档修正线索**：[DeveloperPlatform PR 1](https://github.com/portaldotVolunteer/DeveloperPlatform/pull/1)、[PR 2](https://github.com/portaldotVolunteer/DeveloperPlatform/pull/2)，作为后续版本适配核验入口，不代表本项目已验证该 SDK 可用。
- **第三方 legacy WASM 参考**：[portaldot-contract-zero README](https://github.com/jonathan-moore58/portaldot-contract-zero#readme)，仅为第三方参考，不作为活动接入配置或本项目合约已部署的证据。
- **官方 V3 指南**：[固定版本 README / FAQ](https://github.com/ItsCogumellum/portaldot-v3-testnet-guide/tree/d671a32758573f4d9ab00d891b2dd6a48f36bcbb)，用于上述文档配置与 Revive / Solidity 候选路径；运行态仍待验证。
- **直接 V3 RPC 结果**：[失败只读记录](evidence/v3-readonly-20261009.json)，用于本次连接错误与 HTTP 502。
- **直接 RPC 结果**：[成功主网记录](evidence/mainnet-readonly-20261009.json)，所有具体主网返回值以该观测为依据。
