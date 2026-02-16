# Changelog

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
