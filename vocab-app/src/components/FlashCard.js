/**
 * FlashCard —— 翻转单词卡组件（核心组件）
 *
 * 交互能力：
 * 1. 点击卡片任意处 -> 3D 翻转（react-native-reanimated v3，400ms 缓入缓出）
 * 2. 水平拖拽滑动评分（PanResponder + RN Animated）：左滑触发 onSwipeLeft、右滑触发 onSwipeRight
 * 3. 长按触发 onLongPress
 *
 * 手势分工（互不冲突）：
 * - 点击 / 长按：由内部 Pressable 处理
 * - 水平滑动：由外层 View 的 PanResponder 通过 capture 阶段优先接管，
 *   一旦出现明显水平位移即从 Pressable 手中夺走响应者，滑动结束后不会误触翻转
 *
 * 翻转实现：reanimated 共享值 flipProgress(0~1) 驱动 3D 旋转，
 * 正面 rotateY 0->180°，背面 rotateY 180->360°，配合 backfaceVisibility 与透明度渐变。
 * 通过 forwardRef + useImperativeHandle 向父组件暴露 flip() 方法。
 */
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { View, Text, Pressable, PanResponder, Animated as RNAnimated, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
  runOnJS,
  useDerivedValue,
} from 'react-native-reanimated';
import { Feather as FeatherIcon } from '@expo/vector-icons';

const FLIP_DURATION = 400; // 翻转动画时长（毫秒）
const SWIPE_THRESHOLD = 120; // 判定为滑动的最小水平位移
const SWIPE_OUT_DISTANCE = 600; // 判定成功后的离场位移

