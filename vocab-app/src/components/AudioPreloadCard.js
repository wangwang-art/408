/**
 * AudioPreloadCard —— 发音预加载状态卡片
 *
 * 展示词典原声发音的下载进度与状态：
 * - 标题行：download 图标 + 标题
 * - 状态文字：预下载中 / 已全部下载 / 未全部下载 三态
 * - 信息行：已下载数量，预下载时追加剩余数量与实时速度（/秒）
 * - ProgressBar 进度条 + 开始下载按钮
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import ProgressBar from './ProgressBar';

const SPEED_INTERVAL = 500; // 速度采样间隔（毫秒）

/**
 * @param {number} total 发音总数
 * @param {number} cached 已下载数量
 * @param {number} processed 本次已处理数量（驱动进度条，保证走完）
 * @param {boolean} isPreloading 是否正在下载
 * @param {() => void} onStart 开始下载回调
 */
export default function AudioPreloadCard({ total = 0, cached = 0, processed = 0, isPreloading = false, onStart }) {
  // 实时下载速度（个/秒）
  const [speed, setSpeed] = useState(0);
  // 镜像最新 cached，供定时器闭包读取
  const cachedRef = useRef(cached);
  cachedRef.current = cached;
  // 速度计算基准：记录上次的已完成数量与时间戳
  const trackRef = useRef({ lastCount: cached, lastTime: Date.now() });

  // cached 变化时刷新采样基准，避免一次性大跳跃污染速度
  useEffect(() => {
    trackRef.current = { lastCount: cached, lastTime: Date.now() };
  }, [cached]);

  // 预加载期间每 500ms 采样一次实时速度
  useEffect(() => {
    if (!isPreloading) {
      setSpeed(0);
      return;
    }
    const timer = setInterval(() => {
      const now = Date.now();
      const { lastCount, lastTime } = trackRef.current;
      const elapsed = (now - lastTime) / 1000;
      const delta = cachedRef.current - lastCount;
      if (elapsed > 0 && delta >= 0) {
        trackRef.current = { lastCount: cachedRef.current, lastTime: now };
        setSpeed(Math.round((delta / elapsed) * 10) / 10);
      }
    }, SPEED_INTERVAL);
    return () => clearInterval(timer);
  }, [isPreloading]);

  const completed = total > 0 && cached >= total;
  // 进度条：下载中用"已处理数"推进（保证走完），平时用已下载数
  const progress = total > 0 ? Math.min(1, (processed > 0 ? processed : cached) / total) : 0;
  const remaining = Math.max(0, total - cached);

  // 三态状态文字
  const statusText = isPreloading
    ? '正在下载词典原声...'
    : completed
    ? '发音已全部下载 ✓'
    : '词典原声未下载';

  return (
    <View style={styles.card}>
      {/* 标题行 */}
      <View style={styles.titleRow}>
        <Feather name="download" size={18} color="#4A90D9" />
        <Text style={styles.title}>单词发音预下载</Text>
      </View>

      {/* 状态文字 */}
      <Text style={[styles.status, completed && styles.statusDone]}>{statusText}</Text>

      {/* 信息行：已下载数量 + 剩余 + 实时速度 */}
      <Text style={styles.info}>
        已下载 {cached} / {total} 个
        {isPreloading ? ` · 剩余 ${remaining} 个` : ''}
        {isPreloading && speed > 0 ? ` · ${speed}/秒` : ''}
      </Text>

      {/* 进度条 */}
      <ProgressBar progress={progress} />

      {/* 说明文字 */}
      <Text style={styles.hint}>
        美式词典原声（有道），下载后完全离线、发音纯正
      </Text>

      {/* 操作按钮：完成前显示；预加载中禁用 */}
      {!completed && (
        <Pressable
          style={[styles.button, isPreloading && styles.buttonDisabled]}
          onPress={onStart}
          disabled={isPreloading}
        >
          <Text style={styles.buttonText}>{isPreloading ? '下载中...' : '下载发音'}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  status: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E5484D', // 未完成红色
  },
  statusDone: {
    color: '#30A46C', // 完成态绿色
  },
  info: {
    fontSize: 13,
    color: '#6B7280',
  },
  hint: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: '#4A90D9',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
