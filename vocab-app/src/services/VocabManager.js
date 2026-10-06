// 词汇管理器：面向单个词本的业务门面
// 组合词库数据(getBookWords)、存储(StorageService) 与排程算法(SrsScheduler)，
// 向上层 UI 提供"每日学习/复习队列 / 复习 / 标签 / 熟悉度"等业务能力。
import { getBookWords } from '../data/wordbooks';
import * as StorageService from './StorageService';
import * as SrsScheduler from './SrsScheduler';
import * as ExampleCrawlerService from './ExampleCrawlerService';
import { todayISOString, isBeforeOrEqual } from '../utils/dateHelper';
import {
  DAILY_NEW_LIMIT,
  DAILY_REVIEW_LIMIT,
  HARD_WORD_THRESHOLD,
  SETTING_KEY,
} from '../config';

// 单例缓存：同一 bookTag 复用同一个 VocabManager 实例
// 词库数据是静态的，构造一次即可；避免 UI 多处各自 new 造成重复加载与状态分裂
const instances = new Map();

export default class VocabManager {
  /**
   * @param {string} bookTag 词本标签（如 'cet4'）
   */
  constructor(bookTag) {
    this.bookTag = bookTag;
    // 单词列表为静态词库数据，构造时加载一次
    this.wordList = this.getWordList();
  }

  /**
   * 单例工厂：同一 bookTag 全局返回同一实例
   * UI 层应统一用 VocabManager.for(bookTag) 而非 new VocabManager(bookTag)
   * @param {string} bookTag
   * @returns {VocabManager}
   */
  static for(bookTag) {
    if (!instances.has(bookTag)) {
      instances.set(bookTag, new VocabManager(bookTag));
    }
    return instances.get(bookTag);
  }

  /**
   * 返回该词本全部单词（含释义等完整字段）
   * 单词对象结构: {word, phonetic, meaning, example, pos}
   * @returns {Array<object>}
   */
  getWordList() {
    return getBookWords(this.bookTag);
  }

  /**
   * 读取当前词本生效的每日配额（按词本独立存储，切换词本互不影响）
   * @returns {Promise<{newLimit: number, reviewLimit: number}>}
   */
  async getDailyLimits() {
    const newLimitStr = await StorageService.getSetting(SETTING_KEY.dailyNewLimit(this.bookTag));
    const reviewLimitStr = await StorageService.getSetting(
      SETTING_KEY.dailyReviewLimit(this.bookTag)
    );
    const newLimit = newLimitStr ? parseInt(newLimitStr, 10) : DAILY_NEW_LIMIT;
    const reviewLimit = reviewLimitStr ? parseInt(reviewLimitStr, 10) : DAILY_REVIEW_LIMIT;
    return {
      newLimit: Number.isFinite(newLimit) && newLimit > 0 ? newLimit : DAILY_NEW_LIMIT,
      reviewLimit:
        Number.isFinite(reviewLimit) && reviewLimit > 0 ? reviewLimit : DAILY_REVIEW_LIMIT,
    };
  }

  /**
   * 保存当前词本的每日配额（仅写入当前词本的命名空间 key）
   * @param {{newLimit?: number, reviewLimit?: number}} limits
   */
  async setDailyLimits({ newLimit, reviewLimit } = {}) {
    if (newLimit != null && newLimit > 0) {
      await StorageService.setSetting(SETTING_KEY.dailyNewLimit(this.bookTag), String(newLimit));
    }
    if (reviewLimit != null && reviewLimit > 0) {
      await StorageService.setSetting(
        SETTING_KEY.dailyReviewLimit(this.bookTag),
        String(reviewLimit)
      );
    }
  }

  /**
   * 今日已学单词集合（复习日志中 reviewed_at 为今天的 word 去重）
   * @returns {Promise<Set<string>>}
   */
  async getTodayLearnedSet() {
    const logs = await StorageService.getReviewLogs(this.bookTag);
    return new Set(logs.filter((l) => l.reviewed_at === todayISOString()).map((l) => l.word));
  }

