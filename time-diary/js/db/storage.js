/* DB 层：存储适配器（localStorage 版）
 * 接口全部异步返回 Promise，为将来换 IndexedDB 留路；
 * UI/上层禁止直接调 localStorage，必须经 Repository → 这里。 */
(function (root) {
  'use strict';
  root.TD = root.TD || {};

  function ls() {
    if (typeof localStorage === 'undefined') {
      throw new Error('当前环境不支持 localStorage');
    }
    return localStorage;
  }

  root.TD.Storage = {
    /** 单键读；JSON 损坏时返回 fallback 并清掉坏数据（防白屏） */
    async get(key, fallback) {
      try {
        var raw = ls().getItem(key);
        if (raw === null) return fallback;
        return JSON.parse(raw);
      } catch (err) {
        console.error('[Storage] 读取失败: ' + key, err);
        try { ls().removeItem(key); } catch (_) { /* 忽略 */ }
        return fallback;
      }
    },

    /** 写入；配额超限（约 5MB）或序列化失败时抛错，由调用方提示 */
    async set(key, value) {
      var raw;
      try {
        raw = JSON.stringify(value);
      } catch (err) {
        throw new Error('数据序列化失败：' + (err && err.message));
      }
      try {
        ls().setItem(key, raw);
        return true;
      } catch (err) {
        throw new Error('保存失败：本地存储空间不足或被禁用（上限约 5MB），请先导出备份并清理旧数据');
      }
    },

    async remove(key) {
      try { ls().removeItem(key); } catch (err) { console.error('[Storage] 删除失败: ' + key, err); }
      return true;
    },

    /** 清空本应用全部数据（仅前缀 td: 的键，不动同域其他应用） */
    async clearAll() {
      var prefix = root.TD.Config.KEY_PREFIX;
      var doomed = [];
      for (var i = 0; i < ls().length; i++) {
        var k = ls().key(i);
        if (k && k.indexOf(prefix) === 0) doomed.push(k);
      }
      doomed.forEach(function (k) { ls().removeItem(k); });
      return true;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
