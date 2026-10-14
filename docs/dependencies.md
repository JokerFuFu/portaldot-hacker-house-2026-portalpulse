# 锁定依赖与来源

2026-10-14 实际从官方 npm registry 安装并读取包内 package.json。直接依赖全部精确版本，无 caret；package-lock.json 记录传递依赖、resolved 地址与完整性摘要。要求 Node.js >=22.12（Vite 8.3.4 的 Node 22 最低要求）；实现者本机 Node 26.8.2 / npm 11.19.1。提交 2f1a91e 已使用独立 Node 22.12.0、干净 git archive 新目录与 npm ci --ignore-scripts 完成 176/176 测试、类型检查、构建和构建后 CLI demo / inspect，均退出 0。本轮未修改依赖版本。最终修复代码 49e6439 所在提交 6b24591 又经独立 Node 22.12.0 干净 git archive 新目录、同样的 npm ci --ignore-scripts、188/188 测试、类型检查、构建及构建后 CLI demo / inspect，全部退出 0。该提交在 Node 22 与 Node 26 生成的 index.html、JS 和 CSS 三个浏览器产物逐字节一致。

| 包 | 锁定版本 | 用途 | 来源 | 许可 |
| --- | --- | --- | --- | --- |
| typescript | 7.0.2 | 核心 / CLI / 网页检查与编译 | [Microsoft TypeScript](https://github.com/microsoft/TypeScript) | Apache-2.0 |
| react | 19.3.0 | 本地只读界面 | [React](https://github.com/react/react) | MIT |
| react-dom | 19.3.0 | 浏览器渲染与 SSR 测试 | [React](https://github.com/react/react) | MIT |
| vite | 8.3.4 | 本地服务与生产构建 | [Vite](https://github.com/vitejs/vite) | MIT |
| ws | 8.22.0 | Node localhost WebSocket 测试夹具；应用用原生 WebSocket | [websockets/ws](https://github.com/websockets/ws) | MIT |
| @types/node | 22.20.5 | Node 类型 | [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/node) | MIT |
| @types/react | 19.3.0 | React 类型 | [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/react) | MIT |
| @types/react-dom | 19.3.0 | React DOM 类型 | [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/react-dom) | MIT |

安装命令：

~~~sh
npm --userconfig /dev/null --cache /private/tmp/portalpulse-npm-cache --registry https://registry.npmjs.org ci --ignore-scripts
~~~

Node.js 来源为 [nodejs/node](https://github.com/nodejs/node)，许可及第三方通知以其发行包为准；本仓库源码为 MIT。SHA-256 用标准 WebCrypto；浏览器配置 / 文件与观测只保存在本机内存。当前无 UI 套件、远程字体、遥测、钱包库或合约 SDK。后续合约工具链需在真实 V3 环境确认后单独锁定和披露。
