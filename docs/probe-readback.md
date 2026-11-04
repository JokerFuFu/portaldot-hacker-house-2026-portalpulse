# 原生探针只读回读

用指定的原生区块哈希和 extrinsic 哈希采集 PortalPulseProbe 的执行证据。此入口采用 Portaldot V3 的原生 Revive 事件以及 EVM 只读合约接口。探针部署和更新由参赛者用钱包完成，实际交易与合约地址需来自该次操作的回执。

## 2026-11-04 真实闭环

本人签名后的新部署与record(1)已完成，六阶段均normal，真实报告、浏览器导出/重导入和A4打印已验。[证据与可复现入口](live-chain-20261104.md)。以下命令用于新的近期交易，当前产品窗口最多32条父边。历史重放使用保存的JSON。

## 运行

需要 Node.js 22.12 或更新版本。安装锁定依赖，编译核心，再使用实际观测值替换命令中的环境变量。caller 使用探针事件所记录的 H160。原生地址到 H160 的映射需在实际签名路线中另行核对。

~~~sh
npm ci --ignore-scripts
npm run build:core
node scripts/observe-probe.mjs \
  --config examples/portaldot-v3-config-20261022.json \
  --evm-endpoint https://test-evm-rpc-v3.portaldot.dev \
  --block-hash "$NATIVE_BLOCK_HASH" --tx-hash "$NATIVE_EXTRINSIC_HASH" \
  --contract "$PROBE_H160" --caller "$CALLER_H160" \
  --expected-sequence "$SEQUENCE_DECIMAL" --submitted-at "$SUBMITTED_AT_UTC" \
  --out probe-report.json > probe-collection.json
node dist/cli/main.js execution-inspect --input probe-report.json
~~~

提交时刻是可选参数，由参赛者提供规范 UTC ISO 时刻，例如 2026-11-03T02:00:00.000Z。缺少该值时提交阶段为未验证。probe-report.json 可在网页“执行复核”导入并打印。probe-collection.json 保存采集诊断、两域区块对应和已观测但无法组成完整报告的原因，建议与报告同时保留。

## 采集逻辑

1. 匹配已核验的官方 V3 原生创世哈希，在给定块中找出目标 extrinsic 的确切索引。按父块运行时元数据完整解码交易和 System.Events。
2. 仅对目标 ApplyExtrinsic 索引读取探针合约的 SequenceRecorded。验证精确事件签名、ABI 格式、调用者和 uint64 序号。系统失败和同索引 Revive.EthExtrinsicRevert 优先保留为失败。
3. 从 RPC 给出的最终确认头向后逐块验证 SCALE 头哈希、父链接和高度。当前窗口最多 32 条父边，超过窗口或缺少头数据时保留未验证。
4. 检查 V3 EVM chain ID 420420777。用原生哈希别名和高度分别定位两域对应区块，要求 EVM 哈希一致。固定到对应的 EVM 哈希，并在纳入和最终确认位置核对现场代码与本地编译的探针运行时代码。
5. 在最终确认位置按区块哈希读 sequenceOf(caller)。按 uint64 十进制保留实际值。状态读回反映整个最终确认区块末尾的值，因此同一调用者后续更新也可能造成不匹配。

CLI 每次 RPC 默认 8 秒，整体采集最多 90 秒。退出码 0 表示报告中的阶段证据齐备，1 表示异常或输入/输出错误，2 表示证据缺失。文件独占创建。采集失败时仍保留已取得的报告事实及诊断。网页和 execution-inspect 重放的是报告内的证据，原始采集错误保存在 probe-collection.json。RPC 来源、署名者所有权、独立共识与存储证明仍处于各自的验证范围之外，报告的 verifiedNetwork、writeAllowed、fullVerification 始终为 false。

## 已验证范围

本地人工夹具覆盖完整链路、合约/调用者/序号不符、错交易 phase、revert、分叉、缺失、代码不符和哈希固定。另用官方 V3 近期公开历史交易验证了原生最终确认路径，另用空地址验证 EVM 哈希选择器和未知哈希拒绝。公开历史报告中的探针与调用者字段是零地址占位，执行和状态字段为空。该段为11月3日历史验证范围。11月4日实际新探针部署、record(1)及最终序号1已由产品采集器完成，见[真实闭环](live-chain-20261104.md)。保存的原始真实报告可直接用 execution-inspect 重放。不要用早已超出32父边窗口的历史块重新采集来替代报告重放。

- [历史报告](evidence/probe-readback-historical-report-20261103.json)
- [历史试读范围与观察记录](evidence/probe-readback-20261103.json)
- [区块哈希选择器规范](https://eips.ethereum.org/EIPS/eip-1898)
- [Revive 事件定义参考](https://paritytech.github.io/polkadot-sdk/master/yet_another_parachain_runtime/pallet_revive/enum.Event.html)
