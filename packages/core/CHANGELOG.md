# Changelog

## 0.3.0 (2026-04-28)


### ⚠ BREAKING CHANGES

* Release artifacts now include Electron desktop binaries (macOS, Linux, Windows) alongside the Chrome extension zip. The release body format has changed to document both distribution channels.

### chore

* **release:** prepare v0.3.0 release ([099d403](https://github.com/yaklabco/mdreview/commit/099d40325ecd2afb5ffc6f7d09db7b2c27f092b7))
* **release:** release 0.3.0 ([1fa50b4](https://github.com/yaklabco/mdreview/commit/1fa50b4e364ecb4c77f15396340df7565384f4b8))


### Features

* add multi-platform desktop app distribution ([4367064](https://github.com/yaklabco/mdreview/commit/43670641bf5bcbfa7efa3a576e8487dd67097cd4))
* add One Dark Pro theme, colorful icon themes, compact folders, and preferences panel redesign ([eb61796](https://github.com/yaklabco/mdreview/commit/eb6179601c589186fd0ca6ea10b61569cbef74bd))
* **core:** add GitAdapter and BridgeHealth interfaces ([8740ba3](https://github.com/yaklabco/mdreview/commit/8740ba36a4fec9067fece4b7ada29202e7fbd78d))
* **core:** define platform adapter interfaces ([994190f](https://github.com/yaklabco/mdreview/commit/994190f7ae3f117ac7fa7ac8ead2e52d768029fa))
* rebrand mdview to mdreview across all packages ([4cf004f](https://github.com/yaklabco/mdreview/commit/4cf004fd46413108ee1ec19522d7f7344f89c048))


### Bug Fixes

* **chrome-ext:** fix comment persistence and Chrome extension rendering ([392e30e](https://github.com/yaklabco/mdreview/commit/392e30e0447dd4cb485088ca2d8c8069eb84a654))
* **chrome-ext:** fix comment persistence and extension rendering ([c1451d5](https://github.com/yaklabco/mdreview/commit/c1451d5c860121fcc9e73f04298f1fce41d65132))
* **core:** render tables with mismatched separator column counts ([b395a24](https://github.com/yaklabco/mdreview/commit/b395a2472491a28df37fc1f9a4e39166a0dbb6d7))
* **core:** render tables with mismatched separator column counts ([541eb72](https://github.com/yaklabco/mdreview/commit/541eb727eb9795e8394682ef1562565b6d63727e))
* **electron:** resolve runtime bugs preventing markdown rendering ([db55bac](https://github.com/yaklabco/mdreview/commit/db55bac8794a04aa93236c7c5974cce6864b6a31))
* increase bottom padding to prevent last line from being obscured ([#72](https://github.com/yaklabco/mdreview/issues/72)) ([c61300b](https://github.com/yaklabco/mdreview/commit/c61300b0ff489452f14fab9075c137c7e61d5106)), closes [#71](https://github.com/yaklabco/mdreview/issues/71)
* resolve ESLint errors for CI ([2abba31](https://github.com/yaklabco/mdreview/commit/2abba316c56fb3b4b0a04cbe047d7d06e9e89cba))
* unwrap code-block and table wrapper divs in content collector ([6665cdd](https://github.com/yaklabco/mdreview/commit/6665cdd7fc7c08c04a5091117b808edfa51ae8fa))
* use loose security level for mermaid and await render queue drain ([d3ad8cd](https://github.com/yaklabco/mdreview/commit/d3ad8cd7d3ff6607efdb6010d3417f50b9f816c0))


### Code Refactoring

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


### Tests

* **core:** add DOCX export regression and integration tests ([31aa24d](https://github.com/yaklabco/mdreview/commit/31aa24d18d15e8df681a3686e9a0057325bf7094))


### Build System

* migrate from npm to bun + turborepo ([608966e](https://github.com/yaklabco/mdreview/commit/608966e5c38fa650de4535ee7f3c8ac7632a646f))
