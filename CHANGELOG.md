# Changelog

## [0.2.0](https://github.com/cyrillbrito/openfeeds/compare/v0.1.0...v0.2.0) (2026-02-14)


### Features

* route PostHog events through Cloudflare Worker reverse proxy ([#44](https://github.com/cyrillbrito/openfeeds/issues/44)) ([177f16a](https://github.com/cyrillbrito/openfeeds/commit/177f16a4455d19ca73853eae303c3e559f66c575))
* track feed sync failures and stop retrying broken feeds ([#46](https://github.com/cyrillbrito/openfeeds/issues/46)) ([79823bb](https://github.com/cyrillbrito/openfeeds/commit/79823bb0d6c84e590e587bdadddf781d8872478b))


### Bug Fixes

* correct case-sensitive import for PostHog component ([#49](https://github.com/cyrillbrito/openfeeds/issues/49)) ([57e3129](https://github.com/cyrillbrito/openfeeds/commit/57e31296943b949b27c3c1c82daccec39c74456d))
* improve edit feed dialog UI and use CSS Anchor Positioning ([#50](https://github.com/cyrillbrito/openfeeds/issues/50)) ([8b47cae](https://github.com/cyrillbrito/openfeeds/commit/8b47caeca35c8c947ca0a6fa6f406205b61cd533))
* resolve SSR theme flash by adding blocking ScriptOnce ([#48](https://github.com/cyrillbrito/openfeeds/issues/48)) ([d73affa](https://github.com/cyrillbrito/openfeeds/commit/d73affaea1e565c980b72da791a418ea6465d05a))
* use accessor syntax for TanStack query results ([#53](https://github.com/cyrillbrito/openfeeds/issues/53)) ([9cf6498](https://github.com/cyrillbrito/openfeeds/commit/9cf6498b519a710b2611ca55641721766f67f50a))

## [0.1.0](https://github.com/cyrillbrito/openfeeds/compare/v0.0.1...v0.1.0) (2026-02-13)


### Features

* Add PostHog analytics with server-side event tracking ([#39](https://github.com/cyrillbrito/openfeeds/issues/39)) ([e5fdf88](https://github.com/cyrillbrito/openfeeds/commit/e5fdf885815b1dc7ba89006834a2dac9a2b91416))


### Bug Fixes

* remove duplicate getConfig import in tts.ts ([#43](https://github.com/cyrillbrito/openfeeds/issues/43)) ([0c2027f](https://github.com/cyrillbrito/openfeeds/commit/0c2027f5a087476565cc5d0508784be6cbc3c320))
* sync feed tags via Electric collection to fix edit modal crash ([#34](https://github.com/cyrillbrito/openfeeds/issues/34)) ([8ffcea7](https://github.com/cyrillbrito/openfeeds/commit/8ffcea7d882f6b2ff51651ef3ee0c980fe629db8))
* TTS returning errors to user ([#38](https://github.com/cyrillbrito/openfeeds/issues/38)) ([7cc856f](https://github.com/cyrillbrito/openfeeds/commit/7cc856f0c807a4d1e9bb607c8a1e08e219c84427))
