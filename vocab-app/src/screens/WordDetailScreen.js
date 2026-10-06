/**
 * WordDetailScreen —— 单词详情页
 *
 * 展示单词完整信息（音标 / 词性 / 释义 / 例句），支持：
 * 1. 播放发音（本地缓存优先，无则从 TTS 服务下载）
 * 2. 自定义标签的添加与删除（标签云，胶囊样式）
 * 3. 熟悉度滑块（1~5 档，点击即保存，防抖防止快速连点）
 * 4. 重置该单词的复习进度（不可撤销，重置后重新出现在待复习列表）
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import VocabManager from '../services/VocabManager';
import * as TtsService from '../services/TtsService';
import { rateColors, rateLabels } from '../theme';

export default function WordDetailScreen({ route }) {
  const { bookTag, word } = route.params;

  // 词本管理器：每个词本只创建一次
  const manager = useMemo(() => VocabManager.for(bookTag), [bookTag]);
  // 在词库中查找该单词；找不到时显示错误文案
  const wordObj = useMemo(
    () => manager.getWordList().find((w) => w.word === word) || null,
    [manager, word]
  );

  const [familiarity, setFamiliarity] = useState(1);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [history, setHistory] = useState([]); // 该单词的复习历史
  // 在线抓取的完整释义与例句（缓存优先，未命中时后台抓取并缓存）
  const [crawledInfo, setCrawledInfo] = useState(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const savingRef = useRef(false); // 熟悉度保存防抖锁

  // 加载该单词当前的熟悉度（repetitions + 1，上限 5）与自定义标签
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [progress, tagList, reviewHistory] = await Promise.all([
        manager.getProgress(word),
        manager.getWordTags(word),
        manager.getWordReviewLogs(word),
      ]);
      if (cancelled) return;
      if (progress) {
        setFamiliarity(Math.min(5, Math.max(1, (progress.repetitions || 0) + 1)));
      }
      setTags(tagList);
      setHistory(reviewHistory);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [manager, word, bookTag]);

  // 加载在线完整释义与例句（缓存命中立即返回；未命中抓取一次并写入缓存）
  // 延迟 250ms 等页面转场结束，避免转场期间网络请求/解析与动画竞争导致卡顿
  useEffect(() => {
    let cancelled = false;
    let timer = null;
    const load = async () => {
      setInfoLoading(true);
      try {
        const info = await manager.getWordInfo(word);
        if (!cancelled) setCrawledInfo(info);
      } catch (e) {
        // 抓取失败静默：回退词库自带释义
      } finally {
        if (!cancelled) setInfoLoading(false);
      }
    };
    timer = setTimeout(load, 250);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [manager, word]);

  /**
   * 播放单词发音
   * 优先播放本地缓存/打包的词典原声，缺失时回退系统 TTS
   */
  const playSound = async () => {
    try {
      await TtsService.speak(word, bookTag);
    } catch (e) {
      // 发音失败静默忽略
    }
  };

  /** 添加自定义标签 */
  const handleAddTag = async () => {
    const tag = tagInput.trim();
    if (!tag) return;
    try {
      await manager.addTagForWord(word, tag);
      setTags(await manager.getWordTags(word));
      setTagInput('');
    } catch (e) {
      // 写入失败静默忽略
    }
  };

  /** 删除自定义标签 */
  const handleRemoveTag = async (tag) => {
    try {
      await manager.removeTagForWord(word, tag);
      setTags(await manager.getWordTags(word));
    } catch (e) {
      // 写入失败静默忽略
    }
  };

  /**
   * 点击熟悉度档位：界面即时反馈 + 防抖保存
   * 上一次保存未完成时忽略本次点击，避免快速连点导致异步写入乱序。
   * @param {number} rating 熟悉度 1~5
   */
  const handleSetFamiliarity = (rating) => {
    setFamiliarity(rating); // 界面即时反馈
    if (savingRef.current) return; // 保存中则忽略
    savingRef.current = true;
    manager
      .setFamiliarity(word, rating)
      .catch(() => {})
      .finally(() => {
        savingRef.current = false;
      });
  };

  /** 重置该单词的复习进度（不可撤销） */
  const handleReset = () => {
    Alert.alert('重置进度', '确定重置该单词的复习进度吗？此操作不可撤销', [
      { text: '取消', style: 'cancel' },
      {
        text: '确定',
        style: 'destructive',
        onPress: async () => {
          try {
            await manager.resetProgress(word);
            // 重置后：熟悉度回到默认 1，标签清空（deleteProgress 同时删除标签）
            setFamiliarity(1);
            setTags([]);
            Alert.alert('已重置', '该单词的复习进度已清除，将重新出现在待复习列表中');
          } catch (e) {
            Alert.alert('重置失败', '请稍后重试');
          }
        },
      },
    ]);
  };

  // 词库中找不到该单词
  if (!wordObj) {
    return (
      <View style={styles.center}>
        <Feather name="alert-circle" size={40} color="#F76B15" />
        <Text style={styles.errorText}>未找到该单词，可能已被移除</Text>
      </View>
    );
  }

  // 熟悉度滑块填充宽度：(value - 1) / 4 * 100%，对应第 1~5 个刻度圆点中心
  const fillWidth = `${((familiarity - 1) / 4) * 100}%`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 单词信息卡片 */}
      <View style={styles.card}>
        <View style={styles.wordRow}>
          <View style={styles.wordInfo}>
            <Text style={styles.wordText}>{wordObj.word}</Text>
            {wordObj.phonetic ? <Text style={styles.phonetic}>{wordObj.phonetic}</Text> : null}
          </View>
          {/* 发音按钮：主蓝底圆钮 */}
          <Pressable style={styles.soundButton} onPress={playSound}>
            <Feather name="volume-2" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
        {wordObj.pos ? (
          <View style={styles.posTag}>
            <Text style={styles.posText}>{wordObj.pos}</Text>
          </View>
        ) : null}
        {/* 释义：优先展示爬取的完整含义（多义项拼接），未抓取到则回退词库释义 */}
        <Text style={styles.meaning}>
          {(crawledInfo && crawledInfo.meaning) || wordObj.meaning}
        </Text>

        {/* 例句：优先展示爬取的双语例句（最多 3 条），否则回退词库自带例句 */}
        {crawledInfo && crawledInfo.examples.length > 0 ? (
          <View style={styles.crawledExamples}>
            {crawledInfo.examples.slice(0, 3).map((ex, i) => (
              <View style={styles.crawledExampleRow} key={i}>
                <Text style={styles.example}>“{ex.en}”</Text>
                {ex.zh ? <Text style={styles.exampleZh}>{ex.zh}</Text> : null}
              </View>
            ))}
          </View>
        ) : wordObj.example ? (
          <Text style={styles.example}>例: {wordObj.example}</Text>
        ) : null}

        {/* 数据来源标识 / 抓取中提示 */}
        {crawledInfo ? (
          <View style={styles.crawledBadge}>
            <Text style={styles.crawledBadgeText}>完整释义与例句来自有道词典 · 已缓存</Text>
          </View>
        ) : infoLoading ? (
          <Text style={styles.exampleLoading}>正在获取在线释义与例句…</Text>
        ) : null}
      </View>

      {/* 自定义标签：标签云 */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>自定义标签</Text>
        <View style={styles.tagWrap}>
          {tags.length === 0 ? (
            <Text style={styles.tagEmpty}>暂无标签</Text>
          ) : (
            tags.map((tag) => (
              <View style={styles.chip} key={tag}>
                <Text style={styles.chipText}>{tag}</Text>
                <Pressable hitSlop={8} onPress={() => handleRemoveTag(tag)}>
                  <Feather name="x" size={14} color="#1D4ED8" />
                </Pressable>
              </View>
            ))
          )}
        </View>
        {/* 添加标签：输入框 + 添加按钮 */}
        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            placeholder="输入标签，如：高频词"
            placeholderTextColor="#9CA3AF"
            value={tagInput}
            onChangeText={setTagInput}
            returnKeyType="done"
            onSubmitEditing={handleAddTag}
          />
          <Pressable style={styles.addButton} onPress={handleAddTag}>
            <Feather name="plus" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {/* 熟悉度滑块 */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>熟悉度</Text>
        {/* 自定义滑块：轨道 + 5 个刻度圆点（点击直接设置） */}
        <View style={styles.sliderArea}>
          <View style={styles.sliderWrap}>
            {/* 轨道：浅灰底 */}
            <View style={styles.track}>
              {/* 填充：主蓝，宽度随熟悉度变化 */}
              <View style={[styles.trackFill, { width: fillWidth }]} />
            </View>
            {/* 刻度圆点：value 及以下亮起 */}
            <View style={styles.dotsRow}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Pressable
                  key={i}
                  style={[styles.dot, i <= familiarity ? styles.dotActive : styles.dotInactive]}
                  onPress={() => handleSetFamiliarity(i)}
                >
                  <Text style={[styles.dotText, i <= familiarity && styles.dotTextActive]}>
                    {i}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
        <Text style={styles.famValue}>熟悉度 {familiarity} / 5</Text>
        <Text style={styles.famHint}>1 忘记 ~ 5 简单</Text>
      </View>

      {/* 复习历史 */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>复习历史</Text>
        {history.length === 0 ? (
          <Text style={styles.historyEmpty}>暂无复习记录，开始学习后这里会显示每次评分</Text>
        ) : (
          <>
            {history.map((h) => {
              const rating = h.rating >= 1 && h.rating <= 5 ? h.rating : 3;
              const color = rateColors[rating - 1];
              return (
                <View style={styles.historyRow} key={h.id}>
                  {/* 评分圆点 */}
                  <View style={[styles.historyDot, { backgroundColor: color }]}>
                    <Text style={styles.historyDotText}>{rating}</Text>
                  </View>
                  {/* 评分文字 + 类型 */}
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyRating}>
                      {rateLabels[rating - 1]}
                      {h.is_new === 1 ? (
                        <Text style={styles.historyType}> · 首次学习</Text>
                      ) : (
                        <Text style={styles.historyType}> · 复习</Text>
                      )}
                    </Text>
                    <Text style={styles.historyDate}>{h.reviewed_at}</Text>
                  </View>
                </View>
              );
            })}
            <Text style={styles.historyCount}>共 {history.length} 次记录（最新在前）</Text>
          </>
        )}
      </View>

      {/* 重置进度 */}
      <Pressable style={styles.resetButton} onPress={handleReset}>
        <Text style={styles.resetText}>重置该单词进度</Text>
      </Pressable>
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
    gap: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F7FA',
    gap: 12,
    padding: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#6B7280',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E5E9F0',
  },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  wordInfo: {
    flex: 1,
    gap: 6,
  },
  wordText: {
    fontSize: 30,
    fontWeight: '700',
    color: '#1F2937',
  },
  phonetic: {
    fontSize: 15,
    color: '#6B7280',
  },
  soundButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4A90D9',
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
  },
  example: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
    lineHeight: 22,
  },
  crawledExamples: {
    gap: 10,
  },
  crawledExampleRow: {
    gap: 2,
  },
  exampleZh: {
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 20,
  },
  crawledBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F1FA',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  crawledBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4A90D9',
  },
  exampleLoading: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagEmpty: {
    fontSize: 13,
    color: '#9CA3AF',
    paddingVertical: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8F1FA',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 13,
    color: '#1D4ED8',
  },
  addRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E9F0',
    backgroundColor: '#F5F7FA',
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#1F2937',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#4A90D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderArea: {
    marginTop: 16,
  },
  sliderWrap: {
    position: 'relative',
    height: 28,
  },
  track: {
    position: 'absolute',
    left: 14,
    right: 14,
    top: 10,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E9F0',
  },
  trackFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4A90D9',
  },
  dotsRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  dotActive: {
    backgroundColor: '#4A90D9',
    borderColor: '#4A90D9',
  },
  dotInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E9F0',
  },
  dotText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  dotTextActive: {
    color: '#FFFFFF',
  },
  famValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    marginTop: 16,
  },
  famHint: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  historyEmpty: {
    fontSize: 13,
    color: '#9CA3AF',
    paddingVertical: 6,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E9F0',
  },
  historyDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyDotText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  historyInfo: {
    flex: 1,
    gap: 2,
  },
  historyRating: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  historyType: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B7280',
  },
  historyDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  historyCount: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'right',
  },
  resetButton: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E5484D',
  },
});