  /**
   * 今日每词的最后评分（review_log 升序遍历，后者覆盖前者）
   * 用于判断"是否已学会"：最后评分 >= 3 视为学会，<= 2 视为未学会
   * @returns {Promise<Map<string, number>>}
   */
  async getTodayLastRatings() {
    const logs = await StorageService.getReviewLogs(this.bookTag);
    const map = new Map();
    for (const l of logs) {
      if (l.reviewed_at === todayISOString()) {
        map.set(l.word, l.rating);
      }
    }
    return map;
  }

  /**
   * 今日新词队列（未学过的词，受 daily_new_limit 限制，已学过的当天不重复）
   * 队列 = [今日未学会词（最后评分 <= 2，无视名额，反复出现直到学会）]
   *      + [从未学过的词（按剩余名额）]
   * @returns {Promise<{queue: Array<object>, total: number, limit: number, learned: number}>}
   */
  async getNewQueue() {
    const rows = await StorageService.loadProgress(this.bookTag);
    const progressMap = new Map(rows.map((r) => [r.word, r]));
    const { newLimit } = await this.getDailyLimits();
    const todayLearned = await this.getTodayLearnedSet();
    const lastRatings = await this.getTodayLastRatings();
    // 今日已学的新词数（review_log 中 is_new=1 的今日记录）
    const { learnedNew } = await StorageService.getTodayStats(this.bookTag);

    // 从未学过的词（无 progress 行）
    const neverLearned = this.wordList
      .filter((w) => !progressMap.has(w.word))
      .sort((a, b) => (a.word < b.word ? -1 : a.word > b.word ? 1 : 0));
    // 今日学过但未学会的词（最后评分 <= 2）：无视名额，优先反复出现直到学会
    const unmastered = this.wordList
      .filter((w) => lastRatings.get(w.word) != null && lastRatings.get(w.word) <= 2)
      .sort((a, b) => (a.word < b.word ? -1 : a.word > b.word ? 1 : 0));
    // 今日剩余名额 = 限额 - 今日已学；从未学过的候选（去掉今天已学过的）
    const remaining = Math.max(0, newLimit - learnedNew);
    const freshQueue = neverLearned
      .filter((w) => !todayLearned.has(w.word))
      .slice(0, remaining);

    const queue = [...unmastered, ...freshQueue];

    return {
      queue: queue.map((w) => ({ ...w, progress: progressMap.get(w.word) || null })),
      total: neverLearned.length, // 全部未学新词（含今日已学的）
      limit: newLimit,
      learned: Math.min(newLimit, learnedNew), // 今日已学新词数
    };
  }

