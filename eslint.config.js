import js from '@eslint/js';
import globals from 'globals';
// Add TypeScript support
import tseslint from 'typescript-eslint';

/** @type {import("eslint").Linter.FlatConfig[]} */
export default [
    js.configs.recommended,
    // TypeScript recommended config
    ...tseslint.configs.recommended,
    {
        files: ['**/*.test.js', '**/*.spec.js', '**/*.test.ts', '**/*.spec.ts'],
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.jest,
                // Add TypeScript test globals if needed
            },
        },
    },
    {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            parser: tseslint.parser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                project: './tsconfig.json',
            },
            globals: globals.node,
        },
        rules: {
            indent: ['error', 4],
            'linebreak-style': ['error', 'windows'],
            quotes: ['error', 'single'],
            semi: ['error', 'always'],
            'no-unused-vars': 'off',
            'no-undef': 'off', // TypeScript handles this
            // TypeScript-specific rules
            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/no-undef': 'off',
        },
        ignores: [
            'node_modules/',
            'logs/',
            'uploads/',
            'ecosystem.*.config.js',
        ],
    },
];
