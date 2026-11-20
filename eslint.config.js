// ESLint flat config. The import restrictions ARE the architecture (vault: Repo Layout):
//   web    -> sync, editor, ui, shared   (never yjs / y-* / hocuspocus directly)
//   editor -> sync types, codemirror     (never yjs / hocuspocus)
//   sync   -> yjs, hocuspocus            (never react)
//   ui     -> react, shared              (never sync / yjs)
import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const YJS_STACK = ['yjs', 'y-*', 'y-protocols/*', '@hocuspocus/*', 'lib0', 'lib0/*']

const restrict = (patterns, message) => ({
  'no-restricted-imports': ['error', { patterns: [{ group: patterns, message }] }],
})

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/data/**',
      '**/coverage/**',
      '**/target/**',
      '**/src-tauri/gen/**',
      'apps/web/public/downloads/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}', 'packages/ui/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    rules: restrict(YJS_STACK, 'The UI never touches Yjs directly. Go through @hydras/sync.'),
  },
  {
    files: ['packages/editor/**/*.ts'],
    rules: restrict(
      ['yjs', '@hocuspocus/*', 'y-indexeddb', 'react', 'react-dom'],
      'The editor binds a FileBinding from @hydras/sync; it does not own Yjs or the network.',
    ),
  },
  {
    files: ['packages/sync/**/*.ts'],
    rules: restrict(
      ['react', 'react-dom', 'react/*', '@hydras/ui', '@hydras/editor'],
      'sync is framework-free.',
    ),
  },
  {
    files: ['packages/ui/**/*.{ts,tsx}'],
    rules: restrict([...YJS_STACK, '@hydras/sync', '@hydras/editor'], 'ui is presentational only.'),
  },
)
