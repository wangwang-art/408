/**
 * ReviewScreen —— 复习页
 *
 * 流程：
 * 1. 加载当前词本的学习（新词）或复习（到期词）队列，受每日配额限制
 * 2. 通过 FlashCard 滑动（左滑 = 忘记 1 / 右滑 = 简单 5）或底部评分按钮完成复习
 * 3. 每词复习写入 SM-2 进度与 review_log（manager.updateReview 内部完成）
 * 4. 全部完成后弹窗展示本轮统计（正确数 / 正确率 / 评分分布）
 *
 * 支持：播放发音（expo-av）、卡片翻转（ref.flip）、自定义标签（TagManager）。
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import VocabManager from '../services/VocabManager';
import * as TtsService from '../services/TtsService';
import FlashCard from '../components/FlashCard';
import ProgressBar from '../components/ProgressBar';
import RatingButtons from '../components/RatingButtons';
import TagManager from '../components/TagManager';
import { rateColors } from '../theme';
import { MAX_RETRY_PER_SESSION } from '../config';
import { pickRandomExample } from '../utils/exampleParser';
import ListeningCard from '../components/ListeningCard';

/** 把爬取的完整释义/例句合并进单词对象（无缓存时原样返回，回退词库自带数据） */
function enrichWord(raw, info) {
  if (!info) return raw;
  return {
    ...raw,
    meaning: info.meaning || raw.meaning,
    examples: info.examples || [],
    crawled: true, // 标记为在线数据，卡片上展示"在线例句"标识
  };
}

