import { resolve } from 'path';
import { defineConfig, AliasOptions } from 'vite';
import react from '@vitejs/plugin-react';
import checker from 'vite-plugin-checker';
import reactSvgPlugin from 'vite-plugin-react-svg';
import * as tsconfig from './tsconfig.json';

// Resolve path aliases from `tsconfig.json`
const tsconfigAliases = tsconfig.compilerOptions.paths;
const aliasOptions: AliasOptions = {};

Object.entries(tsconfigAliases).forEach((aliasEntry) => {
  const [_alias, paths] = aliasEntry;

  // Strip glob from the end of path
  // Ex: "path/*" -> "path"

  const pathEndGlobRegex = /[/*]*$/;
  const alias = _alias.replace(pathEndGlobRegex, '');
  const resolutionPath = resolve(
    __dirname,
    paths[0].replace(pathEndGlobRegex, ''),
  );

  aliasOptions[alias] = resolutionPath;
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    reactSvgPlugin({
      titleProp: true,
      expandProps: 'end',
      defaultExport: 'url',
    }),
    checker({ typescript: true }),
  ],

  // Specify output directory
  build: {
    outDir: resolve(__dirname, 'out'),
  },

  resolve: {
    alias: aliasOptions,
  },

  // Enforce relative path
  base: '',
  root: resolve(__dirname, 'src', 'renderer'),
});
