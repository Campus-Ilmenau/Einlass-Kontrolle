import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  // poc/: Wegwerf-Prototypen (Browser-Skripte ohne Build)
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      'poc/**',
      // kopierte Tesseract-Dateien (Build-Artefakt)
      'apps/web/public/ocr/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  // Node-Skripte (Build-Hilfen)
  {
    files: ['apps/*/scripts/**/*.mjs'],
    languageOptions: { globals: { console: 'readonly', process: 'readonly' } },
  },
);
