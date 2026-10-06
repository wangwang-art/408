// Metro 配置：使用 Expo 的 Metro 配置（支持 expo 模块解析、asset 等）
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;
