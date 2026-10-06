// 存储服务：基于 expo-sqlite (SDK 52 异步 API) 封装学习进度持久化
// 使用 SQLite.openDatabaseAsync 打开数据库并缓存 Promise 单例，
// 通过 execAsync / runAsync / getAllAsync / getFirstAsync 执行异步 SQL。
import * as SQLite from 'expo-sqlite';
import { SM2_DEFAULT_EF, AVAILABLE_BOOKS, SETTING_KEY } from '../config';
import { todayISOString } from '../utils/dateHelper';

// 数据库连接 Promise 单例：整个应用共享同一个连接
let dbPromise = null;

/**
 * 获取数据库连接（懒加载 + 缓存）
 * @returns {Promise<SQLite.SQLiteDatabase>}
 */
function getDB() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('vocab.db');
  }
  return dbPromise;
}

// progress 表允许更新的字段白名单（动态拼接 SET 子句时仅允许这些字段，防止注入）
const PROGRESS_FIELDS = [
  'ef',
  'interval',
  'repetitions',
  'next_review',
  'last_review',
  'audio_path',
  'hard_count',
];

/* ============================================================
 * 数据库版本迁移机制
 * ============================================================
 * SQLite 内置 PRAGMA user_version（一个整数）记录当前 schema 版本。
 * 迁移策略：
 * - DB_VERSION = 当前 schema 目标版本号；新增迁移时 +1
 * - migrations 数组按版本号索引：migrations[0] 产生 v1，migrations[1] 产生 v2 …
 * - initDB 读取当前 user_version，依次执行后续迁移，每完成一步立即写回版本号
 * - 每个迁移都写成幂等（可重复执行不报错），这样迁移中途失败下次能安全重试
 *
 * 新增迁移示例：在数组末尾追加一个函数，并 bump DB_VERSION
 *   async (db) => { await db.execAsync('ALTER TABLE ...'); }
 */
const DB_VERSION = 5;

