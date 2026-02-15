import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['emails/index.ts'],
  noExternal: [/.*/],
  external: ['react', 'react-dom'],
  inlineOnly: false,
});
