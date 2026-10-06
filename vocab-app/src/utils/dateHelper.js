// 日期工具函数
// 所有日期统一使用 'YYYY-MM-DD' 形式的 ISO 字符串（本地时区语义），
// 字符串按字典序比较即等价于时间先后比较。

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 将 Date 对象格式化为 'YYYY-MM-DD'（本地时区）
 * @param {Date} date
 * @returns {string}
 */
export function toISODateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 今天的 ISO 日期字符串
 * @returns {string}
 */
export function todayISOString() {
  return toISODateString(new Date());
}

/**
 * 解析 'YYYY-MM-DD' 为 Date 对象（本地时区零点，避免 new Date(iso) 按 UTC 解析导致时区偏移）
 * @param {string} iso
 * @returns {Date}
 */
export function parseISODate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * 在指定 ISO 日期基础上加 n 天（n 可为负数）
 * @param {string} iso
 * @param {number} n
 * @returns {string}
 */
export function addDays(iso, n) {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + n);
  return toISODateString(date);
}

/**
 * 今天往前 n 天（n = 0 即今天，n = 1 为昨天）
 * @param {number} n
 * @returns {string}
 */
export function getDateNDaysAgo(n) {
  const date = new Date();
  date.setDate(date.getDate() - n);
  return toISODateString(date);
}

/**
 * 返回最近 n 天的 ISO 日期数组（从最旧到最新）
 * @param {number} n
 * @returns {string[]}
 */
export function getLastNDates(n) {
  const result = [];
  for (let i = n - 1; i >= 0; i--) {
    result.push(getDateNDaysAgo(i));
  }
  return result;
}

/**
 * 格式化短日期，如 '8月8日'
 * @param {string} iso
 * @returns {string}
 */
export function formatShort(iso) {
  const date = parseISODate(iso);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

/**
 * 判断 a 是否早于或等于 b（ISO 字符串字典序即时间序）
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function isBeforeOrEqual(a, b) {
  return a <= b;
}

/**
 * 计算两个 ISO 日期相差的天数（b - a，可为负）
 * @param {string} aISO
 * @param {string} bISO
 * @returns {number}
 */
export function daysBetween(aISO, bISO) {
  const a = parseISODate(aISO);
  const b = parseISODate(bISO);
  return Math.round((b - a) / DAY_MS);
}