const FlashCard = forwardRef(function FlashCard(props, ref) {
  const { word = {}, onSwipeLeft, onSwipeRight, onLongPress, onOpenExample, style } = props;

  // 解构单词信息（word 属性内还嵌套了一个 word 字段，这里做别名）
  // crawled: 是否为在线抓取的完整释义/例句；exampleZh: 例句中文翻译
  const {
    word: wordText = '',
    phonetic = '',
    meaning = '',
    example = '',
    exampleZh = '',
    pos = '',
    crawled = false,
  } = word;

  // 是否处于背面状态（供 JS 侧逻辑使用）
  const [isFlipped, setIsFlipped] = useState(false);
  // 翻转进度 0~1：0 = 正面，1 = 背面（reanimated 共享值，驱动 3D 旋转）
  const flipProgress = useSharedValue(0);
  // 用 ref 同步翻转方向，避免快速连点读到过期的 state
  const flippedRef = useRef(false);
  // 标记是否刚完成一次滑动（抑制滑动离场动画期间的误触发 onPress）
  const didSwipeRef = useRef(false);

  // 滑动偏移量：RN Animated 负责拖拽跟随，reanimated 只负责翻转
  const swipeX = useRef(new RNAnimated.Value(0)).current;

  // 入场动画：换词（组件重挂）时从下方轻微上浮 + 淡入
  // 延迟 180ms 启动，避免与页面转场动画叠加造成掉帧
  const entrance = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    const timer = setTimeout(() => {
      RNAnimated.spring(entrance, {
        toValue: 1,
        friction: 7,
        tension: 60,
        useNativeDriver: true,
      }).start();
    }, 180);
    return () => clearTimeout(timer);
  }, [entrance]);

  // 滑动时轻微旋转（像 Tinder 一样有"甩"的感觉）+ 边缘淡出
  const swipeRotate = swipeX.interpolate({
    inputRange: [-SWIPE_OUT_DISTANCE, 0, SWIPE_OUT_DISTANCE],
    outputRange: ['-14deg', '0deg', '14deg'],
    extrapolate: 'clamp',
  });
  const swipeOpacity = swipeX.interpolate({
    inputRange: [-SWIPE_OUT_DISTANCE, 0, SWIPE_OUT_DISTANCE],
    outputRange: [0.45, 1, 0.45],
    extrapolate: 'clamp',
  });
  // 入场位移：0 -> 1 对应上浮 28 -> 0
  const entranceY = entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [28, 0],
  });
  const entranceOpacity = entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  // 用 ref 保存最新回调，避免 PanResponder 闭包捕获过期的 props
  const callbackRef = useRef({ onSwipeLeft, onSwipeRight });
  callbackRef.current = { onSwipeLeft, onSwipeRight };

  /** 执行翻转动画：400ms 缓入缓出 */
  const animateFlip = (toValue) => {
    flipProgress.value = withTiming(toValue, {
      duration: FLIP_DURATION,
      easing: Easing.inOut(Easing.ease),
    });
  };

  /** 翻转卡片（通过 ref 暴露给父组件） */
  const flip = () => {
    const next = !flippedRef.current;
    flippedRef.current = next;
    setIsFlipped(next);
    animateFlip(next ? 1 : 0);
  };

  // 通过 ref 向父组件暴露 flip 方法
  useImperativeHandle(ref, () => ({ flip }));

  /** 滑动离场完成后的回调（方向由 dx 决定） */
  const finishSwipe = (dx) => {
    const cb = dx < 0 ? callbackRef.current.onSwipeLeft : callbackRef.current.onSwipeRight;
    if (typeof cb === 'function') cb();
  };

  /** 未达阈值松手：回弹到原位 */
  const springBack = () => {
    RNAnimated.spring(swipeX, {
      toValue: 0,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      // 触摸开始时先尝试判定水平意图：此刻 dx/dy 均为 0，通常返回 false，
      // 让点击 / 长按事件继续交给内部 Pressable 处理
      onStartShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
      // 捕获阶段优先接管：检测到明显水平位移时立即从 Pressable 手中夺走响应者，
      // 保证拖拽与点击互不冲突
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (_, gestureState) =>
        Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
      // 兜底：在冒泡阶段也能接管水平拖拽
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
      onPanResponderMove: (_, gestureState) => {
        swipeX.setValue(gestureState.dx); // 卡片跟随手指水平移动
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx, dy } = gestureState;
        if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
          // 判定为滑动：先离场动画，再通知父组件
          didSwipeRef.current = true;
          const targetX = dx < 0 ? -SWIPE_OUT_DISTANCE : SWIPE_OUT_DISTANCE;
          RNAnimated.timing(swipeX, {
            toValue: targetX,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            runOnJS(finishSwipe)(dx); // 经 reanimated 切回 JS 线程调用回调
            swipeX.setValue(0); // 复位，方便父组件复用本卡片
          });
        } else {
          springBack(); // 未达阈值：回弹
        }
      },
      onPanResponderTerminate: springBack,
      onPanResponderTerminationRequest: () => false, // 接管后不再让出
    })
  ).current;

  const handlePress = () => {
    // 滑动离场动画期间可能触发 onPress，这里过滤掉
    if (didSwipeRef.current) {
      didSwipeRef.current = false;
      return;
    }
    flip(); // 点击任意处 -> 翻转
  };

  const handleLongPress = () => {
    if (typeof onLongPress === 'function') onLongPress();
  };

  // 正 / 背面可见度：正面在翻转角度 < 90°（progress < 0.5）时显示；
  // 透明度渐变同时为 Android（backfaceVisibility 支持不完整）提供兜底
  const frontOpacity = useDerivedValue(() =>
    interpolate(flipProgress.value, [0, 0.5], [1, 0])
  );
  const backOpacity = useDerivedValue(() =>
    interpolate(flipProgress.value, [0.5, 1], [0, 1])
  );

  // 翻转容器：提供 1000 透视，营造 3D 景深
  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1000 }],
  }));

  // 正面：随进度 0 -> 180 度旋转，超过 90 度后淡出
  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ rotateY: `${interpolate(flipProgress.value, [0, 1], [0, 180])}deg` }],
    opacity: frontOpacity.value,
  }));

  // 背面：随进度 180 -> 360 度旋转，超过 90 度后淡入
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ rotateY: `${interpolate(flipProgress.value, [0, 1], [180, 360])}deg` }],
    opacity: backOpacity.value,
  }));

  return (
    /* 外层容器：负责手势接管（PanResponder）与卡片外观 */
    <View style={[styles.card, style]} {...panResponder.panHandlers}>
      <Pressable
        style={styles.fill}
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={300}
      >
        {/* 滑动层：水平拖拽时整体跟随手指（含旋转与边缘淡出），入场时上浮淡入 */}
        <RNAnimated.View
          style={[
            styles.fill,
            {
              transform: [{ translateX: swipeX }, { rotate: swipeRotate }, { translateY: entranceY }],
              opacity: RNAnimated.multiply(swipeOpacity, entranceOpacity),
            },
          ]}
        >
          <Animated.View style={[styles.fill, containerStyle]}>
            {/* 正面 */}
            <Animated.View style={[styles.face, frontStyle]}>
              <View style={styles.frontContent}>
                <Text style={styles.frontWord}>{wordText}</Text>
                {phonetic ? <Text style={styles.phonetic}>{phonetic}</Text> : null}
                <Text style={styles.hint}>点击翻转</Text>
              </View>
            </Animated.View>
            {/* 背面 */}
            <Animated.View style={[styles.face, backStyle]}>
              <View style={styles.backContent}>
                <Text style={styles.backWord}>{wordText}</Text>
                {pos ? (
                  <View style={styles.posTag}>
                    <Text style={styles.posText}>{pos}</Text>
                  </View>
                ) : null}
                {meaning ? <Text style={styles.meaning}>{meaning}</Text> : null}
                {example ? (
                  <View style={styles.exampleBlock}>
                    <Text style={styles.example}>“{example}”</Text>
                    {exampleZh ? <Text style={styles.exampleZh}>{exampleZh}</Text> : null}
                    {crawled ? (
                      <View style={styles.crawledBadge}>
                        <Text style={styles.crawledBadgeText}>在线例句</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
                <View style={styles.backActions}>
                  {onOpenExample ? (
                    <Pressable
                      style={styles.exampleButton}
                      hitSlop={6}
                      onPress={() => onOpenExample(wordText)}
                    >
                      <FeatherIcon name="external-link" size={13} color="#4A90D9" />
                      <Text style={styles.exampleButtonText}>在线例句</Text>
                    </Pressable>
                  ) : null}
                  <Text style={styles.hint}>点击翻转</Text>
                </View>
              </View>
            </Animated.View>
          </Animated.View>
        </RNAnimated.View>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    height: 360, // 默认高度，可通过 style 覆盖（完整释义 + 双语例句需要更大空间）
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    // 卡片阴影
    shadowColor: '#1F2937',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  fill: {
    flex: 1,
  },
  face: {
    ...StyleSheet.absoluteFillObject, // 两面绝对定位填充容器
    backfaceVisibility: 'hidden', // 背对镜头时隐藏
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  frontContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  frontWord: {
    fontSize: 44,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
  },
  phonetic: {
    fontSize: 16,
    color: '#6B7280',
  },
  hint: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 8,
  },
  backContent: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  backWord: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
  },
  posTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F1FA',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  posText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4A90D9',
  },
  meaning: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
  },
  exampleBlock: {
    gap: 2,
    marginTop: 2,
  },
  example: {
    fontSize: 13,
    color: '#6B7280',
    fontStyle: 'italic', // 例句斜体
    lineHeight: 20,
  },
  exampleZh: {
    fontSize: 12,
    color: '#9CA3AF',
    lineHeight: 18,
  },
  crawledBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F1FA',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  crawledBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4A90D9',
  },
  backActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  exampleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F1FA',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  exampleButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4A90D9',
  },
});

export default FlashCard;
