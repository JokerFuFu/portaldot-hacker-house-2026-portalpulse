# Running and hosting PortalPulse

The browser console is a static readonly application. Node.js collectors run separately on the operator's machine. No server, wallet secret or signed-transaction API is needed to host the console or review a saved report.

## Local build

Use Node.js >=22.12 and the exact package-lock.json, including development dependencies.

~~~sh
npm ci --ignore-scripts
npm test
npm run typecheck
npm run build
npm run preview
~~~

Production application output is dist/site. Vite base is ./, so script/style URLs work under a project path. For a static release with materials and evidence, copy only the public directories:

~~~sh
cp -R docs/materials/20261104-final dist/site/materials
cp -R docs/evidence dist/site/evidence
cp LICENSE dist/site/LICENSE
touch dist/site/.nojekyll
~~~

The materials page references a final source ZIP and release.json. Generate the ZIP from the exact reviewed source commit with git archive, keep it out of its own source tree, and add its byte count/hash/commit to release.json. Copy both to the hosted materials directory. Do not copy local wallets, environment files, caches, operator logs or a whole workspace.

## Published host

The latest public release uses the existing public project's GitHub Pages branch, gh-pages, root path. Static branch contents come from the reviewed build and material inventory; application source remains on main. Publication requires an actual successful Pages build and anonymous HTML/asset/media readback, not just a branch push.

The older Sites console remains a historical host. On November 4 its original public URL still worked, but get_site for the original ID returned project_not_found and the account's site list was empty. It was not republished or replaced with a duplicate Sites project. Its earlier real browser acceptance retains its own release scope.

## Probe deployment and collection

See [toolchain](probe-toolchain.md), [native collector](probe-readback.md) and [actual November 4 deployment/update](live-chain-20261104.md). Before a new deployment, independently confirm the current organizer-source testnet identity, selected native/H160 account mapping, funds, transaction fee and finite storage-deposit budget. The participant reviews and signs in the wallet. Do not use a mainnet or infer authority from a matching address alone.

The live collector has a 32-parent-edge window and 90-second deadline. Use a recent transaction for a fresh collection and retain both the report and diagnostics. Saved real JSON is the reproducible historical-review route. Browser imports retain offline/source limitations; they never enable writes.