// v1：基础表结构（progress / tags / review_log / settings + 索引）
async function migrate_v1(db) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_tag TEXT NOT NULL,
      word TEXT NOT NULL,
      ef REAL DEFAULT 2.5,
      interval INTEGER DEFAULT 0,
      repetitions INTEGER DEFAULT 0,
      next_review TEXT,
      last_review TEXT,
      audio_path TEXT,
      hard_count INTEGER DEFAULT 0,
      UNIQUE(book_tag, word)
    );
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word_id INTEGER REFERENCES progress(id),
      tag TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS review_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_tag TEXT NOT NULL,
      word TEXT NOT NULL,
      rating INTEGER NOT NULL,
      reviewed_at TEXT NOT NULL,
      is_new INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_review_log ON review_log (book_tag, reviewed_at);
  `);
}

// v2：补列（兼容极早期版本建的表，progress 缺 hard_count / review_log 缺 is_new）
// 用 PRAGMA table_info 先查再补，保证幂等
async function migrate_v2(db) {
  const pCols = await db.getAllAsync('PRAGMA table_info(progress)');
  if (!pCols.some((c) => c.name === 'hard_count')) {
    await db.execAsync('ALTER TABLE progress ADD COLUMN hard_count INTEGER DEFAULT 0');
  }
  const rCols = await db.getAllAsync('PRAGMA table_info(review_log)');
  if (!rCols.some((c) => c.name === 'is_new')) {
    await db.execAsync('ALTER TABLE review_log ADD COLUMN is_new INTEGER DEFAULT 0');
  }
}

// v3：settings key 命名空间迁移
// 旧版 daily_new_limit / daily_review_limit 是全局 key（不带词本），切换词本会互相覆盖配额。
// 此迁移把旧全局值复制到每个词本的独立 key 上（仅当目标 key 不存在时写入，避免覆盖用户已设值），
// 然后删除旧全局 key。详见 config.js 的 SETTING_KEY。
async function migrate_v3(db) {
  const legacy = [
    { oldKey: 'daily_new_limit', newKeyFn: SETTING_KEY.dailyNewLimit },
    { oldKey: 'daily_review_limit', newKeyFn: SETTING_KEY.dailyReviewLimit },
  ];
  for (const { oldKey, newKeyFn } of legacy) {
    const row = await db.getFirstAsync('SELECT value FROM settings WHERE key = ?', oldKey);
    if (!row || row.value == null) continue; // 无遗留值，跳过
    // 把旧值复制到每个词本的独立 key（仅当目标 key 不存在时写入）
    for (const bookTag of AVAILABLE_BOOKS) {
      const newKey = newKeyFn(bookTag);
      const existing = await db.getFirstAsync('SELECT value FROM settings WHERE key = ?', newKey);
      if (!existing) {
        await db.runAsync(
          'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
          newKey,
          row.value
        );
      }
    }
    // 删除旧全局 key（已迁移到按词本维度，不再需要）
    await db.runAsync('DELETE FROM settings WHERE key = ?', oldKey);
  }
}

const migrations = [migrate_v1, migrate_v2, migrate_v3, migrate_v4, migrate_v5];

// v5：清空例句/释义缓存
// 修复有道接口"近似词"问题：旧版本解析器未校验词条头，部分词（如 aid -> 字母 x、
// although -> tip-up）被写入了错误含义与例句。缓存可安全重建（爬取后缓存机制），
// 清空后由 v4 之后的解析器（带词条匹配校验）重新抓取正确数据。
async function migrate_v5(db) {
  await db.execAsync('DELETE FROM word_cache');
}

// v4：例句/释义抓取缓存表（爬取后缓存机制）
// word_cache 全局共享（同一单词在各词本中的释义例句一致，无需按词本隔离）：
//   word        单词（主键，小写）
//   meaning     爬取的完整释义（多义项拼接，如 "v. 抛弃；n. 放任"）
//   examples    双语例句 JSON 字符串：[{en, zh}, ...]
//   source      数据源标识（'youdao'）
//   fetched_at  抓取时间（ISO 字符串，调试/后续过期策略用）
async function migrate_v4(db) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS word_cache (
      word TEXT PRIMARY KEY,
      meaning TEXT,
      examples TEXT,
      source TEXT,
      fetched_at TEXT
    );
  `);
}

/**
 * 初始化数据库：执行迁移直至 DB_VERSION
 * - 读取当前 user_version，依次执行 migrations[当前版本…目标版本)
 * - 每完成一个迁移立即 PRAGMA user_version = v+1，保证中途失败下次能续跑
 * - 幂等：可重复调用；已是最新版本时直接返回
 */
export async function initDB() {
  const db = await getDB();
  const versionRow = await db.getFirstAsync('PRAGMA user_version');
  let current = versionRow ? versionRow.user_version : 0;
  while (current < DB_VERSION) {
    await migrations[current](db);
    current += 1;
    await db.execAsync(`PRAGMA user_version = ${current}`);
  }
}

/**
 * 加载某词本的全部 progress 行
 * @param {string} bookTag
 * @returns {Promise<Array<object>>}
 */
export async function loadProgress(bookTag) {
  const db = await getDB();
  return db.getAllAsync(
    'SELECT * FROM progress WHERE book_tag = ? ORDER BY word',
    bookTag
  );
}

/**
 * 查询单个单词的进度行
 * @param {string} bookTag
 * @param {string} word
 * @returns {Promise<object|null>} 行对象或 null
 */
export async function getProgress(bookTag, word) {
  const db = await getDB();
  return db.getFirstAsync(
    'SELECT * FROM progress WHERE book_tag = ? AND word = ?',
    bookTag,
    word
  );
}

/**
 * 按主键 id 查询进度行
 * @param {number} id
 * @returns {Promise<object|null>}
 */
export async function getProgressById(id) {
  const db = await getDB();
  return db.getFirstAsync('SELECT * FROM progress WHERE id = ?', id);
}

