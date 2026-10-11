/* 领域层：记录纯逻辑（不碰存储、不碰 DOM，可被 node 测试）
 * 跨天规则：存储原样（一条记录带绝对起止时间戳），读取时按目标区间裁剪（clamp），
 * 不物理拆条 —— 保证编辑页看到的永远是用户输入的原始时间。 */
(function (root) {
  'use strict';
  root.TD = root.TD || {};
  var D = function () { return root.TD.DateUtil; };

  function clamp(start, end, rangeStart, rangeEnd, nowTs) {
    var s = Math.max(start, rangeStart);
    var e = Math.min(end, rangeEnd);
    if (end === null) e = Math.min(nowTs, rangeEnd); /* 进行中：裁到当前时刻 */
    if (e <= s) return null;
    return { start: s, end: e, minutes: (e - s) / 60000 };
  }

  root.TD.Domain = root.TD.Domain || {};

  root.TD.Domain.records = {
    /** 记录 → 落在 [rangeStart, rangeEnd) 内的片段（按开始时间升序） */
    segments: function (records, rangeStart, rangeEnd, nowTs) {
      var out = [];
      (records || []).forEach(function (r) {
        if (r.start >= rangeEnd) return;
        if (r.end !== null && r.end <= rangeStart) return;
        var seg = clamp(r.start, r.end, rangeStart, rangeEnd, nowTs);
        if (seg) out.push({ rec: r, start: seg.start, end: seg.end, minutes: seg.minutes });
      });
      out.sort(function (a, b) { return a.start - b.start; });
      return out;
    },

    /** 某天的片段（当天 0 点起 24 小时） */
    daySegments: function (records, dayStartTs, nowTs) {
      return this.segments(records, dayStartTs, dayStartTs + D().DAY_MS, nowTs);
    },

    totalMinutes: function (segments) {
      return segments.reduce(function (s, x) { return s + x.minutes; }, 0);
    },

    /** 按分类聚合分钟数，降序 */
    byCategory: function (records, rangeStart, rangeEnd, nowTs) {
      var map = {};
      this.segments(records, rangeStart, rangeEnd, nowTs).forEach(function (seg) {
        var id = seg.rec.categoryId;
        map[id] = (map[id] || 0) + seg.minutes;
      });
      return Object.keys(map)
        .map(function (id) { return { categoryId: id, minutes: map[id] }; })
        .sort(function (a, b) { return b.minutes - a.minutes; });
    },

    /** 时间轴布局：片段之间自动补 gap 块 */
    timelineBlocks: function (records, dayStartTs, nowTs) {
      var segs = this.daySegments(records, dayStartTs, nowTs);
      var blocks = [];
      var cursor = dayStartTs;
      segs.forEach(function (seg) {
        if (seg.start > cursor) {
          blocks.push({ type: 'gap', start: cursor, end: seg.start, minutes: (seg.start - cursor) / 60000 });
        }
        blocks.push({ type: 'block', rec: seg.rec, start: seg.start, end: seg.end, minutes: seg.minutes });
        cursor = seg.end;
      });
      var dayEnd = dayStartTs + D().DAY_MS;
      if (cursor < dayEnd) {
        blocks.push({ type: 'gap', start: cursor, end: dayEnd, minutes: (dayEnd - cursor) / 60000 });
      }
      return blocks;
    },

    /** 最后一条记录的结束时间（自动补录：新记录默认接续） */
    lastEnd: function (records) {
      var max = 0;
      (records || []).forEach(function (r) {
        if (r.end !== null && r.end > max) max = r.end;
      });
      return max;
    },

    /** 有记录（含进行中）的日期键集合 */
    activeDayKeys: function (records) {
      var set = {};
      var DU = D();
      (records || []).forEach(function (r) {
        var s = DU.startOfDay(r.start);
        var e = r.end === null ? DU.startOfDay(Date.now()) : DU.startOfDay(r.end - 1);
        for (var t = s; t <= e; t += DU.DAY_MS) set[DU.dateKey(t)] = true;
      });
      return Object.keys(set);
    },

    /** 连续记录天数（今天或昨天为锚点向前数） */
    streakDays: function (records, nowTs) {
      var DU = D();
      var days = {};
      this.activeDayKeys(records).forEach(function (k) { days[k] = true; });
      var anchor = DU.startOfDay(nowTs);
      if (!days[DU.dateKey(anchor)]) anchor -= DU.DAY_MS; /* 今天没记，从昨天起算 */
      var n = 0;
      while (days[DU.dateKey(anchor)]) {
        n++;
        anchor -= DU.DAY_MS;
      }
      return n;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
