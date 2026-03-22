## [0.3.2](https://github.com/jamesainslie/mdview/compare/mdview-v0.3.1...mdview-v0.3.2) (2025-12-02)


### Documentation

* **changelog:** remove duplicate 0.2.0 section ([2e2cfd5](https://github.com/jamesainslie/mdview/commit/2e2cfd5b698b77d8c88244a3a0ed86ba6751de88))

## [0.3.5](https://github.com/yaklabco/mdreview/compare/mdview-v0.3.4...mdview-v0.3.5) (2026-03-22)


### Features

* add One Dark Pro theme, colorful icon themes, compact folders, and preferences panel redesign ([eb61796](https://github.com/yaklabco/mdreview/commit/eb6179601c589186fd0ca6ea10b61569cbef74bd))
* annotation format v2 ([32c7d66](https://github.com/yaklabco/mdreview/commit/32c7d66680feb63dd0710eedf98ea39725b1d112))
* **comments:** add comment manager orchestrating CRUD and file writes ([dbfb279](https://github.com/yaklabco/mdreview/commit/dbfb279b50f9b9026b561162b4b0948243620766))
* **comments:** add comment parser for extracting footnote comments ([c090d18](https://github.com/yaklabco/mdreview/commit/c090d18a1e9f887cd7764299e1ce9237411cc7fd))
* **comments:** add comment serializer for markdown footnote operations ([e6bedb3](https://github.com/yaklabco/mdreview/commit/e6bedb3f2a915e33a0984e69beed9fdcba4f0d65))
* **comments:** add comment UI with cards, gutter, context menu, and input form ([3aaa6e6](https://github.com/yaklabco/mdreview/commit/3aaa6e6d716a3857a18260221e4d51c7c9841a37))
* **comments:** add native messaging host for file writes ([304edb2](https://github.com/yaklabco/mdreview/commit/304edb24b89ea01ba3ecaa30ac8d6fbd40d86f5f))
* **comments:** add replies, reactions, tags, and context menu ([615f425](https://github.com/yaklabco/mdreview/commit/615f4257f08d23b1d140875578b32544bedd9dea))
* **comments:** add source position map, comment context, and emoji data ([b762c9a](https://github.com/yaklabco/mdreview/commit/b762c9a35cbd641ed4a63da4fe8a09a3f3c3e3b6))
* **comments:** add text highlight module for comment markers ([7b0ebc0](https://github.com/yaklabco/mdreview/commit/7b0ebc0bebd5fdb6f2f080f1bdd7caac1fb1f773))
* **comments:** implement annotation format v2 with citation-style markers ([37d7231](https://github.com/yaklabco/mdreview/commit/37d7231169f04e4e05f258c37644f1da533d7a5e))
* **comments:** integrate comment manager into content script ([87aee0a](https://github.com/yaklabco/mdreview/commit/87aee0a9a0ba8269c240504103d61385a5e61f38))
* **core:** define platform adapter interfaces ([994190f](https://github.com/yaklabco/mdreview/commit/994190f7ae3f117ac7fa7ac8ead2e52d768029fa))
* **core:** extract and render YAML frontmatter as collapsible card ([73afffa](https://github.com/yaklabco/mdreview/commit/73afffaa3c71557f53d3ab267d65b360478cdd5a))
* **css:** add comment system styles, gutter layout, and responsive breakpoints ([84d6c8e](https://github.com/yaklabco/mdreview/commit/84d6c8e242aae102b2b7df881c900fca9b2e4c53))
* **electron:** add electron-builder config and placeholder icons ([60b030a](https://github.com/yaklabco/mdreview/commit/60b030add7f2e8de935b28287e647923b17266c4))
* **electron:** add keyboard shortcuts, drag-drop, and file tree sidebar ([5b423ac](https://github.com/yaklabco/mdreview/commit/5b423ac450eb28a97681da86e78fec3bd30f037a))
* **electron:** add main process, IPC handlers, state manager, and renderer adapters ([d54a9f9](https://github.com/yaklabco/mdreview/commit/d54a9f986279688f6d2fcd4fb656681d15c07ea8))
* **electron:** add main-process adapters, IPC channels, and preload bridge ([94ed62a](https://github.com/yaklabco/mdreview/commit/94ed62ade033fdcb9d1d264b0cc152288cc5e2ad))
* **electron:** add menu bar, file dialogs, recent files, and workspace state model ([ef1544a](https://github.com/yaklabco/mdreview/commit/ef1544acd8322b13782c7a6b15a733251885ecd7))
* **electron:** add preferences panel with live preview and keyboard shortcut ([6716178](https://github.com/yaklabco/mdreview/commit/6716178b46728d483fdf354c0c16685727e89160))
* **electron:** add renderer viewer with full rendering pipeline ([722229a](https://github.com/yaklabco/mdreview/commit/722229ac297dd0b22c14d87c380e8b6ad2696e92))
* **electron:** add session restore, wire all workspace features, polish main process ([84c82c5](https://github.com/yaklabco/mdreview/commit/84c82c57fd10d65c33b867329c624d316dcbfe30))
* **electron:** add status bar with document metadata ([9512e31](https://github.com/yaklabco/mdreview/commit/9512e31dee01bae28bcd98da6a9b503c30330ea8))
* **electron:** add tab bar, document context, and multi-document renderer ([72808cb](https://github.com/yaklabco/mdreview/commit/72808cb3b58110da27ef4b266eb1429f430937bf))
* **electron:** add workspace CSS and IPC plumbing for sidebar width/open external ([f197dfd](https://github.com/yaklabco/mdreview/commit/f197dfdb46bccc888eef91c317fb9cee74215a57))
* **electron:** scaffold Electron package with stub entry points ([4a74701](https://github.com/yaklabco/mdreview/commit/4a74701e7d3ce5aeb48541e713cdc02cfbd1218b))
* **electron:** wire menu commands, theme/prefs handlers, resizable sidebar, render progress ([189649f](https://github.com/yaklabco/mdreview/commit/189649fe0c454a367264a02d53b70d849eee78c4))
* implement persistent margin comments ([aa52927](https://github.com/yaklabco/mdreview/commit/aa529273bb41526066d7f5e51a97d4a406bdf9f2))
* **pipeline:** integrate comment parser into render pre-parse stage ([959eb35](https://github.com/yaklabco/mdreview/commit/959eb35bcff936fd332d40c34b2489ad22a99363))
* rebrand mdview to mdreview across all packages ([4cf004f](https://github.com/yaklabco/mdreview/commit/4cf004fd46413108ee1ec19522d7f7344f89c048))
* render YAML frontmatter as collapsible card ([08cb660](https://github.com/yaklabco/mdreview/commit/08cb6609797937b9a3e317114930b6187d73761e))
* **settings:** add comment author name and enable toggle to options and popup ([e9b30f5](https://github.com/yaklabco/mdreview/commit/e9b30f5e34364025855954e9f66f304ef06ae781))
* **themes:** add comment highlight and card CSS variables to all themes ([1c76632](https://github.com/yaklabco/mdreview/commit/1c76632a66362acc27b81324d3604fff0f9ce643))
* **types:** add comment type definitions ([479a653](https://github.com/yaklabco/mdreview/commit/479a653a963b4b018f110c5feb629ba7cf7941ee))


### Bug Fixes

* **chrome-ext:** add build and dev scripts to package.json ([b9678ee](https://github.com/yaklabco/mdreview/commit/b9678eefa6ad9a80ae95c1dea8f0f4a42a231eec))
* **comments:** add card minimization, improve highlight robustness ([1a24bea](https://github.com/yaklabco/mdreview/commit/1a24bea44d62389525f01e996719ed14dfc7561c))
* **comments:** address code review findings ([0410622](https://github.com/yaklabco/mdreview/commit/041062288b1462edcebd61930bdc15aa71786eb4))
* **comments:** floating cards, native host fixes, write safety ([409368b](https://github.com/yaklabco/mdreview/commit/409368bcd13073bf89562a01e38042bdcc9de77d))
* **comments:** support cross-node text highlighting ([4934b7a](https://github.com/yaklabco/mdreview/commit/4934b7a1359c9eb9c00a5ab775722bd96f01c597))
* **core:** improve mermaid cache race handling and renderer robustness ([04c755d](https://github.com/yaklabco/mdreview/commit/04c755da5d4fd9cb66992655567b362bafaa302b))
* **electron:** resolve runtime bugs preventing markdown rendering ([db55bac](https://github.com/yaklabco/mdreview/commit/db55bac8794a04aa93236c7c5974cce6864b6a31))
* **electron:** set worker format to ES for renderer build ([c774e39](https://github.com/yaklabco/mdreview/commit/c774e393b4a0c030fbb64b96fb30f5503bcd4fe2))
* **test:** add comment color properties to mock theme and fix type errors ([d202ee4](https://github.com/yaklabco/mdreview/commit/d202ee47041378cf4d506c8dbd30d63fe06a5735))
* **tests:** repair vi.mock factories for Node built-ins and class constructors ([235293b](https://github.com/yaklabco/mdreview/commit/235293b6c6671794c792809c468fad16903a88da))
* update root theme-engine test to expect 9 themes ([e1adb5b](https://github.com/yaklabco/mdreview/commit/e1adb5b1cb0c99ae1904c0f3efa7ef9d9e5940c5))


### Code Refactoring

* **chrome-ext:** consolidate adapter classes into src/adapters/ ([4e931f6](https://github.com/yaklabco/mdreview/commit/4e931f68ec81ecb627cfa5a619ed616407eee1c9))
* **core:** add barrel export for @mdview/core ([6b2e88b](https://github.com/yaklabco/mdreview/commit/6b2e88ba9d7310ed457f9db9045a126a5635ca4b))
* **core:** add barrel exports for TOC renderer, lazy section renderer, and comment UI ([306ca21](https://github.com/yaklabco/mdreview/commit/306ca2179df4d5c58c23de72e44b6c5d039a3d69))
* **core:** add FileScanner to barrel export ([4610406](https://github.com/yaklabco/mdreview/commit/4610406d2d755b756e30608750ba94a4a423e71d))
* **core:** extract comment-manager with FileAdapter and IdentityAdapter ([b05200f](https://github.com/yaklabco/mdreview/commit/b05200ff4e5687b5d9f758f90020c46c4e736ad7))
* **core:** extract debug-logger with StorageAdapter ([0d2287e](https://github.com/yaklabco/mdreview/commit/0d2287ebbba040e7ddb8d1adc1f2e5925b621f23))
* **core:** extract DEFAULT_STATE and DEFAULT_PREFERENCES to @mdview/core ([c0cd82b](https://github.com/yaklabco/mdreview/commit/c0cd82b37c445dd9c5d1466d6ec1e2997b70c2b9))
* **core:** extract file-scanner with MessagingAdapter ([055c462](https://github.com/yaklabco/mdreview/commit/055c462cfc0684fb01d38991d2e93debdf8ff7a7))
* **core:** extract file-scanner with MessagingAdapter ([76eb366](https://github.com/yaklabco/mdreview/commit/76eb366c43288d1ea693d493cacec589b95a32c4))
* **core:** extract render-pipeline with MessagingAdapter ([df11f56](https://github.com/yaklabco/mdreview/commit/df11f560bc84afddd761913b2b03f4466dfac2cf))
* **core:** extract theme-engine with StorageAdapter ([34d7c8e](https://github.com/yaklabco/mdreview/commit/34d7c8e751ee4b231645595e41ffc9160f60a9cd))
* **core:** move comment parsers and serializers to @mdview/core ([f2db9ab](https://github.com/yaklabco/mdreview/commit/f2db9aba151400b3c649035a79ca9397d626373e))
* **core:** move comment UI modules to @mdview/core ([58ff331](https://github.com/yaklabco/mdreview/commit/58ff331a96d824afadbc7396b12e93ea3990de4f))
* **core:** move DOM utilities to @mdview/core ([341982f](https://github.com/yaklabco/mdreview/commit/341982f7d5648984fc3e6f479931941ed4694ff1))
* **core:** move export modules to @mdview/core ([d07db38](https://github.com/yaklabco/mdreview/commit/d07db38d2d85bbfd75f860a695814d82fa9df60d))
* **core:** move markdown-converter, cache-manager, frontmatter to @mdview/core ([8c6a3c9](https://github.com/yaklabco/mdreview/commit/8c6a3c9d4d83484fb233ad423451cdf92a1595d2))
* **core:** move pure utility modules to @mdview/core ([a96ec94](https://github.com/yaklabco/mdreview/commit/a96ec9452f840b31b2997b8f2e6221580a5b2664))
* **core:** move renderers to @mdview/core ([f3b48c6](https://github.com/yaklabco/mdreview/commit/f3b48c63005ea62b8d3485d9a020afd9a569200f))
* **core:** move shared content.css to @mdview/core/styles ([d80bb96](https://github.com/yaklabco/mdreview/commit/d80bb9649ff37c2ad9f6ee44cac1cc8a4ef985aa))
* **core:** move theme data modules to @mdview/core ([995c97f](https://github.com/yaklabco/mdreview/commit/995c97ff4cd31b506d5a4b5d9d7958e8e2943cee))
* **core:** move type definitions to @mdview/core ([31fe07e](https://github.com/yaklabco/mdreview/commit/31fe07e3c9645018e71262c5ae0623b9bcd693b3))
* **core:** move worker modules to @mdview/core ([5b9d5e7](https://github.com/yaklabco/mdreview/commit/5b9d5e7a9893b7155d0acaaf43093392d1a1178b))
* **core:** promote applyTheme and watchSystemTheme to core ThemeEngine ([2bb19da](https://github.com/yaklabco/mdreview/commit/2bb19da62a1606229ed438a2e53759255600640c))
* extract @mdview/core and monorepo structure ([7805588](https://github.com/yaklabco/mdreview/commit/7805588f8df7de4a57939bd8e7c5f43feebae884))
* move Chrome extension to packages/chrome-ext ([f0253d0](https://github.com/yaklabco/mdreview/commit/f0253d01124f8c49ed5173abcec7fc2b9c71a011))


### Documentation

* add margin comments feature design ([b98b052](https://github.com/yaklabco/mdreview/commit/b98b0521315af13f439b0b4c32389ca7ce57c907))
* add margin comments implementation plan ([a521aef](https://github.com/yaklabco/mdreview/commit/a521aef2b7ffe275d8b7c3ada4e59b418505e725))
* rewrite README for design review focus and update all docs ([17391c0](https://github.com/yaklabco/mdreview/commit/17391c065f53ed7b0b6b4bca9df7f76c4ae5593c))


### Tests

* **comments:** add integration tests for full comment lifecycle ([c8e0d66](https://github.com/yaklabco/mdreview/commit/c8e0d66e5373e3df50da225782c9985dfa980233))


### Build System

* migrate from npm to bun + turborepo ([608966e](https://github.com/yaklabco/mdreview/commit/608966e5c38fa650de4535ee7f3c8ac7632a646f))

## [0.3.4](https://github.com/jamesainslie/mdview/compare/mdview-v0.3.3...mdview-v0.3.4) (2025-12-06)


### Features

* **options:** add configurable TOC style option ([13d7dc9](https://github.com/jamesainslie/mdview/commit/13d7dc90d1e19bd4d02bb255b3c194772760f6d0))


### Bug Fixes

* **css:** resolve styling conflicts and improve specificity ([0ecebca](https://github.com/jamesainslie/mdview/commit/0ecebca3e7665a3cefb4b49c47e10e37d15b1570))
* **deps:** resolve security vulnerabilities in mermaid-cli dependencies ([5a439cf](https://github.com/jamesainslie/mdview/commit/5a439cf4947e8e79d2664f147e98cfa900044099))
* **test:** update test mocks for vitest 4.0 compatibility ([4567bae](https://github.com/jamesainslie/mdview/commit/4567bae7ac9cfbd085f734b47e0f188a17e771e1))

## [0.3.3](https://github.com/jamesainslie/mdview/compare/mdview-v0.3.2...mdview-v0.3.3) (2025-12-03)


### Features

* **content:** add site blocklist controls ([cf167c6](https://github.com/jamesainslie/mdview/commit/cf167c6c585adeb26589e1c6d647a291ed9e5dc6))
* **content:** check blocklist before rendering markdown ([b30519d](https://github.com/jamesainslie/mdview/commit/b30519d97274b7c77c8c092fc8113ec63440a7d8))
* **options:** add blocklist management UI ([d93325d](https://github.com/jamesainslie/mdview/commit/d93325d875b42e4b09b9396790d676c5d9e41aca))
* **popup:** add quick site blocking toggle ([769b37c](https://github.com/jamesainslie/mdview/commit/769b37c8b7c65a6eb1099f52c7eba6b4001eaf85))
* **popup:** move site block toggle to footer ([dd50310](https://github.com/jamesainslie/mdview/commit/dd5031077c35aaa39e2a94e66a31653dbe9f7e60))
* **types:** add blockedSites preference for site filtering ([cd5998f](https://github.com/jamesainslie/mdview/commit/cd5998f4f622947b24410fd6afaca449573eb199))
* **utils:** implement site blocklist pattern matching ([71ccb04](https://github.com/jamesainslie/mdview/commit/71ccb049b34f192f21546bfa909dfb4069dd481c))


### Bug Fixes

* **content:** scope markdown styles to mdview ([98cf300](https://github.com/jamesainslie/mdview/commit/98cf300adf1a2279392906357e4af5d332f19ec4))
* **pdf:** add missing return statement in prepareSvgsForPrint ([5a885ee](https://github.com/jamesainslie/mdview/commit/5a885ee9520f757cf6d209a196dff5f617a61814))
* **popup:** ensure wildcard blocklist removal uses host string ([39f5804](https://github.com/jamesainslie/mdview/commit/39f580463b5d5a7142c3e5e0661a090606156aad))


### Documentation

* **changelog:** fix version ordering ([bc89abc](https://github.com/jamesainslie/mdview/commit/bc89abc51b3642263a60f433c3b15b76b7616b50))


### Tests

* **utils:** add unit tests for blocklist functionality ([a90e897](https://github.com/jamesainslie/mdview/commit/a90e897506f6680144eb4fe72599185214d6f964))

## [0.3.1](https://github.com/jamesainslie/mdview/compare/mdview-v0.3.0...mdview-v0.3.1) (2025-12-02)


### Documentation

* **changelog:** remove manual unreleased section ([eaf770f](https://github.com/jamesainslie/mdview/commit/eaf770f71be1d6696e040f34f288da47469a246f))

## [0.3.0](https://github.com/jamesainslie/mdview/compare/mdview-v0.2.8...mdview-v0.3.0) (2025-12-02)


### chore

* **release:** release 0.3.0 ([1fa50b4](https://github.com/jamesainslie/mdview/commit/1fa50b4e364ecb4c77f15396340df7565384f4b8))


### Features

* **export:** add document export to DOCX and PDF with SVG diagrams ([198719e](https://github.com/jamesainslie/mdview/commit/198719ee063cda9f14451a30aa9e00a5f380abd6))


### Bug Fixes

* **lint:** resolve eslint errors in export modules ([197c628](https://github.com/jamesainslie/mdview/commit/197c628c6809937308c2c0ed9f9e8f92531fab53))

## [0.2.8](https://github.com/jamesainslie/mdview/compare/mdview-v0.2.7...mdview-v0.2.8) (2025-12-01)


### Features

* **core:** strip original TOC when custom TOC enabled ([9703a40](https://github.com/jamesainslie/mdview/commit/9703a407d14fa33455303ee4f477cdf2c476e982))
* **core:** strip original TOC when custom TOC enabled ([38f2f55](https://github.com/jamesainslie/mdview/commit/38f2f556261a46a0ea383772fe59ff144877406f))


### Tests

* **core:** add edge case tests for TOC stripper ([f0aeb81](https://github.com/jamesainslie/mdview/commit/f0aeb8162372021e38adb9a4d209ca7740131098))

## [0.2.7](https://github.com/jamesainslie/mdview/compare/mdview-v0.2.6...mdview-v0.2.7) (2025-11-28)


### Features

* **branding:** update extension icons to window frame design ([5e7e1ae](https://github.com/jamesainslie/mdview/commit/5e7e1aeeab6819b8bd75b5f772dc96d6e29b2234))
* **branding:** update icons and fix version sync ([1751058](https://github.com/jamesainslie/mdview/commit/17510588d5c21eb6e70e612dd46923ac6c66cfd5))


### Documentation

* **branding:** update readme logo images ([731d131](https://github.com/jamesainslie/mdview/commit/731d131a6f94b5d8a4fb6407c82f2c272c6e0728))
* **readme:** fix broken links and revert logo to original ([20951b6](https://github.com/jamesainslie/mdview/commit/20951b62e96596d1051558165c6746ccbe36ed63))


### Build System

* **manifest:** auto-sync version from package.json ([5c694ed](https://github.com/jamesainslie/mdview/commit/5c694edc3eb97e61e91e33b4f9f5519fa1a64e8c))

## [0.2.6](https://github.com/jamesainslie/mdview/compare/mdview-v0.2.5...mdview-v0.2.6) (2025-11-28)


### Documentation

* **readme:** remove non-working ci badges ([efce24a](https://github.com/jamesainslie/mdview/commit/efce24a3caed32fd9d0e48aecf44a584ecc0eea3))
* **readme:** remove non-working ci badges ([e7d6157](https://github.com/jamesainslie/mdview/commit/e7d61577261166bdc021777fb3af33badb8c582e))

## [0.2.5](https://github.com/jamesainslie/mdview/compare/mdview-v0.2.4...mdview-v0.2.5) (2025-11-28)


### Features

* **ci:** add makefile build system and optimize ui ([f1ece96](https://github.com/jamesainslie/mdview/commit/f1ece96a86bbd4f91890fc33f527bd9405a18dd0))
* **ci:** creat a Makefile ([c642f28](https://github.com/jamesainslie/mdview/commit/c642f28a7a75f53040f33d628d47744f7b38851b))
* **options:** add attribution footer for consistency ([2f26149](https://github.com/jamesainslie/mdview/commit/2f26149f10baca0bbe516684408d277386eb214d))


### Code Refactoring

* **popup:** optimize layout and add attribution footer ([4519922](https://github.com/jamesainslie/mdview/commit/4519922bb355d32587fa92941a565f35ce677ae6))


### Documentation

* **readme:** document makefile build system ([e918871](https://github.com/jamesainslie/mdview/commit/e918871bc88f35647fa8d2f8b12a14574efb408c))

## [0.2.4](https://github.com/jamesainslie/mdview/compare/mdview-v0.2.3...mdview-v0.2.4) (2025-11-28)


### Bug Fixes

* **docs:** add branch parameter to github actions badges ([10a6262](https://github.com/jamesainslie/mdview/commit/10a62620dd2ec9dda7b489873a813760f11d8203))
* **docs:** add branch parameter to github actions badges ([5cd3658](https://github.com/jamesainslie/mdview/commit/5cd36584d0d1d12d1551b4ed22be3a2166f45350))

## [0.2.3](https://github.com/jamesainslie/mdview/compare/mdview-v0.2.2...mdview-v0.2.3) (2025-11-28)


### Features

* **content:** integrate table of contents into content script ([a765cee](https://github.com/jamesainslie/mdview/commit/a765cee430383b37bf7942b8f937d69222ec7600))
* **core:** add HTML rendering configuration support ([7da9ba8](https://github.com/jamesainslie/mdview/commit/7da9ba83da7e79360f067a83c3d09b1848658499))
* **ui:** add table of contents controls to popup and options ([7c8439c](https://github.com/jamesainslie/mdview/commit/7c8439c6a4c12ac82a9a445df729895afd170f69))
* **ui:** add table of contents styling and layout ([8f83ad5](https://github.com/jamesainslie/mdview/commit/8f83ad5afd8945a3b4ad73d223a1a9b219c811b1))
* **ui:** implement table of contents renderer ([cff69a0](https://github.com/jamesainslie/mdview/commit/cff69a0da5c459ff4db735ab052e9644a28db819))
* **ui:** implement table of contents with navigation and configuration ([82ea0db](https://github.com/jamesainslie/mdview/commit/82ea0db194e5c30d8dd4a8eb9321d67797a21651))


### Bug Fixes

* **hooks:** remove deprecated husky shebang for v10 compatibility ([a4501ab](https://github.com/jamesainslie/mdview/commit/a4501ab371d44badce18402569bbae8dad54abf5))


### Documentation

* **contributing:** document git hooks for automated quality checks ([a03fdcf](https://github.com/jamesainslie/mdview/commit/a03fdcf996e1f56bd39d6f91d080de3937125b13))
* update README with TOC feature and improve layout ([2a7da59](https://github.com/jamesainslie/mdview/commit/2a7da59fd725972b037bc5a986b5890084eb81f9))


### Tests

* **core:** fix render-pipeline test mock for updateOptions ([6e0c0a2](https://github.com/jamesainslie/mdview/commit/6e0c0a21aaf3a912f8c9245298865be12b73da37))

## [0.2.2](https://github.com/jamesainslie/mdview/compare/mdview-v0.2.1...mdview-v0.2.2) (2025-11-28)


### Documentation

* add Chrome Web Store submission assets ([2b6329b](https://github.com/jamesainslie/mdview/commit/2b6329be882de5ea1babfa93db6edd0ae207e763))
* add feature showcase document ([19ebf6e](https://github.com/jamesainslie/mdview/commit/19ebf6e7326314a8aabec2872048b967dfbb786c))
* add privacy policy ([874a0e1](https://github.com/jamesainslie/mdview/commit/874a0e1045e5acf95815fb4c7d2fa01a178b5f41))

## [0.2.1](https://github.com/jamesainslie/mdview/compare/mdview-v0.2.0...mdview-v0.2.1) (2025-11-28)


### Features

* **background:** add service worker and state management ([00fda15](https://github.com/jamesainslie/mdview/commit/00fda1538e2cb8071fb870ba10bb62fe2b6b60c8))
* **background:** update service worker with cache and log state ([a20bcb3](https://github.com/jamesainslie/mdview/commit/a20bcb37acf3d0b5c900e56e4ae63034df2b09c5))
* **content:** add content script and styles ([5981736](https://github.com/jamesainslie/mdview/commit/59817364660975bf7cd4b36b81d6567207239aed))
* **content:** integrate progressive rendering and logging ([5a3296e](https://github.com/jamesainslie/mdview/commit/5a3296e8f2196220f3db21d1febad73c63bb551d))
* **core:** add logging, caching, and worker infrastructure ([ac57684](https://github.com/jamesainslie/mdview/commit/ac57684ba0c5a60e4d9dfeb956522cec5be70f70))
* **core:** implement markdown rendering pipeline ([b494017](https://github.com/jamesainslie/mdview/commit/b494017c50f39a174cdec253cd62a19913f67f84))
* **core:** implement progressive hydration and file watcher ([2d0ef02](https://github.com/jamesainslie/mdview/commit/2d0ef025c32eebdc08c78322bc6621017cf820ee))
* **extension:** add manifest and assets ([f598491](https://github.com/jamesainslie/mdview/commit/f598491aca16cd59d396fa831e00ab9d06d2f46a))
* **renderer:** enhance render pipeline with mermaid and progressive features ([8aed9e2](https://github.com/jamesainslie/mdview/commit/8aed9e224bf060915cc43fb6bf99adfca854ef8e))
* **renderer:** optimize mermaid diagram rendering ([04ecc14](https://github.com/jamesainslie/mdview/commit/04ecc14f9706af796a9c04bd2a36e48f07a4bb00))
* **renderers:** add syntax and diagram rendering ([64d42d7](https://github.com/jamesainslie/mdview/commit/64d42d7f9a6275f8b166322a64deab1eeddbba7c))
* **theme:** implement theme initialization and application ([a7608e6](https://github.com/jamesainslie/mdview/commit/a7608e632582c8fb1dd91ae6a3fc651e2beed21a))
* **themes:** implement theme system ([67d037f](https://github.com/jamesainslie/mdview/commit/67d037f240451335cbc9fa066e9f0293750d7caf))
* **types:** define application interfaces ([3f4b01a](https://github.com/jamesainslie/mdview/commit/3f4b01ae247c5788e9223db8249ef80c5128b468))
* **ui:** add log level selector and dynamic version display ([b84cad7](https://github.com/jamesainslie/mdview/commit/b84cad79c6ee742f2d5b3519124ebf087af5dbd2))
* **ui:** add log level settings and popup improvements ([bdbaa5f](https://github.com/jamesainslie/mdview/commit/bdbaa5f78658f0be912fd11d68801b356f67931a))
* **ui:** add popup and options interfaces ([459ea00](https://github.com/jamesainslie/mdview/commit/459ea0015cdfef0289f645a0945b4a5bafead763))
* **ui:** enhance settings and theme management ([5fcd240](https://github.com/jamesainslie/mdview/commit/5fcd240ede321d60560bb8eeb306771edd8fee27))
* **utils:** add debug logging system ([5b3635c](https://github.com/jamesainslie/mdview/commit/5b3635cee3863dee629de815d8d0e3a63ed750b2))
* **utils:** add security and file utilities ([bd1a8f1](https://github.com/jamesainslie/mdview/commit/bd1a8f1e79e6ea1be39539eff8ff403d6bc95e0a))


### Bug Fixes

* **ci:** disable npm publishing in semantic-release ([1c38404](https://github.com/jamesainslie/mdview/commit/1c384044e8d7f86c54b9e49357257439875e69a8))
* **ci:** disable npm publishing in semantic-release ([c7ee20b](https://github.com/jamesainslie/mdview/commit/c7ee20bde5ecf3cb56c6c8caf4ee9377b9a7aa6f))
* **content:** add null check for state in debug mode setter ([712be60](https://github.com/jamesainslie/mdview/commit/712be607e4c21dfa70f30d74a7e1a846abb3061f))
* **content:** ensure loading overlay visibility and re-enable auto-reload ([8c0a80d](https://github.com/jamesainslie/mdview/commit/8c0a80d1f6c7257f2c67e728ed940669a4c873b7))
* **core:** resolve file scanner errors and rendering issues ([24c12d4](https://github.com/jamesainslie/mdview/commit/24c12d4b8cf8d05db633c5b241cd9fd42bfea97e))
* **file-scanner:** add context invalidation detection with debug logging ([9084947](https://github.com/jamesainslie/mdview/commit/9084947484b74f1b984cf156112aafb35ae63c92))
* **file-scanner:** prevent infinite loop in file watcher initialization ([3ccb5d8](https://github.com/jamesainslie/mdview/commit/3ccb5d837e6b67a62ecce562b2436bd81e93f04e))
* **lint:** resolve type safety and async errors ([d038756](https://github.com/jamesainslie/mdview/commit/d03875672cc8c30328d6dba3fb0e68b34b46acf1))
* **mermaid:** correct SVG type for getBBox method calls ([b812d9b](https://github.com/jamesainslie/mdview/commit/b812d9bff8213f81105a2fe9a7a9f3c7b2d34841))
* **mermaid:** correct zoom, fit, and maximize controls ([22b7221](https://github.com/jamesainslie/mdview/commit/22b72219d67b56c02eaab8ad326cf0e58124bff0))
* **mermaid:** use global registry to preserve diagram code ([5c1ea1b](https://github.com/jamesainslie/mdview/commit/5c1ea1b9c7fbb5c0ddd312d1b34c0832c58afde2))
* **renderer:** ensure mermaid theme updates dynamically ([3b5f424](https://github.com/jamesainslie/mdview/commit/3b5f42429d71f4d47a619bb8af3d8ecd39fd8c6e))
* resolve TypeScript build errors for release ([08df090](https://github.com/jamesainslie/mdview/commit/08df090ae484840b240e0f182f23234880628731))
* **section-splitter:** track code fence state to prevent false heading detection ([325a868](https://github.com/jamesainslie/mdview/commit/325a868b7accf076333dd837ff18ac40b0d5d8f4))
* **tests:** correct synchronous error mock in render pipeline test ([e997517](https://github.com/jamesainslie/mdview/commit/e99751786160ac995938658f666f7d42dda0bcdb))


### Code Refactoring

* improve code quality and establish CI pipeline ([62588e2](https://github.com/jamesainslie/mdview/commit/62588e25efc4841dc39a24db08ac5ede70093602))
* **logger:** replace console calls with debug logger ([d39f021](https://github.com/jamesainslie/mdview/commit/d39f0211a675ffb202895851779c49f51dc4bb8e))
* **workers:** improve file protocol logging clarity ([05e6672](https://github.com/jamesainslie/mdview/commit/05e6672e6d9394a679f8a93d3df3d60cbd39f699))
* **workers:** remove unused file monitor worker ([334d5eb](https://github.com/jamesainslie/mdview/commit/334d5eba1495b5b428735c53493bd12316a5f3ea))


### Documentation

* remove support email from README.md ([ee674de](https://github.com/jamesainslie/mdview/commit/ee674de5e8c4c51afba03179d780c0c113acd75a))
* update project documentation ([b711d00](https://github.com/jamesainslie/mdview/commit/b711d00d8dfea9abe36418e75d8bee5d9fb64b9c))


### Tests

* **background:** add service worker fetch error handling tests ([1950222](https://github.com/jamesainslie/mdview/commit/1950222d6031027457619a4c5e4b9ac3c01f98e0))
* implement comprehensive unit test suite ([1c20954](https://github.com/jamesainslie/mdview/commit/1c2095417739b3c9817be2b690d9dda825f51b57))
* implement comprehensive unit test suite and fix fetch error handling ([29b59c9](https://github.com/jamesainslie/mdview/commit/29b59c91f2a98516b43b772bcbbb9b3238802636))
* **infra:** setup vitest configuration and helpers ([dae6937](https://github.com/jamesainslie/mdview/commit/dae6937fd58851cb0a67dd2a807f293d38ce658f))
* **unit:** implement core rendering tests ([c9ab68a](https://github.com/jamesainslie/mdview/commit/c9ab68a110b36d08eaaff18a229dba7b6b06b059))


### Build System

* add icon generation scripts ([c3c5890](https://github.com/jamesainslie/mdview/commit/c3c58904f5d72e7b130a24a7a508d35df4a0c34e))
* **deps:** add jsdom for testing environment ([530ff75](https://github.com/jamesainslie/mdview/commit/530ff759fcaa81697a4efb27176903d35653ea9d))


### Continuous Integration

* add eslint workflow for continuous integration ([6dd61ef](https://github.com/jamesainslie/mdview/commit/6dd61efaf76f3a8edca28fb1abeda8f93a001172))
* add release-extension workflow ([3ebf34a](https://github.com/jamesainslie/mdview/commit/3ebf34a5950351a549663b271437c45afbce2572))
* add release-please configuration ([7675508](https://github.com/jamesainslie/mdview/commit/76755083523e51cfbfea35b35a054adac5116211))
* add release-please workflow ([c14e868](https://github.com/jamesainslie/mdview/commit/c14e8687142cc9c5d6c50dd562fe6196f28d98c3))
* add test execution to CI workflow ([2c881f2](https://github.com/jamesainslie/mdview/commit/2c881f2f386fb4741ec51bea687d480a9fdefecb))
* migrate to release-please for controlled releases ([7107b9a](https://github.com/jamesainslie/mdview/commit/7107b9a37951499ce6cfb0a6fb4a4260ffa423a0))
* remove semantic-release ([0c7a523](https://github.com/jamesainslie/mdview/commit/0c7a523ce6e26e20486b1aa7ed1d00fe2ddaed75))
* setup automated release pipeline and version sync ([8c8b477](https://github.com/jamesainslie/mdview/commit/8c8b4771c6d376134d7f19bfdbac2771b29ddba3))
* setup automated release pipeline and version sync ([e231093](https://github.com/jamesainslie/mdview/commit/e2310936e56ebae897100d4e4276787e937f8021))

## [0.1.2](https://github.com/jamesainslie/mdview/compare/v0.1.1...v0.1.2) (2025-11-20)


### Bug Fixes

* **lint:** resolve type safety and async errors ([d038756](https://github.com/jamesainslie/mdview/commit/d03875672cc8c30328d6dba3fb0e68b34b46acf1))
* resolve TypeScript build errors for release ([08df090](https://github.com/jamesainslie/mdview/commit/08df090ae484840b240e0f182f23234880628731))

## [0.1.1](https://github.com/jamesainslie/mdview/compare/v0.1.0...v0.1.1) (2025-11-19)


### Bug Fixes

* **ci:** disable npm publishing in semantic-release ([c7ee20b](https://github.com/jamesainslie/mdview/commit/c7ee20bde5ecf3cb56c6c8caf4ee9377b9a7aa6f))
