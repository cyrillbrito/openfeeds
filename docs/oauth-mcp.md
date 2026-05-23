# OAuth Provider & MCP

OpenFeeds acts as an **OAuth 2.1 Authorization Server** so that external AI tools (Claude, Cursor, MCP Inspector, etc.) can authenticate and access user data via the Model Context Protocol (MCP).

This is separate from the existing OAuth _client_ functionality (Google/GitHub sign-in). Both coexist in the same Better Auth instance.

```
┌──────────────────────────────────────────────────────────────┐
│                         OpenFeeds                            │
│                                                              │
│  OAuth CLIENT (existing)     OAuth SERVER (new)              │
│  - Google/GitHub login       - Issues tokens to MCP clients  │
│  - User authentication       - Dynamic client registration   │
│                              - Consent management            │
│                                                              │
│  Both share the same Better Auth instance, users & sessions  │
└──────────────────────────────────────────────────────────────┘
```

## How It Works

```
MCP Client (e.g. Claude)          OpenFeeds                    User
        │                             │                          │
        │  1. GET /.well-known/       │                          │
        │     oauth-protected-resource│                          │
        │────────────────────────────▶│                          │
        │  2. Discovery metadata      │                          │
        │◀────────────────────────────│                          │
        │                             │                          │
        │  3. POST /api/auth/         │                          │
        │     oauth2/register         │                          │
        │────────────────────────────▶│                          │
        │  4. client_id               │                          │
        │◀────────────────────────────│                          │
        │                             │                          │
        │  5. Redirect to /authorize ─────────────────────────▶  │
        │                             │  6. User logs in         │
        │                             │◀────────────────────────▶│
        │                             │  7. User consents        │
        │                             │◀────────────────────────▶│
        │  8. Redirect with auth code │                          │
        │◀───────────────────────────────────────────────────────│
        │                             │                          │
        │  9. POST /api/auth/         │                          │
        │     oauth2/token            │                          │
        │────────────────────────────▶│                          │
        │  10. access_token (JWT)     │                          │
        │◀────────────────────────────│                          │
        │                             │                          │
        │  11. POST /api/mcp (Bearer) │                          │
        │────────────────────────────▶│                          │
        │  12. MCP tool results       │                          │
        │◀────────────────────────────│                          │
```

## Key Files

| File                                       | Purpose                                                                      |
| ------------------------------------------ | ---------------------------------------------------------------------------- |
| `packages/auth/src/index.ts`               | Better Auth config with `jwt()` + `oauthProvider()` plugins                  |
| `packages/auth/src/schema-config.ts`       | Schema-generation-only copy (avoids runtime env during codegen)              |
| `apps/api/src/routes/well-known.ts`        | `.well-known` endpoint handlers (OpenID, OAuth metadata, protected resource) |
| `apps/api/src/index.ts`                    | api entrypoint — mounts `.well-known/*` at host root and the auth catch-all  |
| `apps/web/src/routes/oauth/consent.tsx`    | User-facing consent page (approve/deny scopes)                               |
| `apps/api/src/routes/mcp.ts`               | MCP server endpoint (Streamable HTTP transport)                              |
| `apps/web/src/lib/auth-client.ts`          | Client-side auth with `oauthProviderClient()` plugin                         |

## Auth Configuration

The OAuth provider is configured in `packages/auth/src/index.ts`:

```typescript
plugins: [
  jwt({ disableSettingJwtHeader: true }),
  lastLoginMethod(),
  oauthProvider({
    loginPage: '/login',
    consentPage: '/oauth/consent',
    allowDynamicClientRegistration: true,
    allowUnauthenticatedClientRegistration: true,
    scopes: ['openid', 'profile', 'email', 'offline_access', 'mcp:tools'],
    validAudiences: [`${env.BASE_URL}/api/mcp`],
  }),
],
```

- **`allowDynamicClientRegistration`** — MCP clients register themselves at runtime via RFC 7591.
- **`allowUnauthenticatedClientRegistration`** — Public MCP clients don't have pre-existing credentials.
- **`scopes`** — `mcp:tools` is a custom scope for MCP tool invocation. Standard OIDC scopes are also supported.
- **`validAudiences`** — JWTs are scoped to the MCP endpoint URL.
- **`disabledPaths: ['/token']`** — The built-in `/token` path is disabled because `oauthProvider` provides its own token endpoint.

## Well-Known Endpoints

