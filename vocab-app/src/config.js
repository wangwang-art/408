// 音频缓存目录名
export const AUDIO_CACHE_DIR = 'audio';

// 可用词本标签列表（与 src/data/wordbooks/ 下的 JSON 文件名对应）
export const AVAILABLE_BOOKS = ['cet4', 'cet6', 'ielts'];

// 词本标签显示名称映射
export const BOOK_LABELS = {
  cet4: 'CET-4',
  cet6: 'CET-6',
  ielts: 'IELTS',
};

// SM-2 算法参数
export const SM2_DEFAULT_EF = 2.5;
export const SM2_MIN_EF = 1.3;

// 每日学习配额
export const DAILY_NEW_LIMIT = 20; // 每天最多学习的新词数
export const DAILY_REVIEW_LIMIT = 100; // 每天最多复习的到期词数

// 困难词阈值：连续/累计失败次数达到该值即视为困难词（每天复习直到学会）
// 此前硬编码在 VocabManager 内部，现提取到配置便于统一调整
export const HARD_WORD_THRESHOLD = 2;

// 会话内重试上限：没记住的词本轮最多再出现多少次（避免无限循环）
// 此前硬编码在 ReviewScreen 内部，现提取到配置
export const MAX_RETRY_PER_SESSION = 2;

// ---------- 例句抓取配置（爬取后缓存机制） ----------
// 数据源：有道词典 JSON 接口（与在线例句/发音同源，返回完整释义 + 双语例句）
// 每次抓取后写入本地 word_cache 表，之后一律读缓存，避免重复请求
export const youdaoJsonUrl = (word) =>
  `https://dict.youdao.com/jsonapi_s?doctype=json&jsonversion=4&q=${encodeURIComponent(word)}`;

export const CRAWLER = {
  // 每个词最多缓存多少个例句（随机选取展示用）
  MAX_EXAMPLES: 5,
  // 后台批量抓取并发数（与音频下载类似，避免瞬间打满带宽）
  CONCURRENCY: 4,
  // 单次抓取超时（毫秒）
  REQUEST_TIMEOUT: 8000,
};

// ---------- settings 表 key 命名空间约定 ----------
// 所有写入 settings 表的 key 都应带词本维度，避免不同词本互相覆盖。
// 旧版本 daily_new_limit / daily_review_limit 未带 bookTag，启动时由迁移逻辑读取并改写。
// @see StorageService.migrateLegacySettings
export const SETTING_KEY = {
  // 每日新词配额（按词本）
  dailyNewLimit: (bookTag) => `daily_new_limit_${bookTag}`,
  // 每日复习配额（按词本）
  dailyReviewLimit: (bookTag) => `daily_review_limit_${bookTag}`,
  // 发音是否已完整下载过（按词本，避免回前台反复全量重扫）
  audioDone: (bookTag) => `audio_done_${bookTag}`,
};
