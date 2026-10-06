// SrsScheduler 单元测试 —— SM-2 间隔重复算法
// 运行方式：npm test
//
// 测试策略：
// - mock dateHelper 使日期可预测（todayISOString 固定为 2026-01-15）
// - 验证算法核心逻辑：EF 更新、间隔计算、重复次数、遗忘重置
// - 不测 next_review 的绝对日期，而测 next_review = last_review + interval 的关系

// mock dateHelper：固定"今天"为 2026-01-15，addDays 做真实日期运算
jest.mock('../src/utils/dateHelper', () => ({
  todayISOString: () => '2026-01-15',
  addDays: (iso, n) => {
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + n);
    const yy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  },
}));

const { mapRatingToQ, calculate } = require('../src/services/SrsScheduler');
const { todayISOString, addDays } = require('../src/utils/dateHelper');

describe('mapRatingToQ', () => {
  // 评分 → SM-2 质量等级映射
  test('评分 1（忘记）映射为 q=0', () => {
    expect(mapRatingToQ(1)).toBe(0);
  });
  test('评分 2（困难）映射为 q=1', () => {
    expect(mapRatingToQ(2)).toBe(1);
  });
  test('评分 3（模糊）映射为 q=3', () => {
    expect(mapRatingToQ(3)).toBe(3);
  });
  test('评分 4（顺利）映射为 q=4', () => {
    expect(mapRatingToQ(4)).toBe(4);
  });
  test('评分 5（简单）映射为 q=5', () => {
    expect(mapRatingToQ(5)).toBe(5);
  });
  test('非法评分按失败处理（q=0）', () => {
    expect(mapRatingToQ(0)).toBe(0);
    expect(mapRatingToQ(6)).toBe(0);
    expect(mapRatingToQ(-1)).toBe(0);
  });
});

describe('calculate — 首次复习', () => {
  test('首次复习评 5 分：interval=1, repetitions=1, EF 略升', () => {
    const result = calculate(null, 5);
    expect(result.interval).toBe(1);
    expect(result.repetitions).toBe(1);
    // q=5 时 EF' = 2.5 + (0.1 - 0*...) = 2.6
    expect(result.ef).toBeCloseTo(2.6, 5);
    expect(result.last_review).toBe('2026-01-15');
    expect(result.next_review).toBe(addDays('2026-01-15', 1));
  });

  test('首次复习评 1 分：interval=0, repetitions=0, next_review=今天（遗忘后当天可再次学习）', () => {
    const result = calculate(null, 1);
    expect(result.interval).toBe(0);
    expect(result.repetitions).toBe(0);
    // q=0 时 EF' = 2.5 + (0.1 - 5*(0.08+5*0.02)) = 2.5 + (0.1 - 0.9) = 1.7
    expect(result.ef).toBeCloseTo(1.7, 5);
    // 遗忘词当天即到期，配合队列"未学会不排除"逻辑，重复直到学会
    expect(result.next_review).toBe('2026-01-15');
  });
});

describe('calculate — 连续成功复习', () => {
  test('第二次成功复习：repetitions=1 → interval=6', () => {
    const progress = { ef: 2.6, interval: 1, repetitions: 1 };
    const result = calculate(progress, 5);
    expect(result.repetitions).toBe(2);
    expect(result.interval).toBe(6);
  });

  test('第三次成功复习：interval = round(prev_interval * EF)', () => {
    const progress = { ef: 2.6, interval: 6, repetitions: 2 };
    const result = calculate(progress, 5);
    expect(result.repetitions).toBe(3);
    expect(result.interval).toBe(Math.round(6 * result.ef));
  });
});

describe('calculate — 遗忘重置', () => {
  test('复习中评 1 分：repetitions 归零, interval=0（当天再次出现直到学会）', () => {
    const progress = { ef: 2.6, interval: 6, repetitions: 2 };
    const result = calculate(progress, 1);
    expect(result.repetitions).toBe(0);
    expect(result.interval).toBe(0);
    expect(result.next_review).toBe(result.last_review);
  });

  test('遗忘后 EF 下降但不低于 1.3', () => {
    // 连续多次低分，EF 应逐步逼近下限 1.3
    let progress = { ef: 2.5, interval: 1, repetitions: 0 };
    for (let i = 0; i < 10; i++) {
      progress = calculate(progress, 1);
    }
    expect(progress.ef).toBeGreaterThanOrEqual(1.3);
  });
});

describe('calculate — 日期一致性', () => {
  test('next_review = last_review + interval 天', () => {
    const result = calculate({ ef: 2.5, interval: 6, repetitions: 2 }, 5);
    expect(result.next_review).toBe(addDays(result.last_review, result.interval));
  });

  test('last_review 始终为今天', () => {
    const result = calculate(null, 3);
    expect(result.last_review).toBe(todayISOString());
  });
});
