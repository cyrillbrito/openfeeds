# Changelog

## [0.11.7](https://github.com/cyrillbrito/openfeeds/compare/v0.11.6...v0.11.7) (2026-03-29)


### Bug Fixes

* **web:** handle css-tree createRequire() JSON loads in Nitro bundle ([#202](https://github.com/cyrillbrito/openfeeds/issues/202)) ([865e298](https://github.com/cyrillbrito/openfeeds/commit/865e2987fb1b0d3bccefac90381e3a5cf1114371))

## [0.11.6](https://github.com/cyrillbrito/openfeeds/compare/v0.11.5...v0.11.6) (2026-03-29)


### Bug Fixes

* **web:** resolve CJS require() crash in Nitro ESM bundle ([#200](https://github.com/cyrillbrito/openfeeds/issues/200)) ([d8a499b](https://github.com/cyrillbrito/openfeeds/commit/d8a499b529c5c01816f285c49f2c475773ef7291))

## [0.11.5](https://github.com/cyrillbrito/openfeeds/compare/v0.11.4...v0.11.5) (2026-03-29)


### Bug Fixes

* **ci:** update PostHog sourcemaps path for Nitro build output ([#198](https://github.com/cyrillbrito/openfeeds/issues/198)) ([bf52d34](https://github.com/cyrillbrito/openfeeds/commit/bf52d344d66d5b7c5895dc72bf80569e68ef3d97))

## [0.11.4](https://github.com/cyrillbrito/openfeeds/compare/v0.11.3...v0.11.4) (2026-03-29)


### Bug Fixes

* **web:** restore Nitro for production Node.js/Docker deployment ([#196](https://github.com/cyrillbrito/openfeeds/issues/196)) ([582d2d4](https://github.com/cyrillbrito/openfeeds/commit/582d2d44a84a84a9991707322ba5fa61dbd6a860))

## [0.11.3](https://github.com/cyrillbrito/openfeeds/compare/v0.11.2...v0.11.3) (2026-03-29)


### Bug Fixes

* **web:** bundle all SSR deps to fix Node.js production runtime ([#194](https://github.com/cyrillbrito/openfeeds/issues/194)) ([5e10b76](https://github.com/cyrillbrito/openfeeds/commit/5e10b768dbe7d0c48b9ff94815ec3ed2d7f1ed4e))

## [0.11.2](https://github.com/cyrillbrito/openfeeds/compare/v0.11.1...v0.11.2) (2026-03-29)


### Bug Fixes

* **web:** update build output paths from .output to dist ([#191](https://github.com/cyrillbrito/openfeeds/issues/191)) ([1a082d8](https://github.com/cyrillbrito/openfeeds/commit/1a082d8ba0819427e222fe9ef5e839344d7df8ee))

## [0.11.1](https://github.com/cyrillbrito/openfeeds/compare/v0.11.0...v0.11.1) (2026-03-29)


### Bug Fixes

* switch to pnpm isolated mode and fix vite resolution ([#189](https://github.com/cyrillbrito/openfeeds/issues/189)) ([c3fef4f](https://github.com/cyrillbrito/openfeeds/commit/c3fef4f9b7f596c93d190fa8f9502792300bd285))

## [0.11.0](https://github.com/cyrillbrito/openfeeds/compare/v0.10.2...v0.11.0) (2026-03-29)


### Features

* migrate from bun to node and pnpm ([#186](https://github.com/cyrillbrito/openfeeds/issues/186)) ([b24712f](https://github.com/cyrillbrito/openfeeds/commit/b24712fc278ba838b6b2e9127de8c93764bc7dc2))

## [0.10.2](https://github.com/cyrillbrito/openfeeds/compare/v0.10.1...v0.10.2) (2026-03-29)


### Bug Fixes

* **readability:** declare turndown and domino as explicit dependencies ([#183](https://github.com/cyrillbrito/openfeeds/issues/183)) ([b8c4b92](https://github.com/cyrillbrito/openfeeds/commit/b8c4b92c9ea2aa5649ba3b8e6973d88badc3fed7))

## [0.10.1](https://github.com/cyrillbrito/openfeeds/compare/v0.10.0...v0.10.1) (2026-03-29)


### Bug Fixes

* **web:** externalize turndown and domino for Nitro build ([#181](https://github.com/cyrillbrito/openfeeds/issues/181)) ([301fcca](https://github.com/cyrillbrito/openfeeds/commit/301fccaa55ac2f48a995f604de20f3bd56da803a))

## [0.10.0](https://github.com/cyrillbrito/openfeeds/compare/v0.9.0...v0.10.0) (2026-03-28)


### Features

* **emails:** add feedback reply email template and send script ([#159](https://github.com/cyrillbrito/openfeeds/issues/159)) ([8238593](https://github.com/cyrillbrito/openfeeds/commit/82385933db9fd13b0c9e93ed06146165433659d0))
* **premium:** add user plan system with per-plan usage limits (Stage 1) ([#166](https://github.com/cyrillbrito/openfeeds/issues/166)) ([0b037ba](https://github.com/cyrillbrito/openfeeds/commit/0b037ba59694b99ddff2fb8e0d60d14929ade557))
* **web:** add PostHog MCP server configuration ([#158](https://github.com/cyrillbrito/openfeeds/issues/158)) ([0bcc197](https://github.com/cyrillbrito/openfeeds/commit/0bcc1976ed4d2e7336f3568e76340d768066d52b))
* **web:** add server file import protection ([#172](https://github.com/cyrillbrito/openfeeds/issues/172)) ([46ede7a](https://github.com/cyrillbrito/openfeeds/commit/46ede7a1bc608feaeddac25e565abdd463cd7bcd))


### Bug Fixes

* **checks:** resolve all lint errors and format issues across the monorepo ([#178](https://github.com/cyrillbrito/openfeeds/issues/178)) ([027aba0](https://github.com/cyrillbrito/openfeeds/commit/027aba05034200d2a97688edd19fc727cf547467))
* **domain:** add defensive userId check in enqueueFeedSync ([#162](https://github.com/cyrillbrito/openfeeds/issues/162)) ([ba4cca7](https://github.com/cyrillbrito/openfeeds/commit/ba4cca7eea3964fbbd4d2ee801dc6365e328154f))
* **lint:** resolve all lint warnings across the monorepo ([#179](https://github.com/cyrillbrito/openfeeds/issues/179)) ([83bf525](https://github.com/cyrillbrito/openfeeds/commit/83bf525a6b0a8fbd6b5d4351fdfc3a7300bec2f7))
* **web:** add error handling and buffering UI to audio player ([#169](https://github.com/cyrillbrito/openfeeds/issues/169)) ([0db9d55](https://github.com/cyrillbrito/openfeeds/commit/0db9d552be7f9f037b34db587b8ea12da8d55117))
* **web:** add error handling to auth session checks ([#160](https://github.com/cyrillbrito/openfeeds/issues/160)) ([e9f20fe](https://github.com/cyrillbrito/openfeeds/commit/e9f20febb41cad3e298290b09344ee6f56f4019f))
* **web:** add orderBy to limit queries for deterministic results ([#174](https://github.com/cyrillbrito/openfeeds/issues/174)) ([8f6314a](https://github.com/cyrillbrito/openfeeds/commit/8f6314aeb2c22973335290ecc620728011e3a9f5))
* **web:** decouple archive counts from read status and fix paginated unread counts ([#154](https://github.com/cyrillbrito/openfeeds/issues/154)) ([4b0bb56](https://github.com/cyrillbrito/openfeeds/commit/4b0bb568082552d925795aeb1b83507deae30bdb))
* **web:** fix crash when opening feed page ([#156](https://github.com/cyrillbrito/openfeeds/issues/156)) ([fcba59b](https://github.com/cyrillbrito/openfeeds/commit/fcba59b491d09ca96068f1d1a505be32cc5fcf02))
* **web:** show tag content when tag has articles but no feeds ([#171](https://github.com/cyrillbrito/openfeeds/issues/171)) ([417d71c](https://github.com/cyrillbrito/openfeeds/commit/417d71c4741662ca00cce5f830c8a031bdefe735))
* **web:** stop infinite retry loop on 401 in Electric shape streams ([#161](https://github.com/cyrillbrito/openfeeds/issues/161)) ([93f0204](https://github.com/cyrillbrito/openfeeds/commit/93f020479260f1a0552f9ca0d30a0bf5e2ebfe94))
* **web:** use fallback chain for YouTube thumbnails ([#157](https://github.com/cyrillbrito/openfeeds/issues/157)) ([03f694a](https://github.com/cyrillbrito/openfeeds/commit/03f694a59f86c1ec6850a2b9a3feb298511a5688))


### Performance Improvements

* **db:** add composite index on articles(user_id, guid) ([#163](https://github.com/cyrillbrito/openfeeds/issues/163)) ([e37f461](https://github.com/cyrillbrito/openfeeds/commit/e37f461aa08b76933e490ecbd24dba21894a2cf0))

## [0.9.0](https://github.com/cyrillbrito/openfeeds/compare/v0.8.3...v0.9.0) (2026-03-08)


### Features

* **web:** redesign feeds page and standardize follow/unfollow language ([#151](https://github.com/cyrillbrito/openfeeds/issues/151)) ([a40ffbb](https://github.com/cyrillbrito/openfeeds/commit/a40ffbb45e6df77e52051aca34033105c6170a9d))


### Bug Fixes

* add transport-agnostic error boundary to prevent SQL leaks ([#152](https://github.com/cyrillbrito/openfeeds/issues/152)) ([78fb49c](https://github.com/cyrillbrito/openfeeds/commit/78fb49c7dfe0e80a0e87e0bb733467da7352faa8))
* **web:** use positional params in Electric WHERE clauses and fix shape error retry ([#150](https://github.com/cyrillbrito/openfeeds/issues/150)) ([2c620e8](https://github.com/cyrillbrito/openfeeds/commit/2c620e851af6799aea2b333994ea1e372b4922f4))

## [0.8.3](https://github.com/cyrillbrito/openfeeds/compare/v0.8.2...v0.8.3) (2026-03-07)


### Bug Fixes

* **ci:** drop --frozen-lockfile after turbo prune ([#148](https://github.com/cyrillbrito/openfeeds/issues/148)) ([2e3a916](https://github.com/cyrillbrito/openfeeds/commit/2e3a916cb8d3314b131661c8cf92ec7aaba953e4))

## [0.8.2](https://github.com/cyrillbrito/openfeeds/compare/v0.8.1...v0.8.2) (2026-03-07)


### Bug Fixes

* remove svix from Rollup externals ([#145](https://github.com/cyrillbrito/openfeeds/issues/145)) ([2fd5253](https://github.com/cyrillbrito/openfeeds/commit/2fd5253ce0958d7a18d085954fd3b46a041efc76))

## [0.8.1](https://github.com/cyrillbrito/openfeeds/compare/v0.8.0...v0.8.1) (2026-03-07)


### Bug Fixes

* update dependencies and externalize svix in vite config ([#143](https://github.com/cyrillbrito/openfeeds/issues/143)) ([26a4154](https://github.com/cyrillbrito/openfeeds/commit/26a4154ce2af1719b574b47157e8602813fa2043))

## [0.8.0](https://github.com/cyrillbrito/openfeeds/compare/v0.7.0...v0.8.0) (2026-03-07)


### Features

* **web:** add drag-and-drop tag reordering ([#133](https://github.com/cyrillbrito/openfeeds/issues/133)) ([7aa48df](https://github.com/cyrillbrito/openfeeds/commit/7aa48df0e26622273cd2b19f7e68c361c9da0165))
* **web:** add print button for clean article printing ([#134](https://github.com/cyrillbrito/openfeeds/issues/134)) ([6f902f2](https://github.com/cyrillbrito/openfeeds/commit/6f902f2ccdccb66826e3e3362f816b42083b23c3))
* **web:** only show Shorts button when shorts exist ([#132](https://github.com/cyrillbrito/openfeeds/issues/132)) ([bcb1e5f](https://github.com/cyrillbrito/openfeeds/commit/bcb1e5f5d685ee1b17dcb9a62f8d3f6c4239750e))


### Bug Fixes

* **domain:** pass curated feed metadata through to feed creation ([#131](https://github.com/cyrillbrito/openfeeds/issues/131)) ([8164090](https://github.com/cyrillbrito/openfeeds/commit/8164090939aca9048160bc4a6b620130c63a7896))
* **domain:** update TTS default voice ([#142](https://github.com/cyrillbrito/openfeeds/issues/142)) ([8e396c5](https://github.com/cyrillbrito/openfeeds/commit/8e396c5e23025e809a44a0575cb9742c7091e174))
* **domain:** validate feed URLs on extension API and OPML import ([#139](https://github.com/cyrillbrito/openfeeds/issues/139)) ([cf3dc3a](https://github.com/cyrillbrito/openfeeds/commit/cf3dc3a2aba8cd7551b18f732ccc6c79f02f2cef))
* **emails:** improve email deliverability ([#125](https://github.com/cyrillbrito/openfeeds/issues/125)) ([6bf9d12](https://github.com/cyrillbrito/openfeeds/commit/6bf9d12d1f360eeaedc05ad5aedd3949e6b85ffa))
* **tooling:** stop rewriting git to but, show reminder instead ([#137](https://github.com/cyrillbrito/openfeeds/issues/137)) ([c91ccf8](https://github.com/cyrillbrito/openfeeds/commit/c91ccf808fcc7fa5b85a713bd76c5431f64e6f91))
* **web:** auto-prepend https:// to discover URLs without protocol ([#140](https://github.com/cyrillbrito/openfeeds/issues/140)) ([7eea47d](https://github.com/cyrillbrito/openfeeds/commit/7eea47d1485aaa03b2505bc6970fb4141ef84c8a))
* **web:** fix stale Show accessor crash on feed view navigation ([#130](https://github.com/cyrillbrito/openfeeds/issues/130)) ([17ca948](https://github.com/cyrillbrito/openfeeds/commit/17ca948d878d1d0abae22df3d869a1aab40f4a7b))
* **web:** pass site URL on follow and pin happy-dom for readability ([#136](https://github.com/cyrillbrito/openfeeds/issues/136)) ([fd123dc](https://github.com/cyrillbrito/openfeeds/commit/fd123dc057c002517b7d5d59f2ffd6bbc98c3b37))

## [0.7.0](https://github.com/cyrillbrito/openfeeds/compare/v0.6.0...v0.7.0) (2026-02-28)


### Features

* add transaction ID (txid) sync to eliminate optimistic UI flicker ([#119](https://github.com/cyrillbrito/openfeeds/issues/119)) ([e8c4604](https://github.com/cyrillbrito/openfeeds/commit/e8c4604ace759c48416c5bf95d21d19ac2ae0d02))


### Bug Fixes

* **web:** clean up general settings page ([#122](https://github.com/cyrillbrito/openfeeds/issues/122)) ([db7d2b1](https://github.com/cyrillbrito/openfeeds/commit/db7d2b19292b743922c0e65574ee5e7cebe734f7))
* **web:** pre-create /data dir with correct ownership in Dockerfile ([#117](https://github.com/cyrillbrito/openfeeds/issues/117)) ([6920e9d](https://github.com/cyrillbrito/openfeeds/commit/6920e9d1fa4bc30d19a4c6c410359233ab1ef5bd))

## [0.6.0](https://github.com/cyrillbrito/openfeeds/compare/v0.5.0...v0.6.0) (2026-02-27)


### Features

* add discover page with curated feeds and tag management rework ([#116](https://github.com/cyrillbrito/openfeeds/issues/116)) ([41f3127](https://github.com/cyrillbrito/openfeeds/commit/41f31272fc807bdf3608487ea2ed2e6886e37ebb))
* add free-tier TTS generation limits (5/day, 30/month) ([#114](https://github.com/cyrillbrito/openfeeds/issues/114)) ([53c0bcc](https://github.com/cyrillbrito/openfeeds/commit/53c0bccf9be38ce84037757a78c588aa77b74061))
* add free-tier usage limits to prevent abuse during beta ([#51](https://github.com/cyrillbrito/openfeeds/issues/51)) ([f46bc3c](https://github.com/cyrillbrito/openfeeds/commit/f46bc3ccfc00281701325d52305f7ff51837a310))
* migrate user-data table IDs from text/ULID to uuid/UUIDv7 ([#111](https://github.com/cyrillbrito/openfeeds/issues/111)) ([2a6643d](https://github.com/cyrillbrito/openfeeds/commit/2a6643dc6e29e8690793626bccb5e204c2ab83cd))


### Bug Fixes

* propagate feed tag changes to all existing articles ([#109](https://github.com/cyrillbrito/openfeeds/issues/109)) ([6d68808](https://github.com/cyrillbrito/openfeeds/commit/6d68808536917452ade9d26371959977a80ae9d3))
* resolve mobile layout overflow and viewport issues ([#113](https://github.com/cyrillbrito/openfeeds/issues/113)) ([f1c745b](https://github.com/cyrillbrito/openfeeds/commit/f1c745b8b94c0e360d35b91e49f4ea4beda6c253))

## [0.5.0](https://github.com/cyrillbrito/openfeeds/compare/v0.4.0...v0.5.0) (2026-02-20)


### Features

* add settings tabs layout with OAuth connections page ([#102](https://github.com/cyrillbrito/openfeeds/issues/102)) ([1b464ce](https://github.com/cyrillbrito/openfeeds/commit/1b464cebdb215bb90b65ec73bfe0bc15e446fbdc))
* add sync logs viewer modal to feed pages ([#106](https://github.com/cyrillbrito/openfeeds/issues/106)) ([0423be1](https://github.com/cyrillbrito/openfeeds/commit/0423be1ca292bb9e05783a2b3439a5f7a147406c))
* **feed-sync:** HTTP caching, exponential backoff retries, and feed health states ([#105](https://github.com/cyrillbrito/openfeeds/issues/105)) ([58b74f3](https://github.com/cyrillbrito/openfeeds/commit/58b74f3b845d8dce3f98d04d62c9062bd8bec34e))


### Bug Fixes

* add client-side auth guards for route navigations ([#95](https://github.com/cyrillbrito/openfeeds/issues/95)) ([6d8d66b](https://github.com/cyrillbrito/openfeeds/commit/6d8d66b0ee823a74861da86898924345a31adaec))
* guard SocialLoginButtons against undefined publicConfig during hydration ([#94](https://github.com/cyrillbrito/openfeeds/issues/94)) ([c372a3a](https://github.com/cyrillbrito/openfeeds/commit/c372a3a750cdd1e680bb55cd0d9f90ff4842ad79))
* improve error handling in feed synchronization flow ([#101](https://github.com/cyrillbrito/openfeeds/issues/101)) ([2bbd131](https://github.com/cyrillbrito/openfeeds/commit/2bbd1314310ced43118791ed86a40489ecf31c38))
* rename "Channel" link to "Website" on feed pages ([#99](https://github.com/cyrillbrito/openfeeds/issues/99)) ([c3a3236](https://github.com/cyrillbrito/openfeeds/commit/c3a32364a4d2073b2413d54552f0fb66441c9237))
* resolve SSR hydration mismatch on login pages ([#98](https://github.com/cyrillbrito/openfeeds/issues/98)) ([aff8d47](https://github.com/cyrillbrito/openfeeds/commit/aff8d47551882e10e3b7f2159c2fead9ca0a52f8))
* run Docker containers as non-root using built-in bun user ([#100](https://github.com/cyrillbrito/openfeeds/issues/100)) ([37b079c](https://github.com/cyrillbrito/openfeeds/commit/37b079cd19d79b928827ec447d1a3a5976498bde))

## [0.4.0](https://github.com/cyrillbrito/openfeeds/compare/v0.3.0...v0.4.0) (2026-02-17)


### Features

* add Google and Apple social login with last-used method tracking ([#88](https://github.com/cyrillbrito/openfeeds/issues/88)) ([ed8fe6a](https://github.com/cyrillbrito/openfeeds/commit/ed8fe6ac8dbf21ab8dc7a959fad281b00049810c))
* add PostHog sourcemaps, app version tracking, and restructure Docker builds ([#85](https://github.com/cyrillbrito/openfeeds/issues/85)) ([e72d96f](https://github.com/cyrillbrito/openfeeds/commit/e72d96fd1fdef9234f5b390daaac0b86cc07c79a))


### Bug Fixes

* add --bun flag to vite build for Bun runtime resolution ([#92](https://github.com/cyrillbrito/openfeeds/issues/92)) ([7d632db](https://github.com/cyrillbrito/openfeeds/commit/7d632db3d21b939bc98b16738707401cf826c7e0))
* **ci:** pin PostHog/upload-source-maps to v2.0.0 ([#91](https://github.com/cyrillbrito/openfeeds/issues/91)) ([25b91d7](https://github.com/cyrillbrito/openfeeds/commit/25b91d73fd6e36344068ee8666f735a47b436384))
* **ci:** shorten PostHog sourcemap release name ([#90](https://github.com/cyrillbrito/openfeeds/issues/90)) ([cd09dad](https://github.com/cyrillbrito/openfeeds/commit/cd09dadcb4b8a4f6dc848cc3c59ecff9ad421b33))
* handle mobile virtual keyboard and scroll lock for modals ([#93](https://github.com/cyrillbrito/openfeeds/issues/93)) ([fb5e4d7](https://github.com/cyrillbrito/openfeeds/commit/fb5e4d78b6e92c57cd4c0aa81b8a17004fa31b61))

## [0.3.0](https://github.com/cyrillbrito/openfeeds/compare/v0.2.0...v0.3.0) (2026-02-16)


### Features

* add PostHog error tracking to error boundaries ([#82](https://github.com/cyrillbrito/openfeeds/issues/82)) ([fd29344](https://github.com/cyrillbrito/openfeeds/commit/fd29344bfad9652a60241eff535b041bcaffe6a3))
* collection error handling ([#79](https://github.com/cyrillbrito/openfeeds/issues/79)) ([72f02ce](https://github.com/cyrillbrito/openfeeds/commit/72f02ce28919eb2ddd4d3c987096fc858aa1846a))
* revamp OPML import result UI with detailed feedback ([#75](https://github.com/cyrillbrito/openfeeds/issues/75)) ([0361ca7](https://github.com/cyrillbrito/openfeeds/commit/0361ca7af7217de00cf45ca81b2915083365ab18))


### Bug Fixes

* replace imperative early returns with reactive SolidJS guards ([#74](https://github.com/cyrillbrito/openfeeds/issues/74)) ([5b98241](https://github.com/cyrillbrito/openfeeds/commit/5b98241fc3eae999e5937a421541a684c2cba6d0))
* standardize timestamp handling across frontend and backend ([#81](https://github.com/cyrillbrito/openfeeds/issues/81)) ([e6cf3d3](https://github.com/cyrillbrito/openfeeds/commit/e6cf3d31816be2bb6df7ce4e407aa56926c69b8e))

## [0.2.0](https://github.com/cyrillbrito/openfeeds/compare/v0.1.0...v0.2.0) (2026-02-16)


### Features

* add OAuth 2.1 provider and MCP endpoint ([#55](https://github.com/cyrillbrito/openfeeds/issues/55)) ([e79a0ae](https://github.com/cyrillbrito/openfeeds/commit/e79a0ae6950e56aa80589940c7127b990d326dc4))
* route PostHog events through Cloudflare Worker reverse proxy ([#44](https://github.com/cyrillbrito/openfeeds/issues/44)) ([177f16a](https://github.com/cyrillbrito/openfeeds/commit/177f16a4455d19ca73853eae303c3e559f66c575))
* track feed sync failures and stop retrying broken feeds ([#46](https://github.com/cyrillbrito/openfeeds/issues/46)) ([79823bb](https://github.com/cyrillbrito/openfeeds/commit/79823bb0d6c84e590e587bdadddf781d8872478b))


### Bug Fixes

* break circular export chain in domain package to fix web build ([#67](https://github.com/cyrillbrito/openfeeds/issues/67)) ([4806808](https://github.com/cyrillbrito/openfeeds/commit/480680862200538eb695ef05aea7ade8914a1426))
* correct case-sensitive import for PostHog component ([#49](https://github.com/cyrillbrito/openfeeds/issues/49)) ([57e3129](https://github.com/cyrillbrito/openfeeds/commit/57e31296943b949b27c3c1c82daccec39c74456d))
* externalize MCP SDK and CJS deps from Nitro bundle ([#72](https://github.com/cyrillbrito/openfeeds/issues/72)) ([83571ab](https://github.com/cyrillbrito/openfeeds/commit/83571ab83e12293f5f0ce5fea155cf367ac3b142))
* improve edit feed dialog UI and use CSS Anchor Positioning ([#50](https://github.com/cyrillbrito/openfeeds/issues/50)) ([8b47cae](https://github.com/cyrillbrito/openfeeds/commit/8b47caeca35c8c947ca0a6fa6f406205b61cd533))
* pass frontend-generated IDs to backend to prevent flickering ([#54](https://github.com/cyrillbrito/openfeeds/issues/54)) ([a83387a](https://github.com/cyrillbrito/openfeeds/commit/a83387a87c8eabc09cb180faf2cd51a5bd106d5c))
* replace barrel export * re-exports with explicit named exports ([#69](https://github.com/cyrillbrito/openfeeds/issues/69)) ([e2cb07f](https://github.com/cyrillbrito/openfeeds/commit/e2cb07f15ada200a9a5057cc8c29367c6c7e763a))
* replace dynamic import with static import in settings entity ([#68](https://github.com/cyrillbrito/openfeeds/issues/68)) ([faee744](https://github.com/cyrillbrito/openfeeds/commit/faee74403f399ef640f5f350b2aa4cba318b6010))
* resolve no-unassigned-vars lint warnings in SolidJS ref patterns ([#62](https://github.com/cyrillbrito/openfeeds/issues/62)) ([3d28f70](https://github.com/cyrillbrito/openfeeds/commit/3d28f709a17100afb8fa7934ea8d07f4391f006d))
* resolve SSR theme flash by adding blocking ScriptOnce ([#48](https://github.com/cyrillbrito/openfeeds/issues/48)) ([d73affa](https://github.com/cyrillbrito/openfeeds/commit/d73affaea1e565c980b72da791a418ea6465d05a))
* revert Nitro nightly to fix Rollup build crash ([#73](https://github.com/cyrillbrito/openfeeds/issues/73)) ([75f65ff](https://github.com/cyrillbrito/openfeeds/commit/75f65ffb0a86c634b650ca8472d26e4b7c69d401))
* scope OPML import queries to current user ([#65](https://github.com/cyrillbrito/openfeeds/issues/65)) ([2beba51](https://github.com/cyrillbrito/openfeeds/commit/2beba51fe689fc42ec588d5d61e3a3d7b40cec5f))
* use accessor syntax for TanStack query results ([#53](https://github.com/cyrillbrito/openfeeds/issues/53)) ([9cf6498](https://github.com/cyrillbrito/openfeeds/commit/9cf6498b519a710b2611ca55641721766f67f50a))


### Performance Improvements

* optimize feed sync with batched queries and global orchestration ([#64](https://github.com/cyrillbrito/openfeeds/issues/64)) ([02c0693](https://github.com/cyrillbrito/openfeeds/commit/02c0693a58003652d4fa33801b031b17690acd88))
* use responsive srcset for YouTube thumbnails ([#56](https://github.com/cyrillbrito/openfeeds/issues/56)) ([99acd02](https://github.com/cyrillbrito/openfeeds/commit/99acd021155da0de5e41fdeb352eb9f6d12dbcf5))

## [0.1.0](https://github.com/cyrillbrito/openfeeds/compare/v0.0.1...v0.1.0) (2026-02-13)


### Features

* Add PostHog analytics with server-side event tracking ([#39](https://github.com/cyrillbrito/openfeeds/issues/39)) ([e5fdf88](https://github.com/cyrillbrito/openfeeds/commit/e5fdf885815b1dc7ba89006834a2dac9a2b91416))


### Bug Fixes

* remove duplicate getConfig import in tts.ts ([#43](https://github.com/cyrillbrito/openfeeds/issues/43)) ([0c2027f](https://github.com/cyrillbrito/openfeeds/commit/0c2027f5a087476565cc5d0508784be6cbc3c320))
* sync feed tags via Electric collection to fix edit modal crash ([#34](https://github.com/cyrillbrito/openfeeds/issues/34)) ([8ffcea7](https://github.com/cyrillbrito/openfeeds/commit/8ffcea7d882f6b2ff51651ef3ee0c980fe629db8))
* TTS returning errors to user ([#38](https://github.com/cyrillbrito/openfeeds/issues/38)) ([7cc856f](https://github.com/cyrillbrito/openfeeds/commit/7cc856f0c807a4d1e9bb607c8a1e08e219c84427))
