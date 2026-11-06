import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  // poc/: Wegwerf-Prototypen (Browser-Skripte ohne Build)
  { ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', 'poc/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
);
