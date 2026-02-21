import { createSignal, For, Show } from 'solid-js';

const clients = [
  {
    id: 'claude',
    name: 'Claude Desktop',
    file: '~/.claude/claude_desktop_config.json',
    fileNote: 'Settings > Developer > Edit Config',
    config: `{
  "mcpServers": {
    "openfeeds": {
      "url": "https://openfeeds.app/api/mcp"
    }
  }
}`,
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    file: 'Settings > MCP Servers > Add',
    fileNote: 'Paste the server URL when adding a new MCP server',
    config: `https://openfeeds.app/api/mcp`,
  },
  {
    id: 'cursor',
    name: 'Cursor',
    file: '~/.cursor/mcp.json',
    fileNote: 'Settings > MCP > Add new global MCP server',
    config: `{
  "mcpServers": {
    "openfeeds": {
      "url": "https://openfeeds.app/api/mcp"
    }
  }
}`,
  },
  {
    id: 'vscode',
    name: 'VS Code',
    file: '.vscode/mcp.json',
    fileNote: 'Or add via Command Palette > MCP: Add Server',
    config: `{
  "servers": {
    "openfeeds": {
      "url": "https://openfeeds.app/api/mcp"
    }
  }
}`,
  },
] as const;

type ClientId = (typeof clients)[number]['id'];

export default function SetupTabs() {
  const [active, setActive] = createSignal<ClientId>(clients[0].id);
  const [copied, setCopied] = createSignal(false);

  const current = () => clients.find((c) => c.id === active())!;

  const copyConfig = async () => {
    await navigator.clipboard.writeText(current().config);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div class="mx-auto max-w-2xl">
      {/* Tab buttons */}
      <div class="mb-6 flex flex-wrap justify-center gap-2">
        <For each={clients}>
          {(client) => (
            <button
              type="button"
              onClick={() => {
                setActive(client.id);
                setCopied(false);
              }}
              class={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                active() === client.id
                  ? 'bg-foreground text-white'
                  : 'bg-foreground/10 text-foreground/70 hover:bg-foreground/20'
              }`}
            >
              {client.name}
            </button>
          )}
        </For>
      </div>

      {/* Config display */}
      <div class="border-foreground/15 overflow-hidden rounded-xl border-2 bg-white">
        {/* File path hint */}
        <div class="border-foreground/10 flex items-center justify-between border-b px-4 py-3">
          <div>
            <code class="text-foreground/70 font-mono text-sm">{current().file}</code>
            <Show when={current().fileNote}>
              <p class="text-foreground/50 mt-0.5 text-xs">{current().fileNote}</p>
            </Show>
          </div>
          <button
            type="button"
            onClick={copyConfig}
            class="bg-foreground/10 text-foreground/70 hover:bg-foreground/20 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
          >
            <Show
              when={!copied()}
              fallback={
                <>
                  <svg
                    class="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Copied
                </>
              }
            >
              <svg
                class="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy
            </Show>
          </button>
        </div>

        {/* Code block */}
        <pre class="overflow-x-auto px-5 py-4 text-sm leading-relaxed">
          <code class="text-foreground/90 font-mono">{current().config}</code>
        </pre>
      </div>

      <p class="text-foreground/50 mt-4 text-center text-sm">
        You'll be prompted to authorize OpenFeeds on first use.
      </p>
    </div>
  );
}
