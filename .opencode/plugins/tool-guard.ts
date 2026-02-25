import type { Plugin } from '@opencode-ai/plugin';

const GIT_COMMANDS = /^\s*git\s+/;
const NPM_COMMANDS = /^\s*npm\s+/;
const PNPM_COMMANDS = /^\s*pnpm\s+/;
const NPX_COMMANDS = /^\s*npx\s+/;

export const ToolGuard: Plugin = async () => {
  return {
    'tool.execute.before': async (input, output) => {
      if (input.tool !== 'bash') return;

      const cmd = output.args.command;

      if (GIT_COMMANDS.test(cmd)) {
        const rewritten = cmd.replace(GIT_COMMANDS, 'but ');
        output.args.command = `echo "[tool-guard] Rewritten: git → but" && ${rewritten}`;
        output.args.description = `[GitButler CLI] ${output.args.description ?? rewritten}`;
      }

      if (NPM_COMMANDS.test(cmd)) {
        const rewritten = cmd.replace(NPM_COMMANDS, 'bun ');
        output.args.command = `echo "[tool-guard] Rewritten: npm → bun" && ${rewritten}`;
        output.args.description = `[bun] ${output.args.description ?? rewritten}`;
      }

      if (PNPM_COMMANDS.test(cmd)) {
        const rewritten = cmd.replace(PNPM_COMMANDS, 'bun ');
        output.args.command = `echo "[tool-guard] Rewritten: pnpm → bun" && ${rewritten}`;
        output.args.description = `[bun] ${output.args.description ?? rewritten}`;
      }

      if (NPX_COMMANDS.test(cmd)) {
        const rewritten = cmd.replace(NPX_COMMANDS, 'bunx ');
        output.args.command = `echo "[tool-guard] Rewritten: npx → bunx" && ${rewritten}`;
        output.args.description = `[bunx] ${output.args.description ?? rewritten}`;
      }
    },
  };
};
