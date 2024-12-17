import { fixupPluginRules } from '@eslint/compat';
import js from '@eslint/js';
import reactPlugin from 'eslint-plugin-react';
import hooksPlugin from 'eslint-plugin-react-hooks';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: ['dist/**/*', '.git/**/*', 'node_modules/**/*', 'src/generated/**/*', 'jobs/archived/*.js'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactPlugin.configs.flat.recommended,
  {
    plugins: {
      'react-hooks': fixupPluginRules(hooksPlugin),
    },
    rules: { ...hooksPlugin.configs.recommended.rules },
  },
  {
    // TODO: Use react-refresh to validate React fast refresh.
    plugins: { 'simple-import-sort': simpleImportSort },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      'no-console': 0,
      'global-require': 0,
      'no-param-reassign': 0,
      'no-underscore-dangle': [
        'error',
        {
          allow: ['_id', '_carddict'],
        },
      ],
      camelcase: [
        'error',
        {
          properties: 'never',
          ignoreDestructuring: true,
          ignoreImports: true,
          allow: ['tcgplayer_id'],
        },
      ],
      'no-plusplus': [
        'error',
        {
          allowForLoopAfterthoughts: true,
        },
      ],
      'no-restricted-syntax': ['error', 'WithStatement', 'LabeledStatement', "BinaryExpression[operator='in']"],
      eqeqeq: 'error',
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            // Node.js builtins prefixed with `node:`.
            ['^node:'],
            // react .
            ['^react$'],
            // Packages.
            // Things that start with a letter (or digit or underscore), or `@` followed by a letter.
            ['^@?\\w'],
            // Absolute imports and other imports such as Vue-style `@/foo`.
            // Anything not matched in another group.
            ['^'],
            // src-relative imports
            [
              '^(analytics|assets|components|contexts|datatypes|drafting|filtering|generated|hooks|layouts|markdown|pages|res|utils)/',
            ],
            // Relative imports.
            // Anything that starts with a dot.
            ['^\\.'],
          ],
        },
      ],
      'simple-import-sort/exports': 'error',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-object-type': ['error', { allowInterfaces: 'with-single-extends' }],
      'react/jsx-filename-extension': 'off',
      'react/jsx-one-expression-per-line': 'off',
      'react/jsx-props-no-spreading': 'off',
      'react/no-unescaped-entities': [
        'error',
        {
          forbid: ['>', '\\', '}'],
        },
      ],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      // 'react-refresh/only-export-components': [
      //   'error',
      //   {
      //     allowConstantExport: true,
      //   },
      // ],
    },
  },
  {
    files: ['src/**/*', 'public/js/**/*'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    files: ['src/**/*'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: ['./*', '../*'],
        },
      ],
    },
  },
  {
    files: ['src/**/*.js'],
    rules: {
      'react/jsx-key': 'off',
    },
  },
  {
    files: ['src/**/*.tsx'],
    rules: {
      'react/prop-types': 'off',
    },
  },
  {
    files: [
      '*.js',
      '*.mjs',
      'jobs/**/*',
      'one_shot_scripts/**/*',
      'config/**/*',
      'dynamo/**/*',
      'lambda/**/*',
      'routes/**/*',
      'serverjs/**/*',
      'models/**/*',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['dynamo/**/*', 'routes/**/*', 'serverjs/**/*', 'models/**/*'],
    rules: {
      'no-console': 'error',
    },
  },
  {
    files: ['src/markdown/**/micromark-*'],
    rules: {
      'no-use-before-define': ['error', 'nofunc'],
    },
  },
  {
    files: ['models/**/*'],
    rules: {
      'no-underscore-dangle': [
        'error',
        {
          allowAfterThis: true,
        },
      ],
    },
  },
  {
    files: ['one_shot_scripts/**/*'],
    rules: {
      'no-await-in-loop': 0,
    },
  },
];
