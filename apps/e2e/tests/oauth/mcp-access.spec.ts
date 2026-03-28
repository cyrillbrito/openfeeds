import { expect } from '@playwright/test';
import { test } from '../../fixtures/auth-fixture';
import {
  getTokensViaConsent,
  MCP_INITIALIZE_MESSAGE,
  parseMcpResponse,
  sendMcpMessage,
} from '../../utils/oauth';

test.describe('MCP Endpoint Access Control', () => {
  test.setTimeout(30_000);

  test('rejects requests without a token', async ({ request }) => {
    const { response } = await sendMcpMessage(request, '', MCP_INITIALIZE_MESSAGE);

    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('rejects requests with an invalid token', async ({ request }) => {
    const { response } = await sendMcpMessage(request, 'invalid.jwt.token', MCP_INITIALIZE_MESSAGE);

    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('rejects tokens without mcp:tools scope', async ({ page, request, user }) => {
    // Deliberately request openid+profile only — no mcp:tools
    const { tokens } = await getTokensViaConsent(page, request, {
      scope: 'openid profile',
    });
    expect(tokens.access_token).toBeDefined();

    // Token lacks mcp:tools scope — MCP should reject
    const { response: mcpResponse } = await sendMcpMessage(
      request,
      tokens.access_token,
      MCP_INITIALIZE_MESSAGE,
    );
    expect(mcpResponse.status()).toBeGreaterThanOrEqual(400);
  });

  test('rejects token issued without the MCP resource audience', async ({
    page,
    request,
    user,
  }) => {
    // Get a valid token but WITHOUT specifying the `resource` parameter.
    // The resulting JWT will lack the MCP audience claim.
    const { tokens } = await getTokensViaConsent(page, request, {
      scope: 'openid profile mcp:tools',
      includeResource: false,
    });
    expect(tokens.access_token).toBeDefined();

    // Try MCP with this token — should be rejected (wrong/missing audience)
    const { response: mcpResponse } = await sendMcpMessage(
      request,
      tokens.access_token,
      MCP_INITIALIZE_MESSAGE,
    );
    expect(mcpResponse.status()).toBeGreaterThanOrEqual(400);
  });

  test('accepts valid token and returns tool results', async ({ page, request, user }) => {
    const { tokens } = await getTokensViaConsent(page, request, {
      scope: 'openid profile mcp:tools',
    });

    const { response: mcpResponse } = await sendMcpMessage(
      request,
      tokens.access_token,
      MCP_INITIALIZE_MESSAGE,
    );

    expect(mcpResponse.ok()).toBeTruthy();
    const initResult = await parseMcpResponse(mcpResponse);
    expect(initResult.jsonrpc).toBe('2.0');
    expect((initResult.result as Record<string, unknown>).serverInfo).toBeDefined();
    expect((initResult.result as Record<string, unknown>).protocolVersion).toBeDefined();
  });

  test('tool call returns correct response through auth layer', async ({ page, request, user }) => {
    const { tokens } = await getTokensViaConsent(page, request, {
      scope: 'openid profile mcp:tools',
    });

    // Initialize first to confirm the session setup
    const { response: initResponse } = await sendMcpMessage(
      request,
      tokens.access_token,
      MCP_INITIALIZE_MESSAGE,
    );
    expect(initResponse.ok()).toBeTruthy();

    // Call the "hello" tool — each request gets a fresh server in stateless mode
    const { response: toolResponse } = await sendMcpMessage(request, tokens.access_token, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'hello', arguments: { name: 'E2E' } },
    });

    expect(toolResponse.ok()).toBeTruthy();
    const toolResult = await parseMcpResponse(toolResponse);
    expect(toolResult.jsonrpc).toBe('2.0');
    expect(toolResult.id).toBe(2);
    const result = toolResult.result as Record<string, unknown>;
    const content = result.content as Array<Record<string, unknown>>;
    expect(content).toBeDefined();
    expect(content[0].type).toBe('text');
    expect(content[0].text).toContain('Hello, E2E');
  });
});
