/**
 * ProgressBar —— 通用圆角进度条（带动画）
 *
 * 纯 View + RN Animated 实现，无任何第三方依赖：
 * - progress 会被 clamp 到 [0, 1] 区间
 * - 进度变化时平滑过渡（300ms 缓出），不再跳变
 * - 高度、填充色、轨道色均可配置
 */
import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';

/**
 * @param {number} progress   进度值 0~1
 * @param {number} height     进度条高度（默认 8）
 * @param {string} color      已完成进度的填充色（默认主题主蓝 #4A90D9）
 * @param {string} trackColor 轨道底色（默认边框灰 #E5E9F0）
 * @param {object|array} style 附加样式
 */
export default function ProgressBar({
  progress = 0,
  height = 8,
  color = '#4A90D9',
  trackColor = '#E5E9F0',
  style,
}) {
  // 将 progress 安全地限制在 0~1 之间（clamp）
  const clamped = Math.min(1, Math.max(0, Number(progress) || 0));

  // 动画填充值：进度变化时平滑过渡（宽度是布局属性，需关闭 native driver）
  // 首次渲染直接定位（不播动画），避免与页面转场叠加造成卡顿
  const fillAnim = useRef(new Animated.Value(clamped)).current;
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      fillAnim.setValue(clamped);
      return;
    }
    Animated.timing(fillAnim, {
      toValue: clamped,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [clamped, fillAnim]);

  // 0~1 映射为 0%~100% 宽度
  const fillWidth = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View
      style={[
        styles.track,
        { height, backgroundColor: trackColor, borderRadius: height / 2 },
        style,
      ]}
    >
      {/* 已完成部分：宽度随动画值平滑变化，圆角跟随高度自适应 */}
      <Animated.View
        style={[
          styles.fill,
          {
            width: fillWidth,
            height,
            backgroundColor: color,
            borderRadius: height / 2,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden', // 保证极端宽度下的圆角裁剪
  },
  fill: {
    // 尺寸、颜色、圆角均随 props 动态计算，此处仅作占位
  },
});
