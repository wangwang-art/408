const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  // 全局忽略：依赖、构建产物、HTML 设计原型
  { ignores: ['node_modules/', 'android/', 'pages/', 'assets/'] },

  // 根目录配置文件与 tools 下的 Node 脚本（CommonJS）
  {
    files: ['*.config.js', 'tools/**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
  },

  js.configs.recommended,
  {
    // 应用源码（RN + JSX，ES Module）
    files: ['App.js', 'src/**/*.js', '__tests__/**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        ...globals.browser,
        ...globals.jest,
        React: 'readonly',
        __DEV__: 'readonly',
        require: 'readonly',
        module: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
];
