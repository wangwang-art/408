// TTS 语音服务
// 发音策略（按优先级）：
//   1. 本地缓存的词典原声（有道标准美音 mp3，按需下载，完全离线）
//   2. 打包进 APK 的词典原声（部分高频词）
//   3. 系统 TTS 引擎兜底（Android TextToSpeech / iOS AVSpeechSynthesizer）
import { Audio } from 'expo-av';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import * as Speech from 'expo-speech';
import AUDIO_MAP from '../utils/audioAssets';
import { audioPathFor, audioDirFor, ensureAudioDirs } from '../utils/fileHelper';

// 有道词典美音接口（国内直连、标准美音）
const youdaoUrl = (word) =>
  `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=2`;
// 百度翻译美音接口（备用源，有道偶发限流时兜底）
const baiduUrl = (word) =>
  `https://fanyi.baidu.com/gettts?lan=en&text=${encodeURIComponent(word)}&spd=3&source=web`;

// 批量下载并发数
const CONCURRENCY = 6;
// 单个请求超时（毫秒）
const REQUEST_TIMEOUT = 10000;

// 系统 TTS 兜底参数
const SPEECH_RATE = 0.92;
const SPEECH_PITCH = 1.0;
const SPEECH_LANG = 'en';

// 当前播放中的本地声音对象
let soundRef = null;

/** 播放本地音频文件（expo-av） */
async function playFile(uri) {
  try {
    if (soundRef) {
      try {
        await soundRef.unloadAsync();
      } catch (e) {}
      soundRef = null;
    }
    const { sound } = await Audio.Sound.createAsync({ uri });
    soundRef = sound;
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync();
        if (soundRef === sound) soundRef = null;
      }
    });
    await sound.playAsync();
    return true;
  } catch (e) {
    return false;
  }
}

/** 播放打包的词典原声 */
async function playBundledAudio(word) {
  const mod = AUDIO_MAP[word];
  if (!mod) return false;
  try {
    const asset = Asset.fromModule(mod);
    await asset.downloadAsync();
    return await playFile(asset.localUri || asset.uri);
  } catch (e) {
    return false;
  }
}

/**
 * 单词发音是否已缓存
 * @param {string} bookTag 词本
 * @param {string} word 单词
 * @returns {Promise<boolean>}
 */
export async function isAudioCached(bookTag, word) {
  try {
    const info = await FileSystem.getInfoAsync(audioPathFor(bookTag, word));
    return info.exists && info.size > 500;
  } catch (e) {
    return false;
  }
}

/** 带超时的 Promise */
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

/**
 * 下载单个单词的美音到本地缓存（有道优先，失败回退百度，每源一次）
 * @param {string} bookTag
 * @param {string} word
 * @returns {Promise<boolean>} 是否成功（已缓存也算成功）
 */
export async function downloadWordAudio(bookTag, word) {
  const path = audioPathFor(bookTag, word);
  try {
    const existing = await FileSystem.getInfoAsync(path);
    if (existing.exists && existing.size > 500) return true;
  } catch (e) {}

  // 两个源各尝试一次，成功后立即返回
  const sources = [youdaoUrl, baiduUrl];
  for (const makeUrl of sources) {
    try {
      const result = await withTimeout(FileSystem.downloadAsync(makeUrl(word), path), REQUEST_TIMEOUT);
      if (result.status === 200) {
        const info = await FileSystem.getInfoAsync(path);
        if (info.exists && info.size > 500) return true;
      }
    } catch (e) {
      // 超时或网络错误，尝试下一个源
    }
  }
  return false;
}

/**
 * 批量下载发音（并发控制，支持取消）
 * 检测已存在的发音文件并直接计入成功数（不重复下载，进度从已有数量起步）；
 * 进度回调携带 processed（已处理）与 succeeded（实际成功数）。
 * @param {Array<{word: string}>} words 单词列表
 * @param {string} bookTag
 * @param {(processed: number, total: number, succeeded: number) => void} onProgress
 * @param {{isCancelled?: () => boolean}} options
 * @returns {Promise<{succeeded: number, failed: number}>}
 */
export async function batchDownload(words, bookTag, onProgress, options = {}) {
  await ensureAudioDirs([bookTag]);
  const total = words.length;
  // 检测已存在的发音文件：直接计入成功数，已下载过的词不再重复下载
  const base = await countCachedAudio(bookTag);
  const queue = [...words];
  let processed = 0;
  let succeeded = base;

  // 首帧即上报已有数量，进度数字从真实位置起步
  if (onProgress) onProgress(processed, total, succeeded);

  const worker = async () => {
    while (queue.length > 0) {
      if (options.isCancelled && options.isCancelled()) return;
      const item = queue.shift();
      const key = item.word.toLowerCase();
      // 已存在则跳过（不计入新增成功数，避免与 base 重复）
      const cached = await isAudioCached(bookTag, key);
      if (!cached) {
        const ok = await downloadWordAudio(bookTag, key);
        if (ok) succeeded += 1;
      }
      processed += 1;
      if (onProgress) onProgress(processed, total, succeeded);
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return { succeeded, failed: Math.max(0, total - succeeded) };
}

/**
 * 统计某词本已缓存的发音数
 * @param {string} bookTag
 * @returns {Promise<number>}
 */
export async function countCachedAudio(bookTag) {
  try {
    const files = await FileSystem.readDirectoryAsync(audioDirFor(bookTag));
    return files.filter((f) => f.endsWith('.mp3')).length;
  } catch (e) {
    return 0;
  }
}

/**
 * 发音：本地缓存原声 → 即时下载原声 → 打包原声 → 系统 TTS
 * @param {string} word
 * @param {string} [bookTag] 词本标签（用于查找/下载本地缓存）
 * @returns {Promise<void>}
 */
export async function speak(word, bookTag) {
  if (!word) return;
  const key = word.toLowerCase().trim();

  // 1. 本地缓存的词典原声（已下载过）
  if (bookTag) {
    const path = audioPathFor(bookTag, key);
    try {
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists && info.size > 500) {
        await playFile(path);
        return;
      }
    } catch (e) {}

    // 2. 未缓存：先即时下载该词（单次请求很快），成功即播放
    const ok = await downloadWordAudio(bookTag, key);
    if (ok) {
      await playFile(path);
      return;
    }
  }

  // 3. 打包进 APK 的原声
  if (await playBundledAudio(key)) return;

  // 4. 系统 TTS 兜底
  try {
    await Speech.speak(word, {
      language: SPEECH_LANG,
      rate: SPEECH_RATE,
      pitch: SPEECH_PITCH,
    });
  } catch (e) {}
}

/**
 * 发音是否可用：任何一层可用即视为就绪
 * @returns {Promise<boolean>}
 */
export async function isTtsAvailable() {
  if (Object.keys(AUDIO_MAP).length > 0) return true;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    return voices.length > 0;
  } catch (e) {
    return false;
  }
}

/**
 * 停止当前朗读
 * @returns {Promise<void>}
 */
export async function stopSpeaking() {
  if (soundRef) {
    try {
      await soundRef.stopAsync();
      await soundRef.unloadAsync();
    } catch (e) {}
    soundRef = null;
  }
  try {
    await Speech.stop();
  } catch (e) {}
}
