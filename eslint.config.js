import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default defineConfig([
  { ignores: ['dist/**', 'legacy/**', 'node_modules/**'] },
  {
    files: ['**/*.{ts,js}'],
    extends: [js.configs.recommended, tseslint.configs.strict],
    languageOptions: { globals: globals.browser },
  },
  prettier,
]);
