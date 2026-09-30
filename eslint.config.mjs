// @ts-check
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import configPrettier from 'eslint-config-prettier'

/**
 * Flat ESLint config for the cogNNitive monorepo.
 *
 * Scope: TypeScript across all workspaces + Vue SFCs in iNNfo/apps/innfo-editor.
 * Formatting is delegated to Prettier (configPrettier disables stylistic rules),
 * so ESLint focuses on correctness and consistency only.
 */
export default tseslint.config(
  {
    // Global ignores — build output, deps, test artifacts, docs, assets, temp.
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/e2e-reports/**',
      '**/test-results/**',
      '**/playwright-report/**',
      '**/*.snap',
      'archive/**',
      'docs/**',
      'temp/**',
      '_samples_nn/**',
      'simulation/**',
      'workspace_NN/**',
      'skills/**',
      '.agents/**',
      '.atl/**',
      '.claude/**',
      '.github/**',
      'openspec/**',
      // Published/built site output (bundled + minified) — not source.
      '**/*.min.js',
      '**/*.bundle.js',
      'iNNfo/packages/innfo-mcp/bin/**',
      // Peggy-generated parser (rebuilt via `npm run build:grammar`), not hand-written source.
      'iNNfo/packages/innfo-video-parser/src/parser/vus_parser.js',
      'iNNfo/apps/innfo-editor/scratch_graph_test.mjs',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  // 'essential' covers correctness only; Prettier owns formatting/style, so we
  // deliberately avoid 'flat/recommended' to prevent overlapping style rules.
  ...pluginVue.configs['flat/essential'],

  {
    // Vue SFCs use the Vue parser with the TS parser for <script> blocks.
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
  },

  {
    files: ['**/*.{ts,mts,vue}'],
    rules: {
      // TypeScript already resolves globals (DOM lib types like
      // FileSystemDirectoryHandle); the core `no-undef` rule can't and produces
      // false positives, so it must be off for TS/Vue.
      'no-undef': 'off',

      // ── Ratchet backlog ─────────────────────────────────────────────
      // These are real debt but non-blocking. Kept as warnings so `lint`
      // (which gates on errors) passes on the existing codebase while the
      // count is driven down over time. New code should not add to them.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'no-useless-escape': 'warn',
      '@typescript-eslint/no-this-alias': 'warn',
      '@typescript-eslint/prefer-as-const': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      // Direct prop mutation (BlockSheet.vue) — tracked for a data-flow fix
      // that routes edits through the store; see the SDD change tasks.
      'vue/no-mutating-props': 'warn',
      'vue/no-unused-vars': 'warn',

      // Component files here are intentionally single-word (Header, Badge, ...).
      'vue/multi-word-component-names': 'off',
    },
  },

  {
    // Ported VUS parser: switch-case lexical declarations are kept as-is so the
    // port stays behaviourally comparable with its upstream; tracked as debt.
    files: ['iNNfo/packages/innfo-video-parser/src/**/*.ts'],
    rules: {
      'no-case-declarations': 'warn',
    },
  },

  {
    // Node-context config and script files (including template harness
    // scripts under specs/, e.g. metrics verify.harness.js).
    files: ['**/*.config.{js,ts,mjs}', 'scripts/**/*.{js,mjs,ts}', 'iNNfo/specs/**/scripts/**/*.js', '**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        console: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        global: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
      },
    },
    rules: {
      // CJS require() is legitimate in Node harness scripts.
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'no-empty': 'warn',
      'no-useless-escape': 'warn',
      'no-regex-spaces': 'warn',
    },
  },

  configPrettier,
)
