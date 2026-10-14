# 本地只读增量开发证据

2026-10-14。本页只记录实现者本机验证：Node.js 26.8.2、npm 11.19.1、macOS arm64。独立 Node 22.12 新环境复现、真实浏览器键盘 / 下载 / 上传 / 打印 / 响应式验收和托管读回尚未执行。没有真实 V3 接入、探针、钱包、签名、交易或提交证据。

| 实际命令 | 实际结果 | 范围 |
| --- | --- | --- |
| npm --userconfig /dev/null --cache /private/tmp/portalpulse-npm-cache --registry https://registry.npmjs.org install --ignore-scripts | added 23 packages, changed 1 package; audited 28 packages; found 0 vulnerabilities | 官方 registry；直接依赖精确锁定 |
| npm test | tests 176; pass 176; fail 0; cancelled 0; skipped 0 | 核心 / RPC / 快照 / 分析 / 报告 / CLI，加 8 个网页行为测试 |
| npm run typecheck | tsc --noEmit 与 tsc -p tsconfig.web.json --noEmit 均退出 0 | Node / DOM / React 源码类型 |
| npm run build | Vite 8.3.4; 23 modules transformed; built in 73ms | dist/site 生产网页；保留核心与 CLI |
| node dist/cli/main.js demo（生产构建后） | mode=simulated; verifiedNetwork=false; sampleCount=6 | CLI 构建没有被 Vite 清空；人工模拟数据 |
| node dist/cli/main.js demo --out /private/tmp/portalpulse-task4-demo-20261014.json | exit 0; origin=simulated; mode=simulated; status=normal; verifiedNetwork=false | 使用全新文件路径保存完整模拟报告 |
| node dist/cli/main.js inspect --input /private/tmp/portalpulse-task4-demo-20261014.json | exit 0; mode=offline; freshness=abnormal; original dates retained | 有效摘要不代表当前在线；固定模拟时间已陈旧 |
| git diff --check | 退出 0，无输出 | 修改无空白错误 |

网页行为测试用纯 view-model、React renderToStaticMarkup 与真实 localhost HTTP 传输，未用 DOM / 传输 mock 声称浏览器成功。包括：来源与模式、best / finalized / stale 独立状态、未验证元数据保持未验证、来源 / 别名 / 错误按文本转义、无默认连接、JSON / 摘要 / 超限错误保留之前有效报告，以及 Stop / 配置替换取消延迟请求，防止旧结果发布。

大报告测试为 1,200 条合法模拟观测：紧凑 UTF-8 JSON **15,520,132** 字节，可重新导入；同一报告缩进 JSON **17,374,248** 字节，超过 **16,777,216** 字节上限。网页导出使用紧凑格式，校验实际 UTF-8 字节和共享 schema / SHA-256，无额外换行。界面 / 打印用于阅读。

A01 / A02 / A07 仅有单元、SSR 和 localhost 验证；真实链完整验收仍待完成。A03–A08 的执行 / 探针场景与完整 A09 新环境复现不能由这些测试判通过。Check-in、最终提交、最多三分钟视频与 Pitch Deck 仍待交付。公开发布前还需独立评审、真实浏览器证据与公开交付隐私检查。