RFC 8615 requires well-known URIs at the host root. The api app mounts `wellKnownRoutes` at `/.well-known/*` directly (`apps/api/src/index.ts`). In dev, the SPA's Vite proxy forwards `/.well-known/*` to the api so the same origin serves both UI and discovery documents.

| Endpoint                                           | Spec                     | Purpose                                                                                      |
| -------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------- |
| `/.well-known/openid-configuration`                | OpenID Connect Discovery | OIDC metadata document                                                                       |
| `/.well-known/oauth-authorization-server`          | RFC 8414                 | OAuth server metadata                                                                        |
| `/.well-known/oauth-authorization-server/api/auth` | RFC 8414                 | Same, scoped to auth path                                                                    |
| `/.well-known/oauth-protected-resource`            | RFC 9728                 | Points MCP clients to `/api/mcp` as the resource and `/api/auth` as the authorization server |

The OpenID and OAuth server handlers are lazily cached (singleton pattern). The protected resource handler currently creates a new auth client per request.

## Consent Page

`src/routes/oauth/consent.tsx` — displayed when an MCP client requests authorization.

- Reads `client_id` and `scope` from URL search params.
- Fetches client info via `authClient.oauth2.publicClient()`.
- Displays the application name, URI, and human-readable scope descriptions.
- "Allow" calls `authClient.oauth2.consent({ accept: true })` and redirects to the returned URI.
- "Deny" calls `authClient.oauth2.consent({ accept: false })`.

Scope descriptions:

| Scope            | Description shown to user                         |
| ---------------- | ------------------------------------------------- |
| `openid`         | Verify your identity                              |
| `profile`        | View your name and profile picture                |
| `email`          | View your email address                           |
| `offline_access` | Stay connected when you are not actively using it |
| `mcp:tools`      | Use tools on your behalf                          |

## MCP Endpoint

`apps/api/src/routes/mcp.ts` — the Model Context Protocol server.

- Uses `mcpHandler` from `@better-auth/oauth-provider` for JWT verification against the local JWKS endpoint (`/api/auth/jwks`).
- The JWKS URL uses `localhost` to avoid the server fetching itself through the public URL (DNS, TLS, potential deadlocks).
- **Stateless mode**: creates a fresh `McpServer` + `WebStandardStreamableHTTPServerTransport` per request.
- Currently registers a single `hello` tool for testing the OAuth flow.
- Handles `GET`, `POST`, `DELETE`, and `OPTIONS` HTTP methods.

## Dev CORS

CORS for MCP Inspector is handled by Hono's `cors()` middleware in `apps/api/src/index.ts`. `TRUSTED_ORIGINS` in env controls the allowed origins; in development this typically includes `http://localhost:6274` (MCP Inspector). If you add MCP-specific response headers later (e.g. `Mcp-Session-Id`), expose them via the `cors()` config.

## Database Tables

The `oauthProvider` plugin adds these tables (managed by Better Auth, defined in `packages/db/src/schema/auth.ts`):

| Table                 | Purpose                                         |
| --------------------- | ----------------------------------------------- |
| `jwks`                | JSON Web Key Sets for JWT signing/verification  |
| `oauth_client`        | Registered OAuth clients (dynamic registration) |
| `oauth_access_token`  | Issued access tokens                            |
| `oauth_refresh_token` | Issued refresh tokens                           |
| `oauth_consent`       | User consent records per client                 |

Migration: `packages/db/drizzle/0002_add-oauth.sql`

## Dependencies

## Dependencies

- `@better-auth/oauth-provider` — OAuth 2.1 Authorization Server plugin for Better Auth (in `packages/auth`)
- `@modelcontextprotocol/sdk` — Official MCP SDK (in `apps/api`)

## Testing with MCP Inspector

1. Start the dev servers: `bun dev` at the repo root (boots web on :3000 and api on :3401).
2. Open [MCP Inspector](https://inspector.tools/)
3. Connect to `http://localhost:3000/api/mcp` (Vite proxies `/api/*` to the api on :3401, so the MCP client sees a single origin).
4. The inspector will discover endpoints via `.well-known`, register as a client, and prompt you to log in and consent
5. After authorization, you can invoke the `hello` tool

## References

- [MCP Authorization Spec](https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization)
- [Better Auth OAuth Provider Plugin](https://better-auth.com/docs/plugins/oauth-provider)
- [OAuth 2.1 Draft](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-12)
- [RFC 7591 — Dynamic Client Registration](https://datatracker.ietf.org/doc/html/rfc7591)
- [RFC 8414 — OAuth Server Metadata](https://datatracker.ietf.org/doc/html/rfc8414)
- [RFC 9728 — Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728)
