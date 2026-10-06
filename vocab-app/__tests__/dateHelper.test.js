// dateHelper 单元测试 —— 日期工具函数
// 运行方式：npm test
//
// 测试策略：
// - 纯函数（addDays, parseISODate, isBeforeOrEqual, daysBetween, formatShort）测绝对值
// - 依赖当前日期的函数（todayISOString, getDateNDaysAgo, getLastNDates）测相对关系

const {
  toISODateString,
  todayISOString,
  parseISODate,
  addDays,
  getDateNDaysAgo,
  getLastNDates,
  formatShort,
  isBeforeOrEqual,
  daysBetween,
} = require('../src/utils/dateHelper');

describe('toISODateString', () => {
  test('格式化为 YYYY-MM-DD', () => {
    expect(toISODateString(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toISODateString(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
  test('月日补零', () => {
    expect(toISODateString(new Date(2026, 2, 1))).toBe('2026-03-01');
  });
});

describe('addDays', () => {
  test('加正数天', () => {
    expect(addDays('2026-01-15', 1)).toBe('2026-01-16');
    expect(addDays('2026-01-15', 10)).toBe('2026-01-25');
  });
  test('加负数天（减天）', () => {
    expect(addDays('2026-01-15', -1)).toBe('2026-01-14');
    expect(addDays('2026-01-15', -15)).toBe('2025-12-31');
  });
  test('跨月', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  test('跨年', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });
  test('加 0 天返回同一天', () => {
    expect(addDays('2026-06-15', 0)).toBe('2026-06-15');
  });
});

describe('isBeforeOrEqual', () => {
  test('早于返回 true', () => {
    expect(isBeforeOrEqual('2026-01-01', '2026-01-02')).toBe(true);
  });
  test('等于返回 true', () => {
    expect(isBeforeOrEqual('2026-01-15', '2026-01-15')).toBe(true);
  });
  test('晚于返回 false', () => {
    expect(isBeforeOrEqual('2026-01-16', '2026-01-15')).toBe(false);
  });
});

describe('daysBetween', () => {
  test('同一天差 0', () => {
    expect(daysBetween('2026-01-15', '2026-01-15')).toBe(0);
  });
  test('b 在 a 之后返回正数', () => {
    expect(daysBetween('2026-01-15', '2026-01-20')).toBe(5);
  });
  test('b 在 a 之前返回负数', () => {
    expect(daysBetween('2026-01-20', '2026-01-15')).toBe(-5);
  });
  test('跨月跨年', () => {
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1);
  });
});

describe('parseISODate', () => {
  test('正确解析为 Date 对象', () => {
    const d = parseISODate('2026-03-15');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2); // 0-indexed
    expect(d.getDate()).toBe(15);
  });
  test('不按 UTC 解析（本地时区零点）', () => {
    // new Date('2026-03-15') 按 UTC 解析，东八区会变成 03-15 08:00
    // parseISODate 应保持本地零点
    const d = parseISODate('2026-03-15');
    expect(d.getHours()).toBe(0);
  });
});

describe('formatShort', () => {
  test('格式化为 N月N日', () => {
    expect(formatShort('2026-01-05')).toBe('1月5日');
    expect(formatShort('2026-12-31')).toBe('12月31日');
  });
});

describe('todayISOString', () => {
  test('返回今天的 ISO 日期', () => {
    const today = new Date();
    const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    expect(todayISOString()).toBe(expected);
  });
});

describe('getDateNDaysAgo', () => {
  test('n=0 返回今天', () => {
    expect(getDateNDaysAgo(0)).toBe(todayISOString());
  });
  test('n=1 返回昨天', () => {
    expect(getDateNDaysAgo(1)).toBe(addDays(todayISOString(), -1));
  });
});

describe('getLastNDates', () => {
  test('返回 n 天的数组（旧→新）', () => {
    const dates = getLastNDates(3);
    expect(dates).toHaveLength(3);
    // 最旧在前，最新在后
    expect(dates[0]).toBe(addDays(todayISOString(), -2));
    expect(dates[1]).toBe(addDays(todayISOString(), -1));
    expect(dates[2]).toBe(todayISOString());
  });
  test('n=1 只返回今天', () => {
    expect(getLastNDates(1)).toEqual([todayISOString()]);
  });
});
