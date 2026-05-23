/**
 * Human-readable descriptions for OAuth scopes shown to the user during the
 * consent flow (`/oauth/consent`) and in the connections settings page
 * (`/settings/connections`). Unknown scopes fall back to the raw scope name.
 */
export const SCOPE_DESCRIPTIONS: Record<string, string> = {
  openid: 'Verify your identity',
  profile: 'View your name and profile picture',
  email: 'View your email address',
  offline_access: 'Stay connected when you are not actively using it',
  'mcp:tools': 'Use MCP tools to manage your feeds, articles, and tags',
};
