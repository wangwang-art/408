/* 工具层：日期（全部按本地时区，入口统一，页面禁止散落 new Date 计算）
 * 约定：内部一律毫秒时间戳；"天"用 [startOfDay, startOfDay+24h) 左闭右开区间表达，
 *       避免夏令时地区 endOfDay=23:59:59.999 丢毫秒的问题。 */
(function (root) {
  'use strict';
  root.TD = root.TD || {};

  var DAY_MS = 24 * 60 * 60 * 1000;
  var WEEKDAY_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  root.TD.DateUtil = {
    DAY_MS: DAY_MS,

    /** ts → 当天 00:00:00.000（本地时区） */
    startOfDay: function (ts) {
      var d = new Date(ts);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    },

    /** 当天结束（下一毫秒即次日），= startOfDay + DAY_MS */
    endOfDay: function (ts) {
      return this.startOfDay(ts) + DAY_MS;
    },

    /** ts → 'YYYY-MM-DD'（本地时区键，禁止用 toISOString——那是 UTC） */
    dateKey: function (ts) {
      var d = new Date(ts);
      return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    },

    /** 'YYYY-MM-DD' → 当天 00:00 本地 ts；非法（含越界自动进位）返回 null */
    keyToTs: function (key) {
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''));
      if (!m) return null;
      var y = +m[1], mo = +m[2], d = +m[3];
      var t = new Date(y, mo - 1, d).getTime();
      if (isNaN(t)) return null;
      /* Date 会把 13 月/32 日进位到下一周期，回读校验拦截 */
      var back = new Date(t);
      if (back.getFullYear() !== y || back.getMonth() !== mo - 1 || back.getDate() !== d) return null;
      return t;
    },

    /** 同一自然日（本地时区） */
    sameDay: function (a, b) {
      return this.startOfDay(a) === this.startOfDay(b);
    },

    /** dateKey 加减 n 天 → 新 dateKey */
    addDays: function (key, n) {
      var ts = this.keyToTs(key);
      return this.dateKey(ts + n * DAY_MS);
    },

    /** 当周开始（00:00）。weekStart: 0=周日 1=周一 */
    startOfWeek: function (ts, weekStart) {
      var start = this.startOfDay(ts);
      var dow = new Date(start).getDay();
      var diff = (dow - weekStart + 7) % 7;
      return start - diff * DAY_MS;
    },

    /** 当月开始（00:00） */
    startOfMonth: function (ts) {
      var d = new Date(ts);
      return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    },

    /** 当月天数 */
    daysInMonth: function (ts) {
      var d = new Date(ts);
      return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    },

    /** ISO 周数（周一起始），用于"第 N 周"展示 */
    isoWeek: function (ts) {
      var d = new Date(this.startOfDay(ts));
      d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
      var week1 = new Date(d.getFullYear(), 0, 4);
      return 1 + Math.round(((d.getTime() - week1.getTime()) / DAY_MS - 3 + ((week1.getDay() + 6) % 7)) / 7);
    },

    /** ts → 'HH:MM'（本地时区，禁用 getUTCHours） */
    formatHM: function (ts) {
      var d = new Date(ts);
      return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    },

    /** 'HH:MM' → 基于 baseDay 当天的 ts；非法返回 null */
    parseHM: function (hm, baseDayTs) {
      var m = /^(\d{1,2}):(\d{2})$/.exec(String(hm || '').trim());
      if (!m) return null;
      var h = +m[1], mi = +m[2];
      if (h > 23 || mi > 59) return null;
      return this.startOfDay(baseDayTs) + (h * 60 + mi) * 60 * 1000;
    },

    /** 'M月D日 周X' */
    formatCN: function (ts) {
      var d = new Date(ts);
      return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + WEEKDAY_CN[d.getDay()];
    },

    /** 周内第 i 天的 dateKey（基于周开始 ts） */
    weekDayKey: function (weekStartTs, i) {
      return this.dateKey(weekStartTs + i * DAY_MS);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