  /**
   * 今日复习队列（受 daily_review_limit 限制）
   * - 困难词（hard_count >= 2，多次没记住）：无视排程日期，每天都出现，且排在最前，直到学会（评分 >= 3）清零
   * - 普通到期词：按 SM-2 next_review 判断是否到期（遗忘词 next_review=今天，当天可再次出现）
   * - 已学会的词（今日最后评分 >= 3）不重复出现；未学会的词继续出现直到学会
   * @returns {Promise<{queue: Array<object>, total: number, limit: number, learned: number}>}
   */
  async getReviewQueue() {
    const rows = await StorageService.loadProgress(this.bookTag);
    const progressMap = new Map(rows.map((r) => [r.word, r]));
    const { reviewLimit } = await this.getDailyLimits();
    const today = todayISOString();
    const lastRatings = await this.getTodayLastRatings();
    // 今日已学会的词（最后评分 >= 3）：不再重复出现
    const masteredToday = new Set(
      [...lastRatings.entries()].filter(([, r]) => r >= 3).map(([w]) => w)
    );
    // 今日已复习数（review_log 中 is_new=0 的今日记录，按词去重）
    const { learnedReview } = await StorageService.getTodayStats(this.bookTag);

    const dueReviews = [];
    const hardWords = [];
    for (const w of this.wordList) {
      const p = progressMap.get(w.word);
      if (!p || !p.next_review) continue;
      const hardCount = p.hard_count || 0;
      if (hardCount >= HARD_WORD_THRESHOLD) {
        // 困难词：无视排程，每天出现
        hardWords.push(w);
      } else if (isBeforeOrEqual(p.next_review, today)) {
        // 普通到期词（含遗忘词：next_review=今天）
        dueReviews.push(w);
      }
    }
    dueReviews.sort((a, b) => (a.word < b.word ? -1 : a.word > b.word ? 1 : 0));
    hardWords.sort((a, b) => (a.word < b.word ? -1 : a.word > b.word ? 1 : 0));

    // 今日剩余名额 = 限额 - 今日已复习；候选 = 困难词优先 + 普通到期词
    // 只排除"已学会"的词，未学会的当天仍会出现，直到学会
    const remaining = Math.max(0, reviewLimit - learnedReview);
    const hardQueue = hardWords.filter((w) => !masteredToday.has(w.word));
    const normalQueue = dueReviews.filter((w) => !masteredToday.has(w.word));
    const queue = [...hardQueue, ...normalQueue].slice(0, remaining);

    return {
      queue: queue.map((w) => ({ ...w, progress: progressMap.get(w.word) || null })),
      total: hardWords.length + dueReviews.length, // 全部待复习（含今日已复习的）
      limit: reviewLimit,
      learned: Math.min(reviewLimit, learnedReview), // 今日已复习数
    };
  }

  /**
   * 获取该词本所有单词的学习状态（含进度与自定义标签）
   * @returns {Promise<Array<object>>} 每项 {word, phonetic, meaning, example, pos, progress, tags}
   */
  async getAllProgress() {
    const rows = await StorageService.loadProgress(this.bookTag);
    const progressMap = new Map(rows.map((r) => [r.word, r]));

    const result = [];
    for (const w of this.wordList) {
      const p = progressMap.get(w.word) || null;
      // 仅在存在进度行时才查询其标签，避免无谓的数据库访问
      const tags = p ? await StorageService.getTags(p.id) : [];
      result.push({ ...w, progress: p, tags });
    }
    return result;
  }

  /**
   * 查询单个单词的进度行
   * @param {string} word
   * @returns {Promise<object|null>}
   */
  async getProgress(word) {
    return StorageService.getProgress(this.bookTag, word);
  }

  /**
   * 该词本全部复习日志（按时间升序）
   * 门面方法：UI 层（首页打卡、统计页）无需直接 import StorageService
   * @returns {Promise<Array<{word: string, rating: number, reviewed_at: string, is_new: number}>>}
   */
  async getReviewLogs() {
    return StorageService.getReviewLogs(this.bookTag);
  }

  /**
   * 该词本全部进度行（轻量读取，不附带标签）
   * 统计页计算熟悉度分布等只需原始 progress 行，无需逐词查标签
   * @returns {Promise<Array<object>>}
   */
  async getProgressRows() {
    return StorageService.loadProgress(this.bookTag);
  }

  /**
   * 查询单个单词的全部复习历史（按时间倒序，最新在前）
   * @param {string} word
   * @returns {Promise<Array<{id: number, rating: number, reviewed_at: string, is_new: number}>>}
   */
  async getWordReviewLogs(word) {
    return StorageService.getWordReviewLogs(this.bookTag, word);
  }

