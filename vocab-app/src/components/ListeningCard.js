/**
 * ListeningCard —— 听力模式三阶段卡片
 *
 * 阶段流程（先音频 → 再单词 → 最后意思）：
 * 1. 听音（stage 0）：进入时自动播放发音，正面只显示扬声器图标，不暴露单词
 * 2. 看词（stage 1）：点击后显示单词 + 音标，先回忆词形
 * 3. 释义（stage 2）：点击后显示完整释义 + 双语例句，此时父组件开放评分
 *
 * 每个新单词都会自动重置回"听音"阶段并重新播放（父组件换 key 即可）。
 * 通过 ref 暴露 speak()，供外部/重听按钮随时再播。
 */
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

const ListeningCard = forwardRef(function ListeningCard(props, ref) {
  const {
    word = {},
    onSpeak,
    onRevealed, // 进入释义阶段（stage 2）时回调，父组件据此开放评分
    onLongPress, // 长按卡片（如跳转详情）
    style,
  } = props;

  // 解构单词信息（结构对齐 FlashCard 的 word 对象）
  const {
    word: wordText = '',
    phonetic = '',
    meaning = '',
    example = '',
    exampleZh = '',
    pos = '',
    crawled = false,
  } = word;

  // 阶段：0 听音 | 1 看词 | 2 释义
  const [stage, setStage] = useState(0);

  // 阶段切换过渡：淡入 + 轻微上浮（每次切阶段重放一次）
  const stageAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    stageAnim.setValue(0);
    Animated.spring(stageAnim, {
      toValue: 1,
      friction: 8,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [stage, stageAnim]);

  // 换词（组件重挂）时回到听音阶段；阶段 0 自动播放一次
  useEffect(() => {
    setStage(0);
    if (wordText && typeof onSpeak === 'function') {
      onSpeak(wordText);
    }
    // 仅在换词时触发一次（父组件用 key 换词）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordText]);

  /** 供父组件通过 ref 调用（如完成后重听） */
  useImperativeHandle(ref, () => ({
    speak: () => {
      if (wordText && typeof onSpeak === 'function') onSpeak(wordText);
    },
  }));

  /** 点击卡片推进阶段：听音 → 看词 → 释义（最后一步通知父组件开放评分） */
  const handlePress = () => {
    if (stage === 0) {
      setStage(1);
    } else if (stage === 1) {
      setStage(2);
      if (typeof onRevealed === 'function') onRevealed();
    }
    // 阶段 2 点击无操作（等待评分/下一个词）
  };

  /** 右上角重听按钮（独立小按钮，不触发阶段推进） */
  const ReplayButton = (
    <Pressable
      style={styles.replayButton}
      hitSlop={8}
      onPress={() => wordText && onSpeak && onSpeak(wordText)}
    >
      <Feather name="volume-2" size={16} color="#4A90D9" />
      <Text style={styles.replayText}>重听</Text>
    </Pressable>
  );

  return (
    <View style={[styles.card, style]}>
      <Pressable
        style={styles.fill}
        onPress={handlePress}
        onLongPress={() => typeof onLongPress === 'function' && onLongPress()}
        delayLongPress={300}
      >
        {/* 阶段内容：切换时淡入 + 轻微上浮 */}
        <Animated.View
          style={[
            styles.fill,
            {
              opacity: stageAnim,
              transform: [
                {
                  translateY: stageAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [14, 0],
                  }),
                },
              ],
            },
          ]}
        >
        {stage === 0 && (
          /* 阶段 1：听音 —— 只显示扬声器与提示，不暴露单词 */
          <View style={styles.centered}>
            <View style={styles.speakerRing}>
              <Feather name="headphones" size={40} color="#4A90D9" />
            </View>
            <Text style={styles.stageTitle}>听音辨词</Text>
            <Text style={styles.stageHint}>发音已自动播放，点击卡片显示单词</Text>
          </View>
        )}

        {stage === 1 && (
          /* 阶段 2：看词 —— 显示单词 + 音标，先回忆词形 */
          <View style={styles.centered}>
            <Text style={styles.word}>{wordText}</Text>
            {phonetic ? <Text style={styles.phonetic}>{phonetic}</Text> : null}
            <Text style={styles.stageHint}>点击卡片查看释义</Text>
          </View>
        )}

        {stage === 2 && (
          /* 阶段 3：释义 —— 完整含义 + 双语例句 */
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
            <Text style={styles.stageHint}>听完可点击上方重听，然后选择记忆程度</Text>
          </View>
        )}
        </Animated.View>
      </Pressable>

      {/* 右上角常驻重听按钮 */}
      <View style={styles.replayWrap}>{ReplayButton}</View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    height: 360,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#1F2937',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  fill: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  speakerRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#E8F1FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  stageHint: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  word: {
    fontSize: 40,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
  },
  phonetic: {
    fontSize: 16,
    color: '#6B7280',
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
    fontStyle: 'italic',
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
  replayWrap: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  replayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F1FA',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  replayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4A90D9',
  },
});

export default ListeningCard;
