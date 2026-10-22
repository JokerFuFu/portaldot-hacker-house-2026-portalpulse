# 锁定依赖与来源

**2026-10-22增量：** 新增三个精确锁定的开发依赖，用于本地探针编译与EVM测试；原只读网页运行依赖未改。下段10/14及后续清洁目录记录保持各自原归属，不代表今天重新做过新目录安装。

2026-10-14 实际从官方 npm registry 安装并读取包内 package.json。直接依赖全部精确版本，无 caret；package-lock.json 记录传递依赖、resolved 地址与完整性摘要。要求 Node.js >=22.12（Vite 8.3.4 的 Node 22 最低要求）；实现者本机 Node 26.8.2 / npm 11.19.1。提交 2f1a91e 已使用独立 Node 22.12.0、干净 git archive 新目录与 npm ci --ignore-scripts 完成 176/176 测试、类型检查、构建和构建后 CLI demo / inspect，均退出 0。本轮未修改依赖版本。最终修复代码 49e6439 所在提交 6b24591 又经独立 Node 22.12.0 干净 git archive 新目录、同样的 npm ci --ignore-scripts、188/188 测试、类型检查、构建及构建后 CLI demo / inspect，全部退出 0。该提交在 Node 22 与 Node 26 生成的 index.html、JS 和 CSS 三个浏览器产物逐字节一致。紧凑端点补正后的 c6bf4a0 也已用官方校验过的 Node 22.12.0、全新 git archive 目录和 npm ci --ignore-scripts 复现：196/196 测试、类型检查、构建及构建后 CLI demo / inspect 全部退出 0，三个新版浏览器产物在 Node 22 / Node 26 间重新逐字节比对一致。d58e695 的顺序补正又经独立 Node 22.12.0 全新 git archive / npm ci --ignore-scripts、200/200 测试、类型检查、构建及构建后 CLI demo / inspect，均退出 0；其 Node 22 / Node 26 三个浏览器产物重新逐字节比对一致。依赖版本没有改变。

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
| solc | 0.8.24 | 本地Solidity编译，build0.8.24+commit.e11b9ed9.Emscripten.clang | [ethereum/solc-js](https://github.com/ethereum/solc-js) | MIT（npm包元数据；编译器发行通知随包保留） |
| @ethereumjs/evm | 10.1.3 | 本地真实字节码消息/构造器测试 | [EthereumJS EVM](https://github.com/ethereumjs/ethereumjs-monorepo/tree/master/packages/evm) | MPL-2.0 |
| @ethereumjs/util | 10.1.3 | 本地EVM地址/账户/字节工具 | [EthereumJS util](https://github.com/ethereumjs/ethereumjs-monorepo/tree/master/packages/util) | MPL-2.0 |

安装命令：

~~~sh
npm --userconfig /dev/null --cache /private/tmp/portalpulse-npm-cache --registry https://registry.npmjs.org ci --ignore-scripts
~~~

Node.js 来源为 [nodejs/node](https://github.com/nodejs/node)，许可及第三方通知以其发行包为准；本仓库源码为 MIT。观测/执行报告的SHA-256用标准WebCrypto，探针产物用Node crypto。浏览器配置/文件与观测只保存在本机内存。新增编译器/EVM工具只供本地构建和测试，没有向网页加入钱包库、远程字体或遥测。

探针构建校验npm solc0.8.24的锁定integrity和实际soljson.js SHA256 `fb59b825b7d57f9de89cd9de2415b12aab1fcc7eb2573fd2bf5c9b969eacf4d9`，在产物中保留完整build、参数、源码和字节码摘要。此npm JS wrapper与solc-bin原始JS文件SHA不同，不能冒称两个文件字节一致；记录的长base64编译器载荷一致。实际工具链、paris目标和只读构造器结果的范围见[探针说明](probe-toolchain.md)，真实部署/调用仍待完成。
