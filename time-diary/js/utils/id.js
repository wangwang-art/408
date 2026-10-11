/* 工具层：id 生成（uuid v4，优先原生 crypto） */
(function (root) {
  'use strict';
  root.TD = root.TD || {};

  root.TD.uuid = function uuid() {
    if (root.crypto && typeof root.crypto.randomUUID === 'function') {
      return root.crypto.randomUUID();
    }
    /* 回退实现（RFC 4122 v4） */
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      var v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
