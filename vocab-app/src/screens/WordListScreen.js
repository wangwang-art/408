/**
 * WordListScreen —— 单词本页（词表列表）
 *
 * 展示当前词本的全部单词与学习信息：
 * 1. 顶部统计条：总词数 / 已学 / 待复习 / 困难词数
 * 2. 搜索框：按单词或释义快速过滤
 * 3. 单词列表：单词 + 音标 + 中文释义 + 学习状态徽标（熟悉度 / 困难 / 未学）
 * 4. 点击单词进入详情页（WordDetail）
 * 5. 每个单词行右侧发音按钮（播放词典原声）
 * 6. 每行"例句"按钮：用系统浏览器打开该单词的在线词典例句页
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  FlatList,
  Linking,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import VocabManager from '../services/VocabManager';
import * as TtsService from '../services/TtsService';
import { rateColors, familiarityFromProgress } from '../theme';

// 例句查询页：有道词典手机版（适配手机屏幕，含音标/释义/权威例句）
const exampleUrl = (word) =>
  `https://dict.youdao.com/m/result?word=${encodeURIComponent(word)}&lang=en`;

export default function WordListScreen({ route, navigation }) {
  const { bookTag } = route.params;
  const insets = useSafeAreaInsets();

  // 词本管理器
  const manager = useMemo(() => VocabManager.for(bookTag), [bookTag]);

  const [words, setWords] = useState([]); // 全部单词（含 progress）
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // 加载全部单词的学习状态
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const all = await manager.getAllProgress();
        if (!cancelled) setWords(all);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [manager]);

  // 导航栏标题
  useEffect(() => {
    navigation.setOptions({ title: '单词本' });
  }, [navigation]);

  // 顶部统计：已学（有进度行）/ 困难词 / 总词数
  const stats = useMemo(() => {
    const learned = words.filter((w) => w.progress).length;
    const hard = words.filter((w) => w.progress && (w.progress.hard_count || 0) >= 2).length;
    return { total: words.length, learned, hard };
  }, [words]);

  // 搜索过滤：匹配单词或释义
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return words;
    return words.filter(
      (w) =>
        w.word.toLowerCase().includes(q) ||
        (w.meaning || '').toLowerCase().includes(q) ||
        (w.phonetic || '').toLowerCase().includes(q)
    );
  }, [words, search]);

  /** 播放发音（点击喇叭按钮） */
  const handleSpeak = useCallback(
    async (word) => {
      try {
        await TtsService.speak(word, bookTag);
      } catch (e) {
        // 播放失败静默忽略
      }
    },
    [bookTag]
  );

  /** 打开浏览器例句页（有道词典） */
  const handleOpenExample = useCallback((word) => {
    const url = exampleUrl(word);
    Linking.openURL(url).catch(() => {
      Alert.alert('无法打开浏览器', '请检查系统浏览器是否可用');
    });
  }, []);

  /** 渲染单个单词行 */
  const renderItem = useCallback(
    ({ item }) => {
      const fam = familiarityFromProgress(item.progress);
      const isHard = item.progress && (item.progress.hard_count || 0) >= 2;
      const isNew = !item.progress;
      return (
        <Pressable
          style={styles.row}
          onPress={() => navigation.navigate('WordDetail', { bookTag, word: item.word })}
        >
          {/* 左：单词 + 音标 + 释义 */}
          <View style={styles.rowInfo}>
            <View style={styles.rowTop}>
              <Text style={styles.rowWord}>{item.word}</Text>
              {isNew ? (
                <View style={styles.badgeNew}>
                  <Text style={styles.badgeNewText}>未学</Text>
                </View>
              ) : isHard ? (
                <View style={styles.badgeHard}>
                  <Text style={styles.badgeHardText}>困难</Text>
                </View>
              ) : (
                <View style={[styles.badgeFam, { backgroundColor: rateColors[fam - 1] }]}>
                  <Text style={styles.badgeFamText}>{fam}</Text>
                </View>
              )}
            </View>
            {item.phonetic ? <Text style={styles.rowPhonetic}>{item.phonetic}</Text> : null}
            <Text style={styles.rowMeaning} numberOfLines={2}>
              {item.meaning || ''}
            </Text>
          </View>

          {/* 右：例句按钮 + 发音按钮 */}
          <View style={styles.rowActions}>
            <Pressable
              style={styles.iconButton}
              hitSlop={6}
              onPress={() => handleOpenExample(item.word)}
            >
              <Feather name="external-link" size={16} color="#4A90D9" />
            </Pressable>
            <Pressable
              style={[styles.iconButton, styles.soundButton]}
              hitSlop={6}
              onPress={() => handleSpeak(item.word)}
            >
              <Feather name="volume-2" size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        </Pressable>
      );
    },
    [bookTag, navigation, handleOpenExample, handleSpeak]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 顶部统计条 */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{stats.total}</Text>
          <Text style={styles.statLabel}>总词数</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{stats.learned}</Text>
          <Text style={styles.statLabel}>已学</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, stats.hard > 0 && { color: '#E5484D' }]}>{stats.hard}</Text>
          <Text style={styles.statLabel}>困难词</Text>
        </View>
      </View>

      {/* 搜索框 */}
      <View style={styles.searchWrap}>
        <Feather name="search" size={16} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="搜索单词或释义..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 ? (
          <Pressable hitSlop={8} onPress={() => setSearch('')}>
            <Feather name="x" size={16} color="#9CA3AF" />
          </Pressable>
        ) : null}
      </View>

      {/* 列表 */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.word}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Feather name="inbox" size={36} color="#C3CAD6" />
            <Text style={styles.emptyText}>
              {isLoading ? '加载中...' : search ? '没有匹配的单词' : '词表为空'}
            </Text>
          </View>
        }
      />

      {/* 底部说明 */}
      <Text style={styles.footerHint}>点击单词查看详情 · 外链按钮打开在线例句</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E9F0',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statNum: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E9F0',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E9F0',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E9F0',
    padding: 14,
    gap: 10,
  },
  rowInfo: {
    flex: 1,
    gap: 4,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowWord: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
  },
  badgeNew: {
    backgroundColor: '#F0F2F5',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeNewText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
  },
  badgeHard: {
    backgroundColor: '#FDECEC',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeHardText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#E5484D',
  },
  badgeFam: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeFamText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  rowPhonetic: {
    fontSize: 12,
    color: '#6B7280',
  },
  rowMeaning: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 19,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#4A90D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soundButton: {
    backgroundColor: '#4A90D9',
    borderWidth: 0,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  footerHint: {
    textAlign: 'center',
    fontSize: 11,
    color: '#9CA3AF',
    paddingBottom: 8,
  },
});