export default function ReviewScreen({ route, navigation }) {
  // mode: 'new' = 今日学习（新词） | 'review' = 今日复习（到期词）
  const { bookTag, mode = 'review' } = route.params;
  const isNewMode = mode === 'new';

  // 听力模式开关：与"学习/复习"正交 —— 学习或复习时都可切换
  // 听力模式流程：先听音频 → 再看单词 → 最后看释义
  const [listening, setListening] = useState(false);
  // 听力模式下当前词是否已看到释义（看到释义后才允许评分）
  const [revealed, setRevealed] = useState(false);

  // 词本管理器：每个词本只创建一次
  const manager = useMemo(() => VocabManager.for(bookTag), [bookTag]);

  const [isLoading, setIsLoading] = useState(true);
  const [dueWords, setDueWords] = useState([]); // 本轮全部单词（用于总数）
  const [queue, setQueue] = useState([]); // 尚未学习的队列，每轮取队首
  const [isCompleted, setIsCompleted] = useState(false);
  const [completionStats, setCompletionStats] = useState({
    total: 0,
    correct: 0,
    wrong: 0,
    ratings: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  });
  const [ratingLock, setRatingLock] = useState(false); // 评分防抖锁
  const [showTagManager, setShowTagManager] = useState(false);
  const [tags, setTags] = useState([]);
  // 会话内重试计数：word -> 已重试次数（没记住的词本轮最多再出现 2 次）
  const retryCountsRef = useRef({});
  // 后台爬取延迟定时器（组件卸载时清理，避免泄漏）
  const cancelledTimerRef = useRef(null);

  // 导航栏标题随模式变化
  useEffect(() => {
    navigation.setOptions({ title: isNewMode ? '今日学习' : '今日复习' });
  }, [navigation, isNewMode]);

  const cardRef = useRef(null); // FlashCard 的 ref，用于翻转

  // 队列索引固定为 0：处理完一个词即从队首移除，始终复习队首
  const currentIndex = 0;
  const currentWord = queue[currentIndex];

  // 当前卡片展示对象：释义已替换为爬取的完整含义；
  // 例句从抓取结果中随机选一条（重试时重新随机，每次出现都可能是新句子）
  const cardWord = useMemo(() => {
    if (!currentWord) return null;
    const ex = pickRandomExample(currentWord.examples);
    return {
      ...currentWord,
      example: ex ? ex.en : currentWord.example || '',
      exampleZh: ex ? ex.zh : '',
    };
    // retryCount 变化时重新选句（每次重试都是新的复习机会）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWord, retryCountsRef.current[currentWord ? currentWord.word : ''] || 0]);

  const total = dueWords.length;
  // 已复习数 = 总数 - 队列剩余（完成后队列为空，恰好等于总数）
  const done = isCompleted ? total : total - queue.length;
  // 正确率（用于完成弹窗）
  const correctRate = total > 0 ? Math.round((completionStats.correct / total) * 100) : 0;

  // 切换单词时重置"是否看到释义"（听力模式下评分需先看到释义）
  useEffect(() => {
    setRevealed(false);
  }, [currentWord]);

  /** 切换卡片模式：标准（直接看词/翻转）↔ 听力（先音频 → 看词 → 释义） */
  const toggleListening = useCallback((next) => {
    setRevealed(false); // 切换模式时重置当前词的揭示状态（听力卡片会重新进入听音阶段）
    setListening(next);
  }, []);

  // 加载到期单词
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        // 新会话：清空重试计数
        retryCountsRef.current = {};
        // 按模式加载队列：学习=新词队列，复习=到期词队列（各自受每日配额限制）
        const result = isNewMode ? await manager.getNewQueue() : await manager.getReviewQueue();
        if (cancelled) return;

        const rawWords = result.queue;
        // 1) 首屏：先读本地缓存（不发网络请求），已缓存词立即显示完整释义与双语例句
        const cached = await manager.getCachedWordInfos(rawWords.map((w) => w.word));
        if (cancelled) return;
        const enriched = rawWords.map((w) => enrichWord(w, cached[w.word]));
        setDueWords(enriched);
        setQueue(enriched);
        setCompletionStats((prev) => ({ ...prev, total: rawWords.length }));

        // 2) 后台：并发抓取未缓存的词（爬取后缓存，本次及以后直接命中），完成后合并回卡片
        // 延迟 300ms 等页面转场动画结束再启动，避免转场期间网络/解析与动画竞争导致卡顿
        const missing = rawWords.filter((w) => !cached[w.word]);
        if (missing.length > 0) {
          const timer = setTimeout(() => {
            manager
              .ensureWordInfos(missing.map((w) => w.word))
              .then((infos) => {
                if (cancelled) return;
                setQueue((prev) =>
                  prev.map((w) => enrichWord(w, infos[w.word] || cached[w.word]))
                );
              })
              .catch(() => {
                // 抓取失败静默处理：卡片继续使用词库自带释义，不影响复习流程
              });
          }, 300);
          cancelledTimerRef.current = timer;
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
      if (cancelledTimerRef.current) {
        clearTimeout(cancelledTimerRef.current);
        cancelledTimerRef.current = null;
      }
    };
  }, [manager]);

  /**
   * 播放单词发音
   * 通过系统 TTS 引擎离线朗读，无需网络与服务器。
   * @param {string} word 单词
   */
  const playSound = useCallback(async (word) => {
    try {
      await TtsService.speak(word, bookTag);
    } catch (e) {
      // 发音失败（如无网络）静默忽略
    }
  }, [bookTag]);

  /** 打开浏览器在线例句（有道词典手机版，适配手机屏幕） */
  const openExample = useCallback((word) => {
    const url = `https://dict.youdao.com/m/result?word=${encodeURIComponent(word)}&lang=en`;
    Linking.openURL(url).catch(() => {
      Alert.alert('无法打开浏览器', '请检查系统浏览器是否可用');
    });
  }, []);

  // 当前单词变化时刷新其标签（仅打开标签管理面板时需要）
  useEffect(() => {
    if (!currentWord || !showTagManager) return;
    let cancelled = false;
    const load = async () => {
      const t = await manager.getWordTags(currentWord.word);
      if (!cancelled) setTags(t);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [currentWord, showTagManager, manager]);

  /**
   * 处理一次评分
   * - ratingLock 防抖：处理中直接忽略新的评分
   * - manager.updateReview 内部完成 DB 写入 + review_log 记录（含困难词计数）
   * - 会话内重试：评分 <= 2（没记住）且未超过重试上限的词，重新放入队列末尾，本轮再次出现，保证本次学会
   * @param {number} rating 评分 1~5
   */
  const handleRate = useCallback(
    async (rating) => {
      if (ratingLock || !currentWord || isCompleted) return;
      setRatingLock(true);
      try {
        const { word } = currentWord;
        await manager.updateReview(word, rating);

        // 更新本轮统计（rating >= 3 视为正确）
        setCompletionStats((prev) => ({
          ...prev,
          correct: prev.correct + (rating >= 3 ? 1 : 0),
          wrong: prev.wrong + (rating >= 3 ? 0 : 1),
          ratings: { ...prev.ratings, [rating]: prev.ratings[rating] + 1 },
        }));

        // 没记住（<=2）且未超过会话内重试上限：重新入队尾，本轮再次出现
        const retried = retryCountsRef.current[word] || 0;
        const shouldRetry = rating <= 2 && retried < MAX_RETRY_PER_SESSION;
        if (shouldRetry) {
          retryCountsRef.current[word] = retried + 1;
          setQueue((prev) => [...prev.filter((w) => w.word !== word), currentWord]);
        } else if (queue.length <= 1) {
          // 队列只剩当前词时本轮完成
          setQueue([]);
          setIsCompleted(true);
        } else {
          setQueue((prev) => prev.filter((w) => w.word !== word));
        }
      } finally {
        setRatingLock(false);
      }
    },
    [ratingLock, currentWord, isCompleted, queue.length, manager]
  );

  /** 刷新当前单词的标签 */
  const refreshTags = useCallback(async () => {
    if (!currentWord) return;
    const t = await manager.getWordTags(currentWord.word);
    setTags(t);
  }, [currentWord, manager]);

  /** 新增标签 */
  const handleAddTag = useCallback(
    async (tag) => {
      if (!currentWord) return;
      await manager.addTagForWord(currentWord.word, tag);
      await refreshTags();
    },
    [currentWord, manager, refreshTags]
  );

  /** 删除标签 */
  const handleRemoveTag = useCallback(
    async (tag) => {
      if (!currentWord) return;
      await manager.removeTagForWord(currentWord.word, tag);
      await refreshTags();
    },
    [currentWord, manager, refreshTags]
  );

  // 完成弹窗弹出动画：显示时 0.9 -> 1 缩放 + 淡入
  const modalAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (isCompleted) {
      modalAnim.setValue(0);
      Animated.spring(modalAnim, {
        toValue: 1,
        friction: 7,
        tension: 90,
        useNativeDriver: true,
      }).start();
    }
  }, [isCompleted, modalAnim]);

  // 加载中：居中转圈
  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4A90D9" />
      </View>
    );
  }

  // 空列表：今天没有到期单词
  if (dueWords.length === 0) {
    return (
      <View style={styles.center}>
        <Feather name="check-circle" size={48} color="#30A46C" />
        <Text style={styles.emptyTitle}>
          {isNewMode ? '今日新词已学完，太棒了！' : '今日复习已完成，太棒了！'}
        </Text>
        <Pressable style={styles.emptyBackButton} onPress={() => navigation.goBack()}>
          <Text style={styles.emptyBackText}>返回首页</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 顶部进度：已复习数 / 总数 + 进度条 + 模式切换 */}
      <View style={styles.progressHeader}>
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>
            {done}/{total}
          </Text>
          {/* 卡片模式切换：标准（直接看词/翻转） ↔ 听力（先听音 → 看词 → 释义） */}
          <View style={styles.modeSwitch}>
            <Pressable
              style={[styles.modeOption, !listening && styles.modeOptionActive]}
              onPress={() => toggleListening(false)}
            >
              <Text style={[styles.modeOptionText, !listening && styles.modeOptionTextActive]}>
                标准
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modeOption, listening && styles.modeOptionActive]}
              onPress={() => toggleListening(true)}
            >
              <Text style={[styles.modeOptionText, listening && styles.modeOptionTextActive]}>
                听力
              </Text>
            </Pressable>
          </View>
        </View>
        <ProgressBar progress={total > 0 ? done / total : 0} />
        {listening ? (
          <Text style={styles.modeHint}>听力模式：先听发音 → 再看单词 → 最后看释义</Text>
        ) : null}
      </View>

      {/* 卡片区：key 换词自动重置翻转状态；听力/标准模式各用独立组件 */}
      <View style={styles.cardArea}>
        {cardWord &&
          (listening ? (
            <ListeningCard
              key={`${cardWord.word}-${retryCountsRef.current[cardWord.word] || 0}-listen`}
              ref={cardRef}
              word={cardWord}
              onSpeak={(w) => playSound(w)}
              onRevealed={() => setRevealed(true)}
              onLongPress={() =>
                navigation.navigate('WordDetail', { bookTag, word: cardWord.word })
              }
            />
          ) : (
            <FlashCard
              key={`${cardWord.word}-${retryCountsRef.current[cardWord.word] || 0}-card`}
              ref={cardRef}
              word={cardWord}
              onSwipeLeft={() => handleRate(1)}
              onSwipeRight={() => handleRate(5)}
              onLongPress={() =>
                navigation.navigate('WordDetail', { bookTag, word: cardWord.word })
              }
              onOpenExample={openExample}
            />
          ))}
      </View>

      {/* 底部操作栏（固定）：发音 / 翻转 / 标签 + 评分按钮 */}
      <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
        <View style={styles.toolRow}>
          <Pressable
            style={styles.toolButton}
            onPress={() => currentWord && playSound(currentWord.word)}
          >
            <Feather name="volume-2" size={20} color="#4A90D9" />
          </Pressable>
          {!listening ? (
            <Pressable
              style={styles.toolButton}
              onPress={() => cardRef.current && cardRef.current.flip()}
            >
              <Feather name="repeat" size={20} color="#4A90D9" />
            </Pressable>
          ) : null}
          <Pressable style={styles.toolButton} onPress={() => setShowTagManager(true)}>
            <Feather name="tag" size={20} color="#4A90D9" />
          </Pressable>
        </View>
        {/* 听力模式：必须先看到释义（revealed）才允许评分 */}
        <RatingButtons
          onRate={handleRate}
          disabled={ratingLock || isCompleted || (listening && !revealed)}
        />
      </SafeAreaView>

      {/* 标签管理底部弹层 */}
      <TagManager
        visible={showTagManager}
        onClose={() => setShowTagManager(false)}
        tags={tags}
        onAdd={handleAddTag}
        onRemove={handleRemoveTag}
      />

      {/* 完成弹窗：本轮复习统计 */}
      <Modal
        visible={isCompleted}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          {/* 缩放弹出：0.9 -> 1 + 淡入（替换原来的纯 fade 显得更有"完成感"） */}
          <Animated.View
            style={[
              styles.modalCard,
              {
                opacity: modalAnim,
                transform: [
                  {
                    scale: modalAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }),
                  },
                ],
              },
            ]}
          >
            <Feather name="award" size={40} color="#4A90D9" />
            <Text style={styles.modalTitle}>本轮复习完成</Text>

            <View style={styles.modalStats}>
              <Text style={styles.statText}>共 {total} 词</Text>
              <Text style={styles.statText}>
                正确 {completionStats.correct}（正确率 {correctRate}%）
              </Text>
            </View>

            {/* 各评分分布行：1-5 圆点颜色 + 次数 */}
            <View style={styles.ratingDistRow}>
              {rateColors.map((color, i) => (
                <View key={i} style={styles.ratingDistItem}>
                  <View style={[styles.ratingDot, { backgroundColor: color }]} />
                  <Text style={styles.ratingDistText}>{completionStats.ratings[i + 1] || 0}</Text>
                </View>
              ))}
            </View>

            <Pressable style={styles.modalButton} onPress={() => navigation.goBack()}>
              <Text style={styles.modalButtonText}>返回首页</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    paddingTop: 12,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F7FA',
    gap: 12,
    padding: 20,
  },
  emptyTitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
  },
  emptyBackButton: {
    height: 44,
    borderRadius: 12,
    backgroundColor: '#4A90D9',
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  emptyBackText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  progressHeader: {
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: '#E8ECF2',
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  modeOption: {
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: 8,
  },
  modeOptionActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#1F2937',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  modeOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  modeOptionTextActive: {
    color: '#4A90D9',
  },
  modeHint: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  cardArea: {
    flex: 1,
    paddingHorizontal: 20,
  },
  bottomBar: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    // 顶部阴影
    shadowColor: '#1F2937',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  toolRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 12,
  },
  toolButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F1FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  modalStats: {
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  statText: {
    fontSize: 14,
    color: '#6B7280',
  },
  ratingDistRow: {
    flexDirection: 'row',
    gap: 18,
    marginBottom: 8,
  },
  ratingDistItem: {
    alignItems: 'center',
    gap: 4,
  },
  ratingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  ratingDistText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  modalButton: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 12,
    backgroundColor: '#4A90D9',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
