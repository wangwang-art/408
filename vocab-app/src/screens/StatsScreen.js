/**
 * StatsScreen —— 学习统计页
 *
 * 展示内容：
 * 1. 时间分段控件（今日 / 本周 / 总计），用于关键数据卡片
 * 2. 关键数据卡片：连续打卡天数 / 复习次数 / 平均正确率
 * 3. 最近 90 天学习热度热力图（13 列 x 7 行，列优先排列，基于全部日志）
 * 4. 熟悉度分布环形图（react-native-svg 绘制，1 红 ~ 5 绿）
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Text as SvgText } from 'react-native-svg';
import { useApp } from '../context/AppContext';
import VocabManager from '../services/VocabManager';
import * as dateHelper from '../utils/dateHelper';
import { rateColors, colorForHeat, familiarityFromProgress } from '../theme';

// 时间分段
const SEGMENTS = [
  { key: 'today', label: '今日' },
  { key: 'week', label: '本周' },
  { key: 'total', label: '总计' },
];

export default function StatsScreen({ route }) {
  const { state } = useApp();
  // 词本：优先取路由参数（从首页进入时传入），否则回退到全局当前词本
  const bookTag = route.params?.bookTag ?? state.currentBookTag;

  const [segment, setSegment] = useState('today');
  const [logs, setLogs] = useState([]); // 该词本全部复习日志
  const [progresses, setProgresses] = useState([]); // 该词本全部进度行

  // 词本管理器（单例）
  const manager = useMemo(() => VocabManager.for(bookTag), [bookTag]);

  // 加载该词本的全部日志与进度（通过门面，不直接依赖 StorageService）
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [l, p] = await Promise.all([
        manager.getReviewLogs(),
        manager.getProgressRows(),
      ]);
      if (cancelled) return;
      setLogs(l);
      setProgresses(p);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [manager]);

  // 按当前分段过滤日志
  const filteredLogs = useMemo(() => {
    if (segment === 'today') {
      const today = dateHelper.todayISOString();
      return logs.filter((l) => l.reviewed_at === today);
    }
    if (segment === 'week') {
      // 最近 7 天（含今天）：第 6 天前为起点
      const weekAgo = dateHelper.getDateNDaysAgo(6);
      return logs.filter((l) => l.reviewed_at >= weekAgo);
    }
    return logs;
  }, [logs, segment]);

  /**
   * 连续打卡天数：从今天往前数，review_log 日期去重后连续有记录的天数。
   * 基于全部日志计算（与分段无关），与首页统计口径一致。
   */
  const streak = useMemo(() => {
    const dateSet = new Set(logs.map((l) => l.reviewed_at));
    let count = 0;
    let cursor = dateHelper.todayISOString();
    while (dateSet.has(cursor)) {
      count += 1;
      cursor = dateHelper.addDays(cursor, -1);
    }
    return count;
  }, [logs]);

  // 当前分段的总复习次数
  const totalReviews = filteredLogs.length;
  // 当前分段的平均正确率：rating >= 3 的占比
  const avgCorrectRate =
    totalReviews > 0
      ? Math.round((filteredLogs.filter((l) => l.rating >= 3).length / totalReviews) * 100)
      : 0;
  // 最近复习记录：全部日志按 id 倒序取前 30 条（最新在前）
  const recentLogs = useMemo(() => [...logs].reverse().slice(0, 30), [logs]);

  // ---------- 学习热度热力图 ----------
  // 最近 90 天日期（旧 -> 新）
  const heatDates = useMemo(() => dateHelper.getLastNDates(90), []);
  // 每天复习次数：用全部日志统计（热力图固定显示最近 90 天，与分段无关）
  const heatCounts = useMemo(() => {
    const map = new Map();
    for (const l of logs) {
      map.set(l.reviewed_at, (map.get(l.reviewed_at) || 0) + 1);
    }
    return map;
  }, [logs]);
  // 按周分组为列：每列最多 7 格（列优先排列），最后一列可能不足 7 格
  const heatColumns = useMemo(() => {
    const cols = [];
    for (let i = 0; i < heatDates.length; i += 7) {
      cols.push(heatDates.slice(i, i + 7));
    }
    return cols;
  }, [heatDates]);

  /** 按数量取热力图颜色档位（委托给 theme.colorForHeat） */
  const heatColor = colorForHeat;

  // ---------- 熟悉度分布 ----------
  /**
   * 熟悉度分布统计：
   * 每项 familiarity = min(5, repetitions + 1)。
   * 进度行创建时 repetitions 默认 0，即从未复习过的词熟悉度为 1（默认值，注释说明）。
   */
  const famData = useMemo(() => {
    const counts = [0, 0, 0, 0, 0]; // 熟悉度 1~5 的单词数
    for (const p of progresses) {
      const fam = familiarityFromProgress(p);
      counts[fam - 1] += 1;
    }
    return { counts, total: progresses.length };
  }, [progresses]);

  /**
   * 环形图分段计算：
   * SVG 角度从 -90° 起顺时针，每段 arcTo 到端点；
   * 超过半圆的弧段需要设置 large-arc 标志。
   */
  const pieSegments = useMemo(() => {
    const { counts, total } = famData;
    if (total === 0) return [];
    const cx = 90;
    const cy = 90;
    const r = 70;
    const segments = [];
    let accum = 0;
    counts.forEach((count, i) => {
      if (count === 0) return; // 该档无单词则跳过
      const frac = count / total;
      const startAngle = accum * 2 * Math.PI - Math.PI / 2; // 从 -90° 开始
      const endAngle = (accum + frac) * 2 * Math.PI - Math.PI / 2;
      accum += frac;
      // 端点坐标
      const sx = cx + r * Math.cos(startAngle);
      const sy = cy + r * Math.sin(startAngle);
      const ex = cx + r * Math.cos(endAngle);
      const ey = cy + r * Math.sin(endAngle);
      // 弧段超过半圆时需要 large-arc 标志
      const largeArc = frac > 0.5 ? 1 : 0;
      const d = `M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey}`;
      segments.push({ d, color: rateColors[i], count, frac, fam: i + 1 });
    });
    return segments;
  }, [famData]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 顶部标题 */}
      <Text style={styles.title}>学习统计</Text>

      {/* 分段控件：选中项主蓝底白字 */}
      <View style={styles.segmentBar}>
        {SEGMENTS.map((s) => (
          <Pressable
            key={s.key}
            style={[styles.segmentButton, segment === s.key && styles.segmentButtonActive]}
            onPress={() => setSegment(s.key)}
          >
            <Text style={[styles.segmentText, segment === s.key && styles.segmentTextActive]}>
              {s.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* 关键数据卡片：3 个并排 */}
      <View style={styles.statCardsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{streak}</Text>
          <Text style={styles.statLabel}>连续打卡(天)</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalReviews}</Text>
          <Text style={styles.statLabel}>复习次数</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{avgCorrectRate}%</Text>
          <Text style={styles.statLabel}>平均正确率</Text>
        </View>
      </View>

      {/* 学习热度热力图 */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>最近 90 天学习热度</Text>
        <View style={styles.heatWrap}>
          {heatColumns.map((col, ci) => (
            <View key={ci} style={styles.heatColumn}>
              {col.map((iso) => (
                <View
                  key={iso}
                  style={[
                    styles.heatCell,
                    { backgroundColor: heatColor(heatCounts.get(iso) || 0) },
                  ]}
                />
              ))}
            </View>
          ))}
        </View>
      </View>

      {/* 熟悉度分布环形图 */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>熟悉度分布</Text>
        {famData.total === 0 ? (
          // 无任何进度记录时显示占位文案
          <Text style={styles.emptyText}>暂无复习数据</Text>
        ) : (
          <View style={styles.pieWrap}>
            <Svg width={180} height={180} viewBox="0 0 180 180">
              {/* 底色圆环 */}
              <Circle cx={90} cy={90} r={70} stroke="#EBEEF4" strokeWidth={22} fill="none" />
              {/* 各熟悉度分段 */}
              {pieSegments.map((seg, i) => (
                <Path
                  key={i}
                  d={seg.d}
                  stroke={seg.color}
                  strokeWidth={22}
                  strokeLinecap="butt"
                  fill="none"
                />
              ))}
              {/* 中心显示总词数 */}
              <SvgText
                x={90}
                y={88}
                textAnchor="middle"
                fontSize={24}
                fontWeight="700"
                fill="#1F2937"
              >
                {famData.total}
              </SvgText>
              <SvgText x={90} y={108} textAnchor="middle" fontSize={12} fill="#6B7280">
                已学单词
              </SvgText>
            </Svg>

            {/* 图例：颜色点 + 熟悉度 N + 词数 + 占比 */}
            <View style={styles.legendWrap}>
              {famData.counts.map((count, i) => (
                <View key={i} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: rateColors[i] }]} />
                  <Text style={styles.legendText}>
                    熟悉度 {i + 1} · {count} 词 ·{' '}
                    {famData.total > 0 ? Math.round((count / famData.total) * 100) : 0}%
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* 最近复习记录：明细列表（最新 30 条，倒序） */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>最近复习记录</Text>
        {recentLogs.length === 0 ? (
          <Text style={styles.emptyText}>暂无复习记录</Text>
        ) : (
          <>
            {recentLogs.map((l) => {
              const rating = l.rating >= 1 && l.rating <= 5 ? l.rating : 3;
              return (
                <View style={styles.logRow} key={l.id}>
                  <View style={[styles.logDot, { backgroundColor: rateColors[rating - 1] }]}>
                    <Text style={styles.logDotText}>{rating}</Text>
                  </View>
                  <Text style={styles.logWord} numberOfLines={1}>
                    {l.word}
                  </Text>
                  <Text style={styles.logDate}>{l.reviewed_at}</Text>
                </View>
              );
            })}
          </>
        )}
      </View>
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
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1F2937',
  },
  segmentBar: {
    flexDirection: 'row',
    backgroundColor: '#E5E9F0',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segmentButton: {
    flex: 1,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonActive: {
    backgroundColor: '#4A90D9',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  statCardsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#E5E9F0',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#4A90D9',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  heatWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  heatColumn: {
    flexDirection: 'column',
    gap: 4,
  },
  heatCell: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  emptyText: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 32,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E9F0',
  },
  logDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logDotText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  logWord: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  logDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  pieWrap: {
    alignItems: 'center',
  },
  legendWrap: {
    alignSelf: 'stretch',
    marginTop: 12,
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 13,
    color: '#1F2937',
  },
});
