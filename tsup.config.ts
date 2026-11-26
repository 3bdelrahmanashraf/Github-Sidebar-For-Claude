import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['better-sqlite3', 'keytar'],
  noExternal: ['zod', '@octokit/rest', '@octokit/graphql'],
  banner: {
    js: '#!/usr/bin/env node',
  },
});