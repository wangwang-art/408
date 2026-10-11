/* 工具层：格式化（时长、钟表、百分比） */
(function (root) {
  'use strict';
  root.TD = root.TD || {};

  root.TD.Format = {
    /** 分钟 → '2小时30分' / '45分' / '2小时'（0 返回 '0分'） */
    duration: function (minutes) {
      var m = Math.max(0, Math.round(minutes));
      var h = Math.floor(m / 60);
      var r = m % 60;
      if (h && r) return h + '小时' + r + '分';
      if (h) return h + '小时';
      return r + '分';
    },

    /** 分钟 → '2h30m'（紧凑，列表用） */
    durationShort: function (minutes) {
      var m = Math.max(0, Math.round(minutes));
      var h = Math.floor(m / 60);
      var r = m % 60;
      if (h && r) return h + 'h' + r + 'm';
      if (h) return h + 'h';
      return r + 'm';
    },

    /** 秒 → 'HH:MM:SS'（计时器用） */
    clock: function (seconds) {
      var s = Math.max(0, Math.floor(seconds));
      var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
      var p = function (n) { return n < 10 ? '0' + n : '' + n; };
      return p(h) + ':' + p(m) + ':' + p(ss);
    },

    /** ts → 'HH:MM-HH:MM' */
    hmRange: function (startTs, endTs) {
      return root.TD.DateUtil.formatHM(startTs) + '-' + root.TD.DateUtil.formatHM(endTs);
    },

    /** 比例 → '75%'（整数百分比，至少 1% 当有进度时） */
    pct: function (ratio) {
      if (!isFinite(ratio) || ratio <= 0) return '0%';
      var p = Math.round(ratio * 100);
      if (p < 1) p = 1;
      if (p > 100) p = 100;
      return p + '%';
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
