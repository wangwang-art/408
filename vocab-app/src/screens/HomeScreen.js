/**
 * HomeScreen —— 首页 / 词本选择页
 *
 * 职责：
 * 1. 展示词本选择器（BookSelector），切换全局当前词本
 * 2. 今日学习卡片（新词）与今日复习卡片（到期词）——各自独立配额、独立入口
 * 3. 发音预下载卡片：词典原声（有道/百度）按需下载，进度续传
 * 4. 每日配额自定义（新词量 / 复习量，存储于本地 settings）
 * 5. App 进入后台时中断下载，回到前台后自动恢复未完成的下载
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  Alert,
  StyleSheet,
  AppState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Network from 'expo-network';
import { Feather } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { BOOK_LABELS } from '../config';
import VocabManager from '../services/VocabManager';
import * as AudioDownloadService from '../services/AudioDownloadService';
import * as dateHelper from '../utils/dateHelper';
import BookSelector from '../components/BookSelector';
import AudioPreloadCard from '../components/AudioPreloadCard';

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { state, availableBooks, selectBook, startPreload, updatePreload, finishPreload } =
    useApp();
  const { currentBookTag, isAudioPreloading } = state;

  // 词本统计
  const [totalWords, setTotalWords] = useState(0);
  const [cachedCount, setCachedCount] = useState(0);
  const [processedCount, setProcessedCount] = useState(0); // 本次下载已处理数（驱动进度条）
  const [streak, setStreak] = useState(0);
  // 今日学习（新词）与复习（到期词）队列信息
  const [newInfo, setNewInfo] = useState({ queue: [], total: 0, limit: 20, learned: 0 });
  const [reviewInfo, setReviewInfo] = useState({ queue: [], total: 0, limit: 100, learned: 0 });

  // 配额设置弹窗
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [newLimitInput, setNewLimitInput] = useState('20');
  const [reviewLimitInput, setReviewLimitInput] = useState('100');

  // 取消标记：App 进入后台时置 true，批量下载立即停止
  const cancelledRef = useRef(false);
  // 记录每个词本是否已完整下载过（避免回到前台后反复重试已完成词本）
  const bookDoneRef = useRef({});
  // 记录已提示过「非 Wi-Fi」弹窗的词本，避免重复弹窗
  const warnedTagRef = useRef(null);
  // 镜像最新的预加载状态与当前词本，供 AppState 回调读取
  const isPreloadingRef = useRef(isAudioPreloading);
  isPreloadingRef.current = isAudioPreloading;
  const currentTagRef = useRef(currentBookTag);
  currentTagRef.current = currentBookTag;

  /**
   * 计算连续打卡天数（取该词本 review_log 全部记录，按日期去重，从今天往前数）
   */
  const calcStreak = useCallback(async (tag) => {
    const allLogs = await VocabManager.for(tag).getReviewLogs();
    const dateSet = new Set(allLogs.map((l) => l.reviewed_at));
    let count = 0;
    let cursor = dateHelper.todayISOString();
    while (dateSet.has(cursor)) {
      count += 1;
      cursor = dateHelper.addDays(cursor, -1);
    }
    return count;
  }, []);

  /**
   * 刷新当前词本的统计数据（今日学习 / 今日复习 / 已下载 / 打卡）
   */
  const refreshStats = useCallback(
    async (tag) => {
      const manager = VocabManager.for(tag);
      const [newQueue, reviewQueue, cached, streakCount] = await Promise.all([
        manager.getNewQueue(),
        manager.getReviewQueue(),
        AudioDownloadService.countCached(tag),
        calcStreak(tag),
      ]);
      setTotalWords(manager.getWordList().length);
      setCachedCount(cached);
      setProcessedCount(0);
      setNewInfo(newQueue);
      setReviewInfo(reviewQueue);
      setStreak(streakCount);
    },
    [calcStreak]
  );

  /**
   * 执行批量下载词典原声（委托 AudioDownloadService，本组件只管 UI 状态与取消）
   * 一次跑完后无论成败都由服务标记完成，避免每次回前台全量重扫；失败词在播放时自动补下。
   */
  const runPreload = useCallback(
    async (tag) => {
      if (!tag || isPreloadingRef.current) return;
      if (bookDoneRef.current[tag]) return;

      startPreload();
      cancelledRef.current = false;
      setProcessedCount(0);
      let failedCount = 0;
      try {
        const result = await AudioDownloadService.preloadBook(tag, {
          onProgress: (processed, total, succeeded) => {
            updatePreload(processed, total);
            setCachedCount(succeeded); // 已下载数（含检测到的已有文件，从真实位置起步）
            setProcessedCount(processed);
          },
          isCancelled: () => cancelledRef.current,
        });
        failedCount = result.failed;
      } catch (e) {
        console.warn('发音下载失败:', e);
      } finally {
        finishPreload();
        // 本会话内标记已跑完（持久化标记由服务内部完成）
        bookDoneRef.current[tag] = true;
        const cached = await AudioDownloadService.countCached(tag);
        setCachedCount(cached);
        if (failedCount > 0) {
          Alert.alert(
            '发音下载完成',
            `已下载 ${cached} 个，${failedCount} 个失败（可稍后重试，播放时会自动补下）`
          );
        }
      }
    },
    [startPreload, updatePreload, finishPreload]
  );

  /**
   * 检查网络并触发预下载（Wi-Fi 直接开始，非 Wi-Fi 弹窗确认）
   */
  const handlePreload = useCallback(
    async (tag) => {
      if (!tag || isPreloadingRef.current) return;
      try {
        const net = await Network.getNetworkStateAsync();
        const isWifi = net.type === Network.NetworkStateType.WIFI;
        if (isWifi) {
          runPreload(tag);
        } else if (warnedTagRef.current === tag) {
          runPreload(tag);
        } else {
          warnedTagRef.current = tag;
          Alert.alert(
            '当前非 Wi-Fi 网络',
            `将使用移动网络下载 ${VocabManager.for(tag).getWordList().length} 个发音，是否继续？`,
            [
              { text: '取消', style: 'cancel' },
              { text: '确定', onPress: () => runPreload(tag) },
            ]
          );
        }
      } catch (e) {
        runPreload(tag);
      }
    },
    [runPreload]
  );

  // 页面获得焦点时（如从复习页返回）刷新统计
  useFocusEffect(
    useCallback(() => {
      if (currentBookTag) {
        refreshStats(currentBookTag);
      }
    }, [currentBookTag, refreshStats])
  );

  /** 手动触发预下载（AudioPreloadCard 的 onStart）——清除完成标记以允许重试，已下载的词会快速跳过 */
  const handleManualPreload = useCallback(() => {
    if (currentBookTag) {
      bookDoneRef.current[currentBookTag] = false;
    }
    handlePreload(currentBookTag);
  }, [handlePreload, currentBookTag]);

  // 词本切换：刷新统计；若该词本从未完整下载过发音则自动触发一次（持久化标记，重启不重扫）
  useEffect(() => {
    const tag = currentBookTag;
    if (!tag) return;

    const load = async () => {
      const done = await AudioDownloadService.isPreloaded(tag);
      if (!done && !isPreloadingRef.current && !bookDoneRef.current[tag]) {
        handlePreload(tag);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBookTag, refreshStats, handlePreload]);

  // AppState：进入后台中断下载，回到前台仅刷新统计（不自动重扫下载）
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        cancelledRef.current = true;
        if (isPreloadingRef.current) {
          finishPreload();
        }
      } else {
        const tag = currentTagRef.current;
        if (tag) {
          refreshStats(tag);
        }
      }
    });
    return () => subscription.remove();
  }, [finishPreload, refreshStats]);

  // 组件卸载时中断可能仍在进行的下载
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  /** 打开配额设置弹窗（预填当前值） */
  const openQuotaModal = useCallback(() => {
    setNewLimitInput(String(newInfo.limit));
    setReviewLimitInput(String(reviewInfo.limit));
    setShowQuotaModal(true);
  }, [newInfo.limit, reviewInfo.limit]);

  /** 保存配额 */
  const saveQuota = useCallback(async () => {
    const newLimit = parseInt(newLimitInput, 10);
    const reviewLimit = parseInt(reviewLimitInput, 10);
    if (!Number.isFinite(newLimit) || newLimit <= 0 || !Number.isFinite(reviewLimit) || reviewLimit <= 0) {
      Alert.alert('输入无效', '每日学习量与复习量需为正整数');
      return;
    }
    const manager = VocabManager.for(currentBookTag);
    await manager.setDailyLimits({ newLimit, reviewLimit });
    setShowQuotaModal(false);
    await refreshStats(currentBookTag);
  }, [newLimitInput, reviewLimitInput, currentBookTag, refreshStats]);

  const noBook = !currentBookTag;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
    >
      {/* 顶部标题区 */}
      <Text style={styles.title}>我的单词本</Text>
      <Text style={styles.subtitle}>选择词本开始学习</Text>

      {/* 词本选择器 */}
      <BookSelector
        books={availableBooks}
        selected={currentBookTag}
        onSelect={selectBook}
        labels={BOOK_LABELS}
      />

      {noBook ? (
        <View style={styles.emptyCard}>
          <Feather name="book" size={40} color="#9CA3AF" />
          <Text style={styles.emptyText}>请选择一个单词本开始学习</Text>
        </View>
      ) : (
        <>
          {/* 今日学习卡片（新词） */}
          <View style={styles.taskCard}>
            <View style={styles.taskHeader}>
              <View style={[styles.taskIcon, { backgroundColor: '#E8F0FE' }]}>
                <Feather name="book-open" size={18} color="#4A90D9" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.taskTitle}>今日学习</Text>
                <Text style={styles.taskDesc}>新词 · 每日限额 {newInfo.limit}</Text>
              </View>
              <Text style={styles.taskCount}>
                {newInfo.learned}/{newInfo.limit}
              </Text>
            </View>
            <Pressable
              style={[styles.taskButton, styles.primaryButton]}
              disabled={noBook}
              onPress={() => navigation.navigate('Review', { bookTag: currentBookTag, mode: 'new' })}
            >
              <Text style={styles.primaryButtonText}>
                {newInfo.queue.length > 0 ? `开始学习（剩 ${newInfo.queue.length} 个）` : '今日新词已学完'}
              </Text>
            </Pressable>
          </View>

          {/* 今日复习卡片（到期词） */}
          <View style={styles.taskCard}>
            <View style={styles.taskHeader}>
              <View style={[styles.taskIcon, { backgroundColor: '#EAFBF3' }]}>
                <Feather name="repeat" size={18} color="#30A46C" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.taskTitle}>今日复习</Text>
                <Text style={styles.taskDesc}>到期词 · 每日限额 {reviewInfo.limit}</Text>
              </View>
              <Text style={styles.taskCount}>
                {reviewInfo.learned}/{reviewInfo.limit}
              </Text>
            </View>
            <Pressable
              style={[styles.taskButton, styles.reviewButton]}
              disabled={noBook}
              onPress={() =>
                navigation.navigate('Review', { bookTag: currentBookTag, mode: 'review' })
              }
            >
              <Text style={styles.reviewButtonText}>
                {reviewInfo.queue.length > 0
                  ? `开始复习（剩 ${reviewInfo.queue.length} 个）`
                  : '今日复习已完成'}
              </Text>
            </Pressable>
          </View>

          {/* 发音预下载卡片 */}
          <AudioPreloadCard
            total={totalWords}
            cached={cachedCount}
            processed={processedCount}
            isPreloading={isAudioPreloading}
            onStart={handleManualPreload}
          />

          {/* 配额设置入口 */}
          <Pressable style={styles.quotaButton} onPress={openQuotaModal}>
            <Feather name="settings" size={14} color="#6B7280" />
            <Text style={styles.quotaButtonText}>调整每日学习 / 复习量</Text>
          </Pressable>
        </>
      )}

      {/* 查看统计 */}
      <Pressable
        style={[styles.secondaryButton, noBook && styles.secondaryButtonDisabled]}
        disabled={noBook}
        onPress={() => navigation.navigate('Stats', { bookTag: currentBookTag })}
      >
        <Text style={[styles.secondaryButtonText, noBook && styles.secondaryTextDisabled]}>
          查看统计
        </Text>
      </Pressable>

      {/* 查看单词本（词表列表，可跳转例句网页） */}
      <Pressable
        style={[styles.secondaryButton, noBook && styles.secondaryButtonDisabled]}
        disabled={noBook}
        onPress={() => navigation.navigate('WordList', { bookTag: currentBookTag })}
      >
        <Text style={[styles.secondaryButtonText, noBook && styles.secondaryTextDisabled]}>
          查看单词本
        </Text>
      </Pressable>

      {/* 底部信息区 */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>连续打卡 {streak} 天</Text>
      </View>

      {/* 每日配额设置弹窗 */}
      <Modal visible={showQuotaModal} transparent animationType="fade">
        <View style={styles.modalMask}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>每日学习计划</Text>

            <Text style={styles.modalLabel}>每日新词量</Text>
            <TextInput
              style={styles.modalInput}
              value={newLimitInput}
              onChangeText={setNewLimitInput}
              keyboardType="number-pad"
              placeholder="如 20"
            />

            <Text style={styles.modalLabel}>每日复习量</Text>
            <TextInput
              style={styles.modalInput}
              value={reviewLimitInput}
              onChangeText={setReviewLimitInput}
              keyboardType="number-pad"
              placeholder="如 100"
            />

            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setShowQuotaModal(false)}>
                <Text style={styles.modalCancelText}>取消</Text>
              </Pressable>
              <Pressable style={styles.modalConfirm} onPress={saveQuota}>
                <Text style={styles.modalConfirmText}>保存</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 14,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: -10,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E9F0',
    paddingVertical: 48,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  taskIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  taskDesc: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  taskCount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  taskButton: {
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#4A90D9',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  reviewButton: {
    backgroundColor: '#EAFBF3',
    borderWidth: 1,
    borderColor: '#30A46C',
  },
  reviewButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#30A46C',
  },
  quotaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  quotaButtonText: {
    fontSize: 13,
    color: '#6B7280',
  },
  secondaryButton: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#4A90D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonDisabled: {
    borderColor: '#C9D3DF',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4A90D9',
  },
  secondaryTextDisabled: {
    color: '#9CA3AF',
  },
  footer: {
    marginTop: 4,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: '#6B7280',
  },
  modalMask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 32,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 10,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  modalLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  modalInput: {
    height: 44,
    borderWidth: 1,
    borderColor: '#E5E9F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#1F2937',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  modalCancel: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modalCancelText: {
    fontSize: 14,
    color: '#6B7280',
  },
  modalConfirm: {
    backgroundColor: '#4A90D9',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
