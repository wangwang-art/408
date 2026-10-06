/**
 * theme.js —— 全局设计 Token 与共享视觉常量（单一事实源）
 *
 * 为什么需要这个文件？
 * 改版前，颜色（如主蓝 #4A90D9）、评分色阶 RATE_COLORS、评分标签 RATE_LABELS
 * 散落在 5+ 个文件的 StyleSheet 与局部常量里，改一个颜色要全局搜替换、极易遗漏。
 * 本文件把它们集中到一处，任何组件都从这里读取，做到"改一处、全应用生效"。
 *
 * 使用方式：
 *   import { colors, rateColors, rateLabels, colorForRating } from '../theme';
 *
 * 设计原则：
 * - 颜色按"语义"命名（primary / foreground / danger），而非按数值命名（blue500），
 *   这样换肤或适配深色模式时只需改值、不必改调用处。
 * - 评分色阶与标签是业务约定（1=忘记 ~ 5=简单），全应用必须一致，故集中管理。
 */

// ---------- 色板 ----------
// 集中定义所有颜色。后续若要做深色模式，只需在这里加一份 dark 变体即可。
export const colors = {
  // 品牌主色（沉稳蓝）
  primary: '#4A90D9',
  primaryHover: '#3A7BC8',
  primaryLight: '#E8F1FA', // 主色浅底：按钮浅底、徽标背景
  primaryDeep: '#1D4ED8', // 主色深字：浅底上的可读文字

  // 中性色
  background: '#F5F7FA', // 页面背景
  card: '#FFFFFF', // 卡片背景
  border: '#E5E9F0', // 边框 / 分割线
  foreground: '#1F2937', // 主文字
  textSecondary: '#6B7280', // 次要文字
  textMuted: '#9CA3AF', // 占位 / 提示文字

  // 语义色
  success: '#30A46C',
  successSoft: '#EAFBF3',
  danger: '#E5484D',
  dangerSoft: '#FDECEC',
  warning: '#FFB020',
};

/**
 * 评分色阶：1 红 -> 5 绿
 * 被 RatingButtons / ReviewScreen / WordDetailScreen / StatsScreen / WordListScreen 共用。
 * 改色阶只需改这里一处。
 * @type {string[]}
 */
export const rateColors = ['#E5484D', '#F76B15', '#FFB020', '#46A758', '#30A46C'];

/**
 * 评分文字标签：1 -> 忘记 ... 5 -> 简单
 * 全应用统一口径（此前 WordDetailScreen 用"一般"、RatingButtons 用"模糊"，现统一为"模糊"）。
 * @type {string[]}
 */
export const rateLabels = ['忘记', '困难', '模糊', '顺利', '简单'];

/**
 * 统计热力图色阶（5 档：0 / 1 / 2~4 / 5~9 / >=10）
 * @type {string[]}
 */
export const heatColors = ['#EBEEF4', '#C6E0F7', '#8FC1EC', '#4A90D9', '#2C5F8A'];

/**
 * 按评分(1-5)返回对应颜色，非法值回退到中档（index 2）。
 * @param {number} rating 1~5
 * @returns {string} 颜色值
 */
export function colorForRating(rating) {
  const i = rating - 1;
  if (i < 0 || i >= rateColors.length) return rateColors[2];
  return rateColors[i];
}

/**
 * 按当天复习次数返回热力图颜色档位
 * @param {number} count 当天复习次数
 * @returns {string} 颜色值
 */
export function colorForHeat(count) {
  if (count <= 0) return heatColors[0];
  if (count >= 10) return heatColors[4];
  if (count >= 5) return heatColors[3];
  if (count >= 2) return heatColors[2];
  return heatColors[1];
}

/**
 * 由复习次数(repetitions)推导熟悉度 1~5
 * 规则：familiarity = min(5, repetitions + 1)；无进度行时返回 0（表示"未学"）
 * 此前该换算在 WordDetailScreen / WordListScreen / StatsScreen 各写一遍，现集中。
 * @param {object|undefined|null} progress 进度行
 * @returns {number} 0 表示未学；否则 1~5
 */
export function familiarityFromProgress(progress) {
  if (!progress) return 0;
  return Math.min(5, Math.max(1, (progress.repetitions || 0) + 1));
}