/**
 * 更新（或插入）单词进度 —— upsert 语义
 * 存在则按 newData 提供的字段合并更新；不存在则插入新行（默认 ef=2.5, interval=0, repetitions=0）
 * @param {string} bookTag
 * @param {string} word
 * @param {object} newData {ef?, interval?, repetitions?, next_review?, last_review?, audio_path?} 任意子集
 * @returns {Promise<number>} 该 progress 行的 id（INSERT 时为 lastInsertRowId）
 */
export async function updateProgress(bookTag, word, newData = {}) {
  const db = await getDB();
  const existing = await getProgress(bookTag, word);

  if (existing) {
    // 已有记录：仅更新 newData 中出现的字段
    const fields = PROGRESS_FIELDS.filter((f) => newData[f] !== undefined);
    if (fields.length > 0) {
      const setClause = fields.map((f) => `${f} = ?`).join(', ');
      await db.runAsync(
        `UPDATE progress SET ${setClause} WHERE id = ?`,
        ...fields.map((f) => newData[f]),
        existing.id
      );
    }
    return existing.id;
  }

  // 新记录：默认值 + 合并 newData
  const values = {
    ef: SM2_DEFAULT_EF,
    interval: 0,
    repetitions: 0,
  };
  for (const f of PROGRESS_FIELDS) {
    if (newData[f] !== undefined) {
      values[f] = newData[f];
    }
  }
  const keys = Object.keys(values);
  const placeholders = keys.map(() => '?').join(', ');
  const result = await db.runAsync(
    `INSERT INTO progress (book_tag, word, ${keys.join(', ')}) VALUES (?, ?, ${placeholders})`,
    bookTag,
    word,
    ...keys.map((k) => values[k])
  );
  return result.lastInsertRowId;
}

/**
 * 删除单词进度，同时删除其关联的自定义标签
 * @param {string} bookTag
 * @param {string} word
 */
export async function deleteProgress(bookTag, word) {
  const db = await getDB();
  const row = await getProgress(bookTag, word);
  if (row) {
    await db.runAsync('DELETE FROM tags WHERE word_id = ?', row.id);
    await db.runAsync('DELETE FROM progress WHERE id = ?', row.id);
  }
}

/**
 * 为单词添加自定义标签（重复添加会被忽略）
 * @param {number} wordId progress 行 id
 * @param {string} tag
 */
export async function addTag(wordId, tag) {
  const db = await getDB();
  await db.runAsync(
    'INSERT OR IGNORE INTO tags (word_id, tag) VALUES (?, ?)',
    wordId,
    tag
  );
}

/**
 * 移除单词的自定义标签
 * @param {number} wordId
 * @param {string} tag
 */
export async function removeTag(wordId, tag) {
  const db = await getDB();
  await db.runAsync('DELETE FROM tags WHERE word_id = ? AND tag = ?', wordId, tag);
}

/**
 * 获取单词的全部自定义标签
 * @param {number} wordId
 * @returns {Promise<string[]>}
 */
export async function getTags(wordId) {
  const db = await getDB();
  const rows = await db.getAllAsync(
    'SELECT tag FROM tags WHERE word_id = ? ORDER BY tag',
    wordId
  );
  return rows.map((r) => r.tag);
}

/**
 * 写入一条复习日志（reviewed_at 为今天）
 * @param {string} bookTag
 * @param {string} word
 * @param {number} rating 评分 1-5
 * @param {boolean} isNew 是否为首次学习（新词）
 */
export async function insertReviewLog(bookTag, word, rating, isNew = false) {
  const db = await getDB();
  await db.runAsync(
    'INSERT INTO review_log (book_tag, word, rating, reviewed_at, is_new) VALUES (?, ?, ?, ?, ?)',
    bookTag,
    word,
    rating,
    todayISOString(),
    isNew ? 1 : 0
  );
}

/**
 * 获取某词本全部复习日志（按复习时间升序）
 * @param {string} bookTag
 * @returns {Promise<Array<{word: string, rating: number, reviewed_at: string, is_new: number}>>}
 */
