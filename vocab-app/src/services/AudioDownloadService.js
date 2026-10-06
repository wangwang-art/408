// 音频预下载编排服务
// 职责：封装"某词本是否已预下载完 / 标记完成 / 批量下载 + 进度上报 + 取消控制"
// 基于 TtsService（底层单词下载）与 StorageService（完成标记持久化）
// UI 层（HomeScreen）只负责网络检测、弹窗确认、AppState 中断，不再关心下载细节
import * as TtsService from './TtsService';
import * as StorageService from './StorageService';
import VocabManager from './VocabManager';
import { SETTING_KEY } from '../config';

/**
 * 该词本是否已完成过一次完整预下载（持久化标记，重启后仍生效）
 * @param {string} bookTag
 * @returns {Promise<boolean>}
 */
export async function isPreloaded(bookTag) {
  return (await StorageService.getSetting(SETTING_KEY.audioDone(bookTag))) === '1';
}

/**
 * 标记该词本预下载已跑完（无论成败，避免回前台反复全量重扫；失败词播放时自动补下）
 * @param {string} bookTag
 */
export async function markPreloaded(bookTag) {
  await StorageService.setSetting(SETTING_KEY.audioDone(bookTag), '1');
}

/**
 * 统计该词本已缓存的发音数（委托 TtsService）
 * @param {string} bookTag
 * @returns {Promise<number>}
 */
export async function countCached(bookTag) {
  return TtsService.countCachedAudio(bookTag);
}

/**
 * 批量预下载某词本全部单词的发音
 * 内部完成：取词库 → 并发下载（已有文件跳过）→ 标记完成
 * @param {string} bookTag
 * @param {{
 *   onProgress?: (processed: number, total: number, succeeded: number) => void,
 *   isCancelled?: () => boolean
 * }} [opts]
 * @returns {Promise<{succeeded: number, failed: number}>}
 */
export async function preloadBook(bookTag, opts = {}) {
  // 词库来自 VocabManager 单例（静态 JSON 数据，无 IO 开销）
  const wordList = VocabManager.for(bookTag).getWordList();
  const result = await TtsService.batchDownload(wordList, bookTag, opts.onProgress, {
    isCancelled: opts.isCancelled,
  });
  // 无论成败都持久化"已跑完"，避免反复全量重扫（失败词播放时自动补下）
  await markPreloaded(bookTag);
  return result;
}
