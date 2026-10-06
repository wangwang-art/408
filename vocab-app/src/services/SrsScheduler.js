// SM-2 间隔重复算法（SuperMemo 2）
// 算法来源: https://www.supermemo.com/en/blog/application-of-a-computational-model-to-e-learning
// 核心思想：根据每次复习的质量评级 q 动态调整"易度因子"(EF) 与下一次复习间隔。
// 质量评级 q 对应关系: 1->0, 2->1, 3->3, 4->4, 5->5
import { SM2_DEFAULT_EF, SM2_MIN_EF } from '../config';
import { todayISOString, addDays } from '../utils/dateHelper';

/**
 * 将用户评分(1-5)映射为 SM-2 质量等级 q
 * 映射表: 1->0, 2->1, 3->3, 4->4, 5->5
 * @param {number} rating 用户评分 1-5
 * @returns {number} 质量等级 q
 */
export function mapRatingToQ(rating) {
  switch (rating) {
    case 1:
      return 0; // 完全忘记
    case 2:
      return 1; // 答错但勉强想起
    case 3:
      return 3; // 答对但很困难
    case 4:
      return 4; // 答对有些犹豫
    case 5:
      return 5; // 完美回忆
    default:
      return 0; // 非法评分按失败处理
  }
}

/**
 * 计算新的进度参数
 *
 * SM-2 算法规则:
 * 1. 若 q >= 3（成功记忆）:
 *    - repetitions == 0 时 interval = 1（首次学习后 1 天复习）
 *    - repetitions == 1 时 interval = 6（第二次 6 天）
 *    - 之后 interval = round(interval * EF)
 *    - repetitions += 1
 * 2. 若 q < 3（遗忘）: repetitions = 0, interval = 0（当天立即再次出现，
 *    配合队列"未学会词不排除"逻辑，重复直到学会为止）
 * 3. EF 更新公式: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
 *    且 EF 下限为 SM2_MIN_EF (1.3)，防止间隔无限缩短
 * 4. next_review = 今天 + interval 天
 *
 * @param {object|null} progress 当前进度 {ef, interval, repetitions}，首次复习传 null
 * @param {number} rating 用户评分 1-5
 * @returns {{ef: number, interval: number, repetitions: number, next_review: string, last_review: string}}
 */
export function calculate(progress, rating) {
  const q = mapRatingToQ(rating);

  // 读取当前进度（首次复习时使用默认值）
  const ef = progress && progress.ef != null ? progress.ef : SM2_DEFAULT_EF;
  let interval = progress && progress.interval != null ? progress.interval : 0;
  let repetitions = progress && progress.repetitions != null ? progress.repetitions : 0;

  // 更新易度因子 EF（公式来源见文件头），下限 1.3
  const newEf = Math.max(
    SM2_MIN_EF,
    ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  );

  if (q >= 3) {
    // 成功记忆：按复习次数确定间隔
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      // 间隔随 EF 呈指数增长
      interval = Math.round(interval * newEf);
    }
    repetitions += 1;
  } else {
    // 遗忘：重置计数，next_review 设为今天（interval=0），
    // 当天即可在队列中再次出现，重复直到学会（评分 >= 3）
    repetitions = 0;
    interval = 0;
  }

  const last_review = todayISOString();
  const next_review = addDays(last_review, interval);

  return {
    ef: newEf,
    interval,
    repetitions,
    next_review,
    last_review,
  };
}
