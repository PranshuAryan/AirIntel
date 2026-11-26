import js from '@eslint/js';
import globals from 'globals';
import hooks from 'eslint-plugin-react-hooks';
import a11y from 'eslint-plugin-jsx-a11y';

export default [
  {ignores: ['dist', 'node_modules', 'public']},
  js.configs.recommended,
  a11y.flatConfigs.recommended,
  {
    files: ['src/**/*.{js,jsx}', 'tests/**/*.{js,jsx}'],
    languageOptions: {ecmaVersion: 2023, sourceType: 'module', globals: {...globals.browser}, parserOptions: {ecmaFeatures: {jsx: true}}},
    plugins: {'react-hooks': hooks},
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-unused-vars': ['warn', {args: 'none', varsIgnorePattern: '^_|^[A-Z]', caughtErrors: 'none'}],
      'no-empty': ['error', {allowEmptyCatch: true}],
    },
  },
  {files: ['api/**/*.js', 'vite.config.js', 'eslint.config.js'], languageOptions: {ecmaVersion: 2023, sourceType: 'module', globals: {...globals.node}}},
];
