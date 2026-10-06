/**
 * App —— 应用根组件
 *
 * 职责：
 * 1. 应用启动时初始化 SQLite 数据库（initDB）与音频缓存目录（ensureAudioDirs）
 * 2. 按层级组装全局 Providers：GestureHandlerRootView -> SafeAreaProvider -> AppProvider
 *    -> NavigationContainer -> AppNavigator
 */
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { AppProvider } from './src/context/AppContext';
import * as StorageService from './src/services/StorageService';
import { ensureAudioDirs } from './src/utils/fileHelper';
import { AVAILABLE_BOOKS } from './src/config';
import * as FileSystem from 'expo-file-system';
import AppNavigator from './src/navigation/AppNavigator';

// 崩溃日志兜底：把 JS 运行时异常写入 {documentDirectory}/vocab-error.log
// release 版闪退时手机上看不到日志，通过此文件定位根因。
const ERROR_LOG = `${FileSystem.documentDirectory}vocab-error.log`;

function logCrash(tag, message, stack) {
  try {
    const line = `[${new Date().toISOString()}] ${tag}: ${message}\n${stack || ''}\n`;
    FileSystem.writeAsStringAsync(ERROR_LOG, line, { encoding: FileSystem.EncodingType.UTF8 }).catch(
      () => {}
    );
  } catch (e) {}
}

export default function App() {
  // 捕获未处理的 Promise 异常
  useEffect(() => {
    const handler = (error) => {
      logCrash('unhandledRejection', String(error?.message || error), error?.stack);
    };
    globalThis.addEventListener?.('unhandledrejection', handler);
    return () => globalThis.removeEventListener?.('unhandledrejection', handler);
  }, []);

  // 捕获 JS 错误
  useEffect(() => {
    const handler = (error) => {
      logCrash('error', String(error?.message || error), error?.stack);
    };
    globalThis.addEventListener?.('error', handler);
    return () => globalThis.removeEventListener?.('error', handler);
  }, []);

  // 应用启动：初始化数据库与音频目录（失败不阻塞界面，仅告警）
  useEffect(() => {
    (async () => {
      try {
        await StorageService.initDB();
        await ensureAudioDirs(AVAILABLE_BOOKS);
      } catch (e) {
        console.warn('初始化数据库或音频目录失败:', e);
        logCrash('initDB', String(e?.message || e), e?.stack);
      }
    })();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <NavigationContainer>
            <StatusBar style="dark" />
            <AppNavigator />
          </NavigationContainer>
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
