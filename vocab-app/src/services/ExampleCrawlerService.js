// 例句/释义抓取服务（爬取后缓存机制）
//
// 职责：为单词卡片提供"完整释义 + 双语例句"。
// 数据源：有道词典 JSON 接口（youdaoJsonUrl，与在线例句/发音同源）。
//
// 缓存策略（核心约定）：
//   1. 读取一律走缓存优先：命中 word_cache 直接返回，不发网络请求
//   2. 未命中才抓取：成功解析后立即写入 word_cache，下次直接命中
//   3. 抓取失败（无网络/超时/解析失败）静默返回 null，UI 回退词库自带数据
//
// 分层：本服务只依赖 StorageService（数据层）与 utils（纯函数），
// 不 import React，可在测试中直接使用（需 mock StorageService）。
import * as StorageService from './StorageService';
import { CRAWLER, youdaoJsonUrl } from '../config';
import { parseYoudaoResponse } from '../utils/exampleParser';

// 有道接口返回的 JSON 较大（含加密字段），响应头可能不是标准 JSON，
// 这里用 text() 取回原文再 parse，避免依赖 Content-Type 判断
async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CRAWLER.REQUEST_TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json, text/plain, */*',
        Referer: 'https://dict.youdao.com/m/',
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 13) Mobile Safari/537.36',
      },
    });
    if (!res.ok) return null;
    const text = await res.text();
    return JSON.parse(text);
  } catch (e) {
    // 超时 / 网络不可用 / JSON 解析失败：视为抓取失败
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 把 word_cache 行反序列化为服务层使用的结构 */
function deserializeRow(row) {
  if (!row) return null;
  let examples = [];
  try {
    const parsed = JSON.parse(row.examples || '[]');
    if (Array.isArray(parsed)) examples = parsed;
  } catch (e) {
    examples = [];
  }
  return {
    meaning: row.meaning || '',
    examples,
    source: row.source || '',
    fetchedAt: row.fetched_at || '',
  };
}

/**
 * 批量读取缓存（只读，不发网络请求；供 UI 首屏快速渲染）
 * 注意：缓存表主键统一小写存储，这里用小写查询；
 * 返回的 map 同时挂"原始传入词"与"小写键"，上层用原始大小写也能命中
 * （词库含 China/Bible 等大写词，避免每次重新爬取）。
 * @param {string[]} words
 * @returns {Promise<Object<string, {meaning, examples, source, fetchedAt}>>}
 */
export async function readCachedInfos(words) {
  const list = (words || []).map((w) => String(w).toLowerCase().trim()).filter(Boolean);
  const map = {};
  if (list.length === 0) return map;
  const rows = await StorageService.getWordCaches(list);
  for (const row of rows) {
    const info = deserializeRow(row);
    if (!info) continue;
    map[row.word] = info; // 小写键
  }
  // 把原始大小写形式也挂到 map 上（同一缓存数据）
  for (const w of words || []) {
    const key = String(w).toLowerCase().trim();
    if (key && map[key]) map[w] = map[key];
  }
  return map;
}

/**
 * 抓取单个单词并写入缓存
 * 内部先查一次缓存（并发去重兜底），命中直接返回
 * @param {string} word
 * @returns {Promise<{meaning, examples, source, fetchedAt}|null>}
 */
export async function crawlWord(word) {
  const key = String(word || '').toLowerCase().trim();
  if (!key) return null;

  const cached = await readCachedInfos([key]);
  if (cached[key]) return cached[key];

  const json = await fetchJson(youdaoJsonUrl(key));
  // 传查询词做词条匹配校验：若接口返回的是近似词（如 aid -> 字母 x），
  // parseYoudaoResponse 返回 null，不会把错误数据写入缓存
  const parsed = parseYoudaoResponse(json, key);
  if (!parsed) return null;

  const info = {
    meaning: parsed.meaning,
    examples: parsed.examples,
    source: 'youdao',
    fetchedAt: new Date().toISOString(),
  };
  try {
    await StorageService.upsertWordCache(key, info);
  } catch (e) {
    // 缓存写入失败不阻塞本次使用（下次会重新抓取）
  }
  return info;
}

/**
 * 获取单个单词信息：缓存优先，未命中则抓取
 * @param {string} word
 * @returns {Promise<{meaning, examples, source, fetchedAt}|null>}
 */
export async function getWordInfo(word) {
  const key = String(word || '').toLowerCase().trim();
  if (!key) return null;
  const cached = await readCachedInfos([key]);
  return cached[key] || crawlWord(key);
}

/**
 * 批量确保缓存就绪：只抓取未缓存的词（已缓存的直接命中），并发受限
 * 供学习/复习队列后台补齐：返回 word -> info 映射
 * @param {string[]} words
 * @param {{concurrency?: number, onProgress?: (processed: number, total: number) => void}} [options]
 * @returns {Promise<Object<string, {meaning, examples, source, fetchedAt}>>}
 */
export async function ensureInfos(words, options = {}) {
  const list = [...new Set((words || []).map((w) => String(w).toLowerCase().trim()).filter(Boolean))];
  const map = await readCachedInfos(list);
  const missing = list.filter((w) => !map[w]);
  const { concurrency = CRAWLER.CONCURRENCY, onProgress } = options;

  const queue = [...missing];
  let processed = 0;
  if (onProgress) onProgress(0, missing.length);

  const worker = async () => {
    while (queue.length > 0) {
      const word = queue.shift();
      const info = await crawlWord(word); // 内部再查一次缓存，并发场景下不重复抓取
      if (info) map[word] = info;
      processed += 1;
      if (onProgress) onProgress(processed, missing.length);
    }
  };

  // 缺失词为 0 时 worker 数取 1，保证 Promise.all 正常结束
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(concurrency, missing.length)) }, worker)
  );
  return map;
}
