/**
 * RatingButtons —— 单词记忆评分按钮组
 *
 * 5 个圆形按钮，颜色由红到绿渐变，分别代表 1 忘记 / 2 困难 / 3 模糊 / 4 顺利 / 5 简单。
 * 特性：
 * - 按压缩放动画（RN Animated，0.9 -> 1）
 * - 防连点：点击后锁定 600ms，期间忽略重复点击
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { rateColors, rateLabels } from '../theme';

// 防连点锁定时长（毫秒）
const LOCK_DURATION = 600;

/**
 * 单个评分按钮（含数字圆 + 下方小标签）
 */
function RateButton({ rating, color, label, size, onPress, disabled }) {
  // 按压缩放动画值：默认 1，按下 0.9，松手回弹 1
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled) return;
    Animated.spring(scale, {
      toValue: 0.9,
      speed: 40,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      tension: 200,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={styles.item}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={onPress}
          disabled={disabled}
          style={[
            styles.button,
            { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
            disabled && styles.buttonDisabled,
          ]}
        >
          <Text style={[styles.number, { fontSize: Math.round(size * 0.38) }]}>{rating}</Text>
        </Pressable>
      </Animated.View>
      <Text style={[styles.label, disabled && styles.labelDisabled]}>{label}</Text>
    </View>
  );
}

/**
 * @param {(rating: number) => void} onRate 评分回调（参数 1~5，只会触发一次）
 * @param {boolean} disabled 整体禁用
 * @param {number} size 圆形按钮直径
 */
export default function RatingButtons({ onRate, disabled = false, size = 52 }) {
  // 锁定态：用于视觉禁用；true 表示 600ms 内的防连点窗口
  const [locked, setLocked] = useState(false);
  const lockTimer = useRef(null);

  // 组件卸载时清理计时器，避免内存泄漏
  useEffect(
    () => () => {
      if (lockTimer.current) clearTimeout(lockTimer.current);
    },
    []
  );

  const handleRate = (rating) => {
    // 锁定期间或外部禁用时直接忽略
    if (disabled || locked) return;
    setLocked(true); // 进入防连点窗口
    if (typeof onRate === 'function') onRate(rating); // 只调用一次
    lockTimer.current = setTimeout(() => setLocked(false), LOCK_DURATION);
  };

  const isDisabled = disabled || locked;

  return (
    <View style={styles.row}>
      {rateLabels.map((label, i) => (
        <RateButton
          key={label}
          rating={i + 1}
          color={rateColors[i]}
          label={label}
          size={size}
          onPress={() => handleRate(i + 1)}
          disabled={isDisabled}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between', // 等间距分布 5 个按钮
    alignItems: 'flex-start',
  },
  item: {
    alignItems: 'center',
    gap: 6,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  label: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  labelDisabled: {
    opacity: 0.5,
  },
});
