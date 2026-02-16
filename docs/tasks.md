# Tasks

## To Do

### Features

- [ ] Enable archive rule by content type (video, short, article)
- [ ] BlurHash Thumbnails
- [ ] Loggers and multiplied
- [ ] Sanitize description, for example for the ryan carniato rss feed the description is including iframes
- [ ] Feed details fallback — try feed itself when no website found (`packages/domain/src/feed-details.ts:129`)
- [ ] Handle non-RSS feed formats: json, rdf (`packages/domain/src/feed-sync.ts:57`)
- [ ] i18n support for relative time in TimeAgo (`apps/web/src/components/TimeAgo.tsx:12`)
- [ ] Deployment / self-hosting instructions (`README.md:69`)

### Code Quality

- [ ] Sign-in page error boundary (`apps/web/src/routes/signin.tsx:22`)
- [ ] MCP in-process JWKS resolution (`apps/web/src/routes/api/mcp/$.ts:22`)
- [ ] Cursor schema — add proper `.describe()` (`packages/domain/src/entities/common.schema.ts:10`)
- [ ] Extract address-bar-hiding logic to a reusable hook (`apps/web/src/components/ShortsViewer.tsx:93`)
- [ ] E2E test cleanup — delete test users after signup tests (`apps/e2e/tests/auth-signup.spec.ts:143,166,185`)

## Done

- [x] The server is running workers
- [x] Email templates for authentication
- [x] Mark all as archived not read
