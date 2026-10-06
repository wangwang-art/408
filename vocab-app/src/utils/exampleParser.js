// 例句解析工具（纯函数，无 React Native / 网络依赖，可在 Jest 中直接测试）
// 负责把有道词典 JSON 接口的返回解析为应用内使用的结构：
//   { meaning: string, examples: Array<{en, zh}> }
// 以及例句清洗、随机选句等纯逻辑。
//
// 重要：有道 jsonapi_s 接口对无法精确匹配的词会返回"近似词"的词条
// （实测 aid -> 字母 x 的词条，although -> tip-up 的词条）。
// 因此所有提取都必须传入查询词并校验词条头（return-phrase）与查询词匹配，
// 不匹配时视为该响应不可用（返回空/null），防止错误含义/例句写入缓存。
import { CRAWLER } from '../config';

/**
 * 归一化词头用于比较：小写、去空格/连字符/撇号/点号
 * 如 'X-ray' -> 'xray'，'father-in-law' -> 'fatherinlaw'
 * @param {string} word
 * @returns {string}
 */
export function normalizeHeadword(word) {
  return String(word || '')
    .toLowerCase()
    .replace(/[\s\-'’.,]/g, '');
}

/**
 * 从词条对象中提取词头（return-phrase 字段）
 * 实测两种格式：'bear'（字符串）或 {"l":{"i":"x"}}（对象）
 * @param {object} item ec.word 中的词条
 * @returns {string} 词头（空串表示无法提取）
 */
export function extractHeadword(item) {
  if (!item) return '';
  const rp = item['return-phrase'];
  if (typeof rp === 'string') return rp;
  if (rp && rp.l && typeof rp.l.i === 'string') return rp.l.i;
  if (rp && typeof rp.i === 'string') return rp.i;
  return '';
}

/**
 * 从 ec.word 中取出与查询词匹配的词条
 * ec.word 可能是单对象或数组；返回的可能是近似词的词条（如 aid -> x），
 * 必须按词头匹配过滤，避免取到别的单词。
 * @param {object} json 有道 jsonapi_s 的解析结果
 * @param {string} queryWord 查询词
 * @returns {object|null} 匹配的词条，无匹配返回 null
 */
export function findMatchingEntry(json, queryWord) {
  const ecWord = json && json.ec && json.ec.word;
  if (!ecWord) return null;
  const items = Array.isArray(ecWord) ? ecWord : [ecWord];
  const target = normalizeHeadword(queryWord);
  if (!target) return null;
  for (const item of items) {
    if (normalizeHeadword(extractHeadword(item)) === target) {
      return item;
    }
  }
  return null;
}

/**
 * 清洗例句文本：去掉 <b> 等 HTML 标签、还原常用实体、压缩空白
 * @param {string} text 原始文本（可能含 <b> 高亮标签）
 * @returns {string}
 */
export function cleanSentence(text) {
  if (!text) return '';
  return String(text)
    .replace(/<[^>]+>/g, '') // 去除 <b>/</b> 等标签
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 从匹配词条中提取"完整含义"
 * 真实结构（已实测确认）：
 *   trs[i] = { pos: 'v.', tran: '抛弃，遗弃；放弃…' }   ← 新版为 tran 字符串
 *   旧版可能为 { pos, tr: [{ l: { i: ['放弃'] } }] }    ← 兼容处理
 * @param {object|null} entry 与查询词匹配的词条
 * @returns {string} 多义项拼接的完整释义（如 "v. 抛弃；n. 放任"）
 */
export function extractMeaningFromEntry(entry) {
  if (!entry) return '';
  const trs = (entry && entry.trs) || [];
  const parts = [];
  for (const t of trs) {
    const pos = t && t.pos ? `${t.pos} ` : '';
    // 新版：tran 为整段释义字符串
    if (t && typeof t.tran === 'string' && t.tran.trim()) {
      parts.push(pos + t.tran.trim());
      continue;
    }
    // 旧版兼容：tr 为数组，含义在 tr[].l.i[]
    for (const item of (t && t.tr) || []) {
      for (const i of (item && item.l && item.l.i) || []) {
        if (typeof i === 'string' && i.trim()) {
          parts.push(pos + i.trim());
        }
      }
    }
  }
  // 去重（同一义项可能重复出现），再拼接
  return [...new Set(parts)].join('；');
}

/**
 * 从有道词典 JSON 接口返回中提取"完整含义"（自动校验词条匹配）
 * @param {object} json 有道 jsonapi_s 的解析结果
 * @param {string} queryWord 查询词（用于匹配词条，防止取到近似词）
 * @returns {string} 多义项拼接的完整释义；无匹配词条返回空串
 */
export function extractMeaning(json, queryWord) {
  return extractMeaningFromEntry(findMatchingEntry(json, queryWord));
}

/**
 * 从有道词典 JSON 接口返回中提取双语例句列表
 * 真实结构（已实测确认）：
 *   blng_sents_part['sentence-pair'][i] = {
 *     sentence: 'The captain gave the order to abandon ship.',
 *     'sentence-eng': 'The captain gave the order to <b>abandon</b> ship.',
 *     'sentence-translation': '船长下令弃船。'
 *   }
 * 旧版接口的例句在 blng_sents_part.sentence 下，结构类似，一并兼容。
 * @param {object} json 有道 jsonapi_s 的解析结果
 * @param {string} [queryWord] 查询词（用于校验词条匹配；不传则跳过校验，兼容旧调用）
 * @param {number} [max] 最多保留的例句数（默认取配置 CRAWLER.MAX_EXAMPLES）
 * @returns {Array<{en: string, zh: string}>}
 */
export function extractExamples(json, queryWord, max = CRAWLER.MAX_EXAMPLES) {
  // 若提供了查询词且找不到匹配词条，说明接口返回的是近似词，例句不可信
  if (queryWord && !findMatchingEntry(json, queryWord)) return [];
  const part = json && json.blng_sents_part;
  const list = (part && part['sentence-pair']) || (part && part.sentence) || [];
  const seen = new Set();
  const result = [];
  for (const p of list) {
    const en = cleanSentence(p && (p['sentence-eng'] || p.sentence));
    if (!en || seen.has(en)) continue; // 去重
    seen.add(en);
    result.push({
      en,
      zh: cleanSentence(p && p['sentence-translation']),
    });
    if (result.length >= max) break;
  }
  return result;
}

/**
 * 解析有道词典接口返回为应用内使用的完整信息
 * 必须传入查询词做词条匹配校验：接口返回的若是近似词词条（aid -> x），
 * 直接判定为不可用返回 null，防止错误含义/例句进入缓存。
 * @param {object} json 有道 jsonapi_s 的解析结果
 * @param {string} queryWord 查询词
 * @returns {{meaning: string, examples: Array<{en, zh}>}|null}
 */
export function parseYoudaoResponse(json, queryWord) {
  if (!json || typeof json !== 'object') return null;
  // 找不到与查询词匹配的词条 => 接口返回了近似词，拒绝使用
  const entry = findMatchingEntry(json, queryWord);
  if (!entry) return null;
  const meaning = extractMeaningFromEntry(entry);
  const examples = extractExamples(json, queryWord);
  if (!meaning && examples.length === 0) return null;
  return { meaning, examples };
}

/**
 * 从例句列表中随机选取一条（卡片每次出现随机换句，提升记忆效果）
 * @param {Array<{en, zh}>} examples
 * @returns {{en: string, zh: string}|null}
 */
export function pickRandomExample(examples) {
  if (!Array.isArray(examples) || examples.length === 0) return null;
  return examples[Math.floor(Math.random() * examples.length)];
}
