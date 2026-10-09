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

## 尚未确认的活动 V3 条件

| 条件 | 当前证据状态 |
|---|---|
| 主办方认可的 V3 测试网 RPC | 尚未确认 |
| 测试网创世哈希、网络身份和运行时 | 尚未确认 |
| faucet / 测试币领取路径 | 尚未确认 |
| explorer / 浏览器或等效查询方式 | 尚未确认 |
| 合约工具链、SDK 版本及 VM 接口 | 尚未确认 |

正式写入必须回读全部接入条件。主网保持只读，拒绝已知主网创世哈希；测试网身份不符、能力未知或元数据不足也禁止写入。EVM 适配仅在官方接口确认并实测后加入，不从宣传或 legacy 主网反推活动配置。详细边界见[设计](design.md)。

## 分层来源

- **活动官方规则**：[本届 V3 Hacker House 详情](https://dorahacks.io/hackathon/portaldot-hacker-house-2026/detail)与[赛道页](https://dorahacks.io/hackathon/portaldot-hacker-house-2026/tracks)，用于参赛资格与交付要求。
- **官方公开链资料**：[Chain Info](https://portaldot-dev.readthedocs.io/en/latest/chain-info.html)，列出主网 WebSocket、SS58 42 和 POT 精度 14；该页面属于 Developer v1 文档，不等于本届 V3 测试网配置。
- **官方 SDK 文档修正线索**：[DeveloperPlatform PR 1](https://github.com/portaldotVolunteer/DeveloperPlatform/pull/1)、[PR 2](https://github.com/portaldotVolunteer/DeveloperPlatform/pull/2)，作为后续版本适配核验入口，不代表本项目已验证该 SDK 可用。
- **第三方 legacy WASM 参考**：[portaldot-contract-zero README](https://github.com/jonathan-moore58/portaldot-contract-zero#readme)，仅为第三方参考，不作为活动接入配置或本项目合约已部署的证据。
- **直接 RPC 结果**：[成功主网记录](evidence/mainnet-readonly-20261009.json)，所有具体主网返回值以该观测为依据。
