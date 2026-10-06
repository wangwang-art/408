/**
 * AppNavigator —— 应用导航栈
 *
 * 路由结构：
 * - Home       首页（词本选择 / 统计概览 / 预加载入口，无导航栏）
 * - Review     复习页（到期单词卡片复习）
 * - Stats      学习统计页
 * - WordDetail 单词详情页
 *
 * 统一导航栏样式：白底、深色标题、无返回文字。
 * 说明：App.js 外层已由其他模块负责（GestureHandlerRootView / SafeAreaProvider /
 * AppProvider / NavigationContainer），本文件只需导出 AppNavigator。
 */
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from '../screens/HomeScreen';
import ReviewScreen from '../screens/ReviewScreen';
import StatsScreen from '../screens/StatsScreen';
import WordDetailScreen from '../screens/WordDetailScreen';
import WordListScreen from '../screens/WordListScreen';

const Stack = createStackNavigator();

// 各页面统一的导航栏配置
const screenOptions = {
  // 导航栏：白底、深色标题文字与返回箭头
  headerStyle: { backgroundColor: '#FFFFFF' },
  headerTintColor: '#1F2937',
  headerTitleStyle: { fontWeight: '600' },
  // 页面背景：浅灰蓝
  cardStyle: { backgroundColor: '#F5F7FA' },
  // 轻量转场动画：fade_from_bottom（淡入 + 轻微上移）比默认的横向滑动转场
  // 更省 GPU/JS 开销，避免页面切换时与页面内部动画叠加导致卡顿
  animation: 'fade_from_bottom',
};

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {/* 首页：不使用导航栏，由页面自身处理安全区 */}
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      {/* 复习页：标题「复习」，iOS 上不显示返回文字 */}
      <Stack.Screen
        name="Review"
        component={ReviewScreen}
        options={{ title: '复习', headerBackTitle: ' ' }}
      />
      {/* 统计页 */}
      <Stack.Screen
        name="Stats"
        component={StatsScreen}
        options={{ title: '统计' }}
      />
      {/* 单词本页（词表列表） */}
      <Stack.Screen
        name="WordList"
        component={WordListScreen}
        options={{ title: '单词本' }}
      />
      {/* 单词详情页 */}
      <Stack.Screen
        name="WordDetail"
        component={WordDetailScreen}
        options={{ title: '单词详情' }}
      />
    </Stack.Navigator>
  );
}
