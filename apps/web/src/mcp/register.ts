import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerListArticles } from './list-articles';
import { registerListFeeds } from './list-feeds';
import { registerManageArticles } from './manage-articles';
import { registerManageFeeds } from './manage-feeds';
import { registerManageTags } from './manage-tags';

/**
 * Register all MCP tools on the server instance.
 * Each tool gets the authenticated userId from the JWT.
 */
export function registerTools(server: McpServer, userId: string) {
  // Read-only tools
  registerListFeeds(server, userId);
  registerListArticles(server, userId);

  // Mutation tools
  registerManageFeeds(server, userId);
  registerManageArticles(server, userId);
  registerManageTags(server, userId);
}
