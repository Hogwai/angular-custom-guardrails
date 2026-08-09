import nx from '@nx/eslint-plugin';
import { rule as maxPipeDepth } from './tools/angular-guardrails/max-pipe-depth';
import { rule as noIndexTrack } from './tools/angular-guardrails/no-index-track';
import { rule as noNestedSubscribe } from './tools/angular-guardrails/no-nested-subscribe';
import baseConfig from '../../eslint.config.mjs';
import templateParser from '@angular-eslint/template-parser';
import tsParser from '@typescript-eslint/parser';

/**
 * Local composition: the playground consumes each rule from its own local
 * copies under tools/angular-guardrails, like a standalone application that
 * copied the rules into its own source tree.
 */
const customGuardrails = {
  rules: {
    'max-pipe-depth': maxPipeDepth,
    'no-index-track': noIndexTrack,
    'no-nested-subscribe': noNestedSubscribe,
  },
};

export default [
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  ...baseConfig,
  {
    ignores: ['eslint.config.ts', 'tests/**/*.ts'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: {
          allowDefaultProject: ['eslint.config.ts', 'tests/*.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
      'custom-guardrails/max-pipe-depth': ['error', { max: 3 }],
      'custom-guardrails/no-nested-subscribe': 'error',
    },
    plugins: {
      'custom-guardrails': customGuardrails,
    },
  },
  {
    files: ['**/*.html'],
    languageOptions: {
      parser: templateParser,
    },
    plugins: {
      'custom-guardrails': customGuardrails,
    },
    rules: {
      'custom-guardrails/no-index-track': 'error',
    },
  },
];