  /**
   * 完成一次复习：SM-2 计算新进度并落库，同时写入复习日志
   * - 首次学习的单词（无进度行）会标记为 is_new，用于区分"学习"与"复习"
   * - 维护 hard_count 困难计数：评分 <= 2（没记住）+1，评分 >= 3（记住）清零；
   *   达到阈值后该词每天在复习队列出现，直到学会
   * @param {string} word
   * @param {number} rating 评分 1-5
   */
  async updateReview(word, rating) {
    const current = await this.getProgress(word);
    const isNew = !current; // 无进度行 => 首次学习（新词）
    const next = SrsScheduler.calculate(current, rating);
    // 困难计数：没记住累加，记住清零
    const currentHard = current && current.hard_count != null ? current.hard_count : 0;
    const hardCount = rating <= 2 ? currentHard + 1 : 0;
    await StorageService.updateProgress(this.bookTag, word, { ...next, hard_count: hardCount });
    await StorageService.insertReviewLog(this.bookTag, word, rating, isNew);
  }

  /**
   * 为单词添加自定义标签
   * 需要 progress 行 id；若无进度行则先创建一行默认进度（default: ef 2.5 / interval 0 / repetitions 0）
   * @param {string} word
   * @param {string} tag
   */
  async addTagForWord(word, tag) {
    // updateProgress 无论插入还是更新都会返回该 progress 行的 id
    const wordId = await StorageService.updateProgress(this.bookTag, word, {});
    await StorageService.addTag(wordId, tag);
  }

  /**
   * 移除单词的自定义标签
   * @param {string} word
   * @param {string} tag
   */
  async removeTagForWord(word, tag) {
    const p = await this.getProgress(word);
    if (p) {
      await StorageService.removeTag(p.id, tag);
    }
  }

  /**
   * 获取单词的自定义标签列表
   * @param {string} word
   * @returns {Promise<string[]>}
   */
  async getWordTags(word) {
    const p = await this.getProgress(word);
    return p ? StorageService.getTags(p.id) : [];
  }

  /**
   * 手动调整单词熟悉度（不参与 SM-2 排程）
   * 规则: repetitions = rating - 1；interval = max(1, 当前 interval)；ef 不变；next_review 保留不变
   * @param {string} word
   * @param {number} rating 熟悉度 1-5
   */
  async setFamiliarity(word, rating) {
    const current = await this.getProgress(word);
    const repetitions = rating - 1; // 熟悉度 1-5 映射为重复次数 0-4
    // 间隔保持不小于 1 天；updateProgress 为合并语义，未传的 ef / next_review 字段原样保留
    const interval = Math.max(1, current && current.interval != null ? current.interval : 1);
    await StorageService.updateProgress(this.bookTag, word, {
      repetitions,
      interval,
    });
  }

  /**
   * 重置单词学习进度（同时删除其自定义标签）
   * @param {string} word
   */
  async resetProgress(word) {
    await StorageService.deleteProgress(this.bookTag, word);
  }

  /**
   * 批量读取单词的例句/释义缓存（只读本地，不发网络请求）
   * UI 层首屏渲染用：已缓存词立即展示完整释义与例句，未缓存词先回退词库数据
   * @param {string[]} words
   * @returns {Promise<Object<string, {meaning: string, examples: Array<{en, zh}>}>>}
   */
  async getCachedWordInfos(words) {
    return ExampleCrawlerService.readCachedInfos(words);
  }

  /**
   * 获取单个单词的完整信息（缓存优先，未命中则抓取并缓存）
   * @param {string} word
   * @returns {Promise<{meaning: string, examples: Array<{en, zh}>}|null>}
   */
  async getWordInfo(word) {
    return ExampleCrawlerService.getWordInfo(word);
  }

  /**
   * 批量补齐单词的例句/释义缓存（只抓取未缓存的词，后台并发执行）
   * 学习/复习队列加载后调用，补齐完成后再把结果合并回卡片展示
   * @param {string[]} words
   * @param {{onProgress?: Function}} [options]
   * @returns {Promise<Object<string, {meaning: string, examples: Array<{en, zh}>}>>}
   */
  async ensureWordInfos(words, options) {
    return ExampleCrawlerService.ensureInfos(words, options);
  }
}
