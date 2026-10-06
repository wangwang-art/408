/**
 * BookSelector —— 词书选择器（横向滚动卡片）
 *
 * - 水平 ScrollView，每张卡片 120 宽、圆角 16
 * - 选中态：主蓝底 + 白字白图标 + 阴影，并自动滚动居中
 * - 选中态缩放动画（RN Animated，1.0 -> 1.04）
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, ScrollView, Pressable, Animated, StyleSheet, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';

const CARD_WIDTH = 120; // 卡片宽度
const CARD_GAP = 12; // 卡片间距（与 contentContainerStyle 保持一致）

/**
 * 单张词书卡片（自带选中态缩放动画）
 */
function BookCard({ tag, label, selected, onPress, onLayout }) {
  // 缩放动画值：选中 1.04，未选中 1.0
  const scale = useRef(new Animated.Value(selected ? 1.04 : 1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: selected ? 1.04 : 1,
      friction: 7,
      tension: 60,
      useNativeDriver: true,
    }).start();
  }, [selected, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onLayout={onLayout}
        onPress={onPress}
        style={[styles.card, selected && styles.cardSelected]}
      >
        {/* 上图标：book-open */}
        <Feather name="book-open" size={22} color={selected ? '#FFFFFF' : '#6B7280'} />
        {/* 下文字标签 */}
        <Text style={[styles.cardLabel, selected && styles.cardLabelSelected]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

/**
 * @param {string[]} books 词书标识列表（如 ['cet4', 'cet6', 'ielts']）
 * @param {string|null} selected 当前选中的词书标识
 * @param {(tag: string) => void} onSelect 选中回调
 * @param {Record<string, string>} labels 词书标识 -> 展示名称的映射
 */
export default function BookSelector({ books = [], selected = null, onSelect, labels = {} }) {
  // 用窗口宽度计算自动居中所需的滚动偏移
  const { width: screenWidth } = useWindowDimensions();
  const scrollRef = useRef(null);
  // 记录每张卡片相对内容起点的 x 坐标（onLayout 测量）
  const positionsRef = useRef({});

  /** 将指定卡片滚动到可视区域中央 */
  const scrollToCenter = (tag) => {
    const x = positionsRef.current[tag];
    if (typeof x !== 'number') return;
    // 偏移量 = 卡片位置 - 半屏宽 + 半卡宽（120/2 = 60）
    const target = Math.max(0, x - screenWidth / 2 + CARD_WIDTH / 2);
    scrollRef.current?.scrollTo({ x: target, animated: true });
  };

  // 选中项变化时自动居中
  useEffect(() => {
    if (selected) scrollToCenter(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  /** 卡片布局完成时记录位置；若正是选中项则立即居中（覆盖初次渲染） */
  const handleLayout = (tag) => (e) => {
    positionsRef.current[tag] = e.nativeEvent.layout.x;
    if (tag === selected) scrollToCenter(tag);
  };

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {books.map((tag) => (
        <BookCard
          key={tag}
          tag={tag}
          label={labels[tag] || tag}
          selected={selected === tag}
          onPress={() => typeof onSelect === 'function' && onSelect(tag)}
          onLayout={handleLayout(tag)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: CARD_GAP,
    paddingHorizontal: 16,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E9F0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 22,
    gap: 8,
  },
  cardSelected: {
    backgroundColor: '#4A90D9',
    borderColor: '#4A90D9',
    // 选中态阴影（iOS / Android）
    shadowColor: '#4A90D9',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
  },
  cardLabelSelected: {
    color: '#FFFFFF',
  },
});
