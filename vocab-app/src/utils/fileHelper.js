// 文件系统工具：管理音频缓存目录结构
// 目录结构: {documentDirectory}/audio/{bookTag}/{word}.mp3
import * as FileSystem from 'expo-file-system';
import { AUDIO_CACHE_DIR } from '../config';

/**
 * 音频缓存根目录
 * @returns {string}
 */
export function audioRootDir() {
  return `${FileSystem.documentDirectory}${AUDIO_CACHE_DIR}/`;
}

/**
 * 某个词本的音频目录
 * @param {string} bookTag
 * @returns {string}
 */
export function audioDirFor(bookTag) {
  return `${audioRootDir()}${sanitizeFilename(bookTag)}/`;
}

/**
 * 某个单词的音频文件完整路径
 * @param {string} bookTag
 * @param {string} word
 * @returns {string}
 */
export function audioPathFor(bookTag, word) {
  return `${audioDirFor(bookTag)}${sanitizeFilename(word)}.mp3`;
}

/**
 * 确保音频根目录及各词本子目录存在（已存在时忽略错误）
 * @param {string[]} bookTags 词本标签数组
 */
export async function ensureAudioDirs(bookTags) {
  // 依次创建根目录与每个词本子目录
  const uris = [audioRootDir()];
  for (const tag of bookTags) {
    uris.push(audioDirFor(tag));
  }
  for (const uri of uris) {
    try {
      await FileSystem.makeDirectoryAsync(uri, { intermediates: true });
    } catch (e) {
      // 目录可能已存在或并发创建，忽略即可
    }
  }
}

/**
 * 清理文件名中的非法字符，替换为下划线
 * @param {string} name
 * @returns {string}
 */
export function sanitizeFilename(name) {
  // Windows / Unix 路径中常见的非法字符: / \ : * ? " < > |
  return String(name).replace(/[\\/:*?"<>|]/g, '_');
}
