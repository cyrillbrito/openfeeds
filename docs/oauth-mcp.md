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

| File                           | Purpose                                                                      |
| ------------------------------ | ---------------------------------------------------------------------------- |
| `src/server/auth.ts`           | Better Auth config with `jwt()` + `oauthProvider()` plugins                  |
| `src/server/auth.schema.ts`    | Schema-generation-only copy (avoids runtime env during codegen)              |
| `src/server/well-known.ts`     | `.well-known` endpoint handlers (OpenID, OAuth metadata, protected resource) |
| `src/server/dev-cors.ts`       | Development-only CORS middleware for MCP Inspector                           |
| `src/server.ts`                | Server entry — wires `.well-known` interception and dev CORS                 |
| `src/routes/oauth/consent.tsx` | User-facing consent page (approve/deny scopes)                               |
| `src/routes/api/mcp/$.ts`      | MCP server endpoint (Streamable HTTP transport)                              |
| `src/lib/auth-client.ts`       | Client-side auth with `oauthProviderClient()` plugin                         |

## Auth Configuration

The OAuth provider is configured in `src/server/auth.ts`:

```typescript
plugins: [
  jwt(),
  oauthProvider({
    loginPage: '/signin',
    consentPage: '/oauth/consent',
    allowDynamicClientRegistration: true,
    allowUnauthenticatedClientRegistration: true,
    scopes: ['openid', 'profile', 'email', 'offline_access', 'mcp:tools'],
    validAudiences: [`${env.BASE_URL}/api/mcp`],
  }),
  tanstackStartCookies(),
],
```

- **`allowDynamicClientRegistration`** — MCP clients register themselves at runtime via RFC 7591.
- **`allowUnauthenticatedClientRegistration`** — Public MCP clients don't have pre-existing credentials.
- **`scopes`** — `mcp:tools` is a custom scope for MCP tool invocation. Standard OIDC scopes are also supported.
- **`validAudiences`** — JWTs are scoped to the MCP endpoint URL.
- **`disabledPaths: ['/token']`** — The built-in `/token` path is disabled because `oauthProvider` provides its own token endpoint.

## Well-Known Endpoints

TanStack Start's file-based router can't handle dotfile paths (`.well-known`), so they're intercepted in `src/server.ts` and routed to `src/server/well-known.ts`.

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

`src/routes/api/mcp/$.ts` — the Model Context Protocol server.

- Uses `mcpHandler` from `@better-auth/oauth-provider` for JWT verification against the local JWKS endpoint (`/api/auth/jwks`).
- The JWKS URL uses `localhost` to avoid the server fetching itself through the public URL (DNS, TLS, potential deadlocks).
- **Stateless mode**: creates a fresh `McpServer` + `WebStandardStreamableHTTPServerTransport` per request.
- Currently registers a single `hello` tool for testing the OAuth flow.
- Handles `GET`, `POST`, `DELETE`, and `OPTIONS` HTTP methods.

## Dev CORS Middleware

`src/server/dev-cors.ts` — wraps the server's fetch handler.

- **Production**: no-op passthrough (tree-shaken via `process.env.NODE_ENV` check).
- **Development**: adds permissive CORS headers for MCP Inspector and other local tools. Handles `OPTIONS` preflight with 204. Exposes `Mcp-Session-Id` and `Mcp-Protocol-Version` headers.

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

Added to `apps/web/package.json`:

- `@better-auth/oauth-provider` — OAuth 2.1 Authorization Server plugin for Better Auth
- `@modelcontextprotocol/sdk` — Official MCP SDK (server, transport, tool registration)

## Testing with MCP Inspector

1. Start the dev server: `bun dev`
2. Open [MCP Inspector](https://inspector.tools/)
3. Connect to `http://localhost:3000/api/mcp`
4. The inspector will discover endpoints via `.well-known`, register as a client, and prompt you to log in and consent
5. After authorization, you can invoke the `hello` tool

## References

- [MCP Authorization Spec](https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization)
- [Better Auth OAuth Provider Plugin](https://better-auth.com/docs/plugins/oauth-provider)
- [OAuth 2.1 Draft](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-12)
- [RFC 7591 — Dynamic Client Registration](https://datatracker.ietf.org/doc/html/rfc7591)
- [RFC 8414 — OAuth Server Metadata](https://datatracker.ietf.org/doc/html/rfc8414)
- [RFC 9728 — Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728)