export async function getReviewLogs(bookTag) {
  const db = await getDB();
  return db.getAllAsync(
    'SELECT word, rating, reviewed_at, is_new FROM review_log WHERE book_tag = ? ORDER BY reviewed_at ASC, id ASC',
    bookTag
  );
}

/**
 * 获取某词本今日的学习统计（学习 = 新词，复习 = 旧词；同一词当天重复出现只计一次）
 * @param {string} bookTag
 * @returns {Promise<{learnedNew: number, learnedReview: number, todayWords: string[]}>}
 */
export async function getTodayStats(bookTag) {
  const db = await getDB();
  const rows = await db.getAllAsync(
    'SELECT word, is_new FROM review_log WHERE book_tag = ? AND reviewed_at = ?',
    bookTag,
    todayISOString()
  );
  // 同一词当天可能多次评分（会话内重试），按词去重后统计
  const seen = new Set();
  let learnedNew = 0;
  let learnedReview = 0;
  for (const r of rows) {
    if (seen.has(r.word)) continue;
    seen.add(r.word);
    if (r.is_new === 1) learnedNew += 1;
    else learnedReview += 1;
  }
  return { learnedNew, learnedReview, todayWords: [...seen] };
}

/**
 * 查询单个单词的全部复习历史（按时间倒序，最新在前）
 * @param {string} bookTag
 * @param {string} word
 * @returns {Promise<Array<{id: number, rating: number, reviewed_at: string, is_new: number}>>}
 */
export async function getWordReviewLogs(bookTag, word) {
  const db = await getDB();
  return db.getAllAsync(
    'SELECT id, rating, reviewed_at, is_new FROM review_log WHERE book_tag = ? AND word = ? ORDER BY reviewed_at DESC, id DESC',
    bookTag,
    word
  );
}

/**
 * 读取设置项
 * @param {string} key
 * @returns {Promise<string|null>}
 */
export async function getSetting(key) {
  const db = await getDB();
  const row = await db.getFirstAsync('SELECT value FROM settings WHERE key = ?', key);
  return row ? row.value : null;
}

/**
 * 写入设置项
 * @param {string} key
 * @param {string} value
 */
export async function setSetting(key, value) {
  const db = await getDB();
  await db.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    key,
    String(value)
  );
}

/**
 * 删除设置项（key 不存在时无副作用）
 * @param {string} key
 */
export async function deleteSetting(key) {
  const db = await getDB();
  await db.runAsync('DELETE FROM settings WHERE key = ?', key);
}

/* ============================================================
 * 例句/释义抓取缓存（word_cache 表，v4 引入）
 * 纯 SQL 读写：JSON 序列化/反序列化由 ExampleCrawlerService 负责
 * ============================================================ */

/**
 * 读取单个单词的抓取缓存
 * @param {string} word
 * @returns {Promise<object|null>} {word, meaning, examples, source, fetched_at} 或 null
 */
export async function getWordCache(word) {
  const db = await getDB();
  return db.getFirstAsync('SELECT * FROM word_cache WHERE word = ?', word);
}

/**
 * 批量读取单词抓取缓存（一次 IN 查询，避免 N 次单查）
 * @param {string[]} words
 * @returns {Promise<Array<object>>}
 */
export async function getWordCaches(words) {
  if (!Array.isArray(words) || words.length === 0) return [];
  const db = await getDB();
  const placeholders = words.map(() => '?').join(', ');
  return db.getAllAsync(
    `SELECT * FROM word_cache WHERE word IN (${placeholders})`,
    ...words
  );
}

/**
 * 写入（或覆盖）单词抓取缓存
 * @param {string} word
 * @param {{meaning: string, examples: Array<{en: string, zh: string}>, source: string}} data
 */
export async function upsertWordCache(word, data = {}) {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO word_cache (word, meaning, examples, source, fetched_at)
     VALUES (?, ?, ?, ?, ?)`,
    word,
    data.meaning || '',
    JSON.stringify(data.examples || []),
    data.source || '',
    new Date().toISOString()
  );
}
