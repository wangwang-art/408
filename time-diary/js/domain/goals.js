/* 领域层：目标纯逻辑
 * 周期语义：daily/weekdays 以"天"为考核单位；weekly 以"周"为单位；
 * once 以 [startDate, endDate] 为有效期。进度一律从记录实时推导，不落库。 */
(function (root) {
  'use strict';
  root.TD = root.TD || {};
  var D = function () { return root.TD.DateUtil; };

  root.TD.Domain = root.TD.Domain || {};

  root.TD.Domain.goals = {
    /** 目标在"参照日"所属考核区间的 [start, end)（end 可能是 Infinity） */
    periodRange: function (goal, dayTs, weekStart) {
      var DU = D();
      if (goal.period === 'weekly') {
        var ws = DU.startOfWeek(dayTs, weekStart);
        return { start: ws, end: ws + 7 * DU.DAY_MS };
      }
      if (goal.period === 'once') {
        var s = goal.startDate || 0;
        var e = goal.endDate ? DU.endOfDay(goal.endDate) : Infinity;
        return { start: s, end: e };
      }
      /* daily / weekdays 都按天考核 */
      return { start: DU.startOfDay(dayTs), end: DU.endOfDay(dayTs) };
    },

    /** 目标是否在参照日"生效"（有效期 + 工作日过滤） */
    isActiveOn: function (goal, dayTs) {
      var DU = D();
      if (goal.startDate && dayTs < DU.startOfDay(goal.startDate)) return false;
      if (goal.endDate && dayTs >= DU.endOfDay(goal.endDate)) return false;
      if (goal.period === 'weekdays') {
        var dow = new Date(dayTs).getDay();
        if (dow === 0 || dow === 6) return false;
      }
      return true;
    },

    /** 折算到每周的目标分钟数（用于"本周累计专注 / N h"分母） */
    weeklyMinutes: function (goal) {
      var t = Number(goal.targetMinutes) || 0;
      if (goal.period === 'daily') return t * 7;
      if (goal.period === 'weekdays') return t * 5;
      if (goal.period === 'weekly') return t;
      return 0; /* once 不折算 */
    },

    /** 进度：{value, target, ratio, done, unit}（unit: 'min' | 'count'） */
    progress: function (goal, records, dayTs, nowTs, weekStart) {
      var range = this.periodRange(goal, dayTs, weekStart);
      var segs = root.TD.Domain.records.segments(records, range.start, range.end === Infinity ? nowTs : range.end, nowTs);
      var mine = segs.filter(function (s) { return s.rec.categoryId === goal.categoryId; });
      if (goal.type === 'count') {
        var value = mine.length;
        var target = Number(goal.targetCount) || 1;
        return { value: value, target: target, ratio: value / target, done: value >= target, unit: 'count' };
      }
      var minutes = mine.reduce(function (s, x) { return s + x.minutes; }, 0);
      var t2 = Number(goal.targetMinutes) || 0;
      return { value: minutes, target: t2, ratio: t2 ? minutes / t2 : 0, done: minutes >= t2 && t2 > 0, unit: 'min' };
    },

    /** 概览（goals 页顶部卡） */
    weekOverview: function (goals, records, dayTs, nowTs, weekStart) {
      var self = this;
      var active = goals.filter(function (g) { return self.isActiveOn(g, dayTs); });
      var achieved = 0;
      var focusTarget = 0;
      active.forEach(function (g) {
        var p = self.progress(g, records, dayTs, nowTs, weekStart);
        if (p.done) achieved++;
        focusTarget += self.weeklyMinutes(g);
      });
      var DU = D();
      var ws = DU.startOfWeek(dayTs, weekStart);
      var segs = root.TD.Domain.records.segments(records, ws, ws + 7 * DU.DAY_MS, nowTs);
      return {
        achieved: achieved,
        total: active.length,
        focusMinutes: segs.reduce(function (s, x) { return s + x.minutes; }, 0),
        focusTarget: focusTarget
      };
    },

    /** 习惯打卡：本周 7 格。done = 当天完成了任一生效中的每日目标；无每日目标时=当天有记录 */
    habitWeek: function (goals, records, dayTs, nowTs, weekStart) {
      var self = this;
      var DU = D();
      var ws = DU.startOfWeek(dayTs, weekStart);
      var todayKey = DU.dateKey(nowTs);
      var dailyGoals = goals.filter(function (g) {
        return (g.period === 'daily' || g.period === 'weekdays') && self.isActiveOn(g, dayTs);
      });
      var cells = [];
      for (var i = 0; i < 7; i++) {
        var dayStart = ws + i * DU.DAY_MS;
        var key = DU.dateKey(dayStart);
        var future = key > todayKey;
        var done = false;
        if (!future) {
          if (dailyGoals.length) {
            done = dailyGoals.some(function (g) {
              return self.progress(g, records, dayStart, Math.min(nowTs, DU.endOfDay(dayStart)), weekStart).done;
            });
          } else {
            done = root.TD.Domain.records.daySegments(records, dayStart, Math.min(nowTs, DU.endOfDay(dayStart))).length > 0;
          }
        }
        cells.push({ key: key, done: done, future: future, isToday: key === todayKey });
      }
      return cells;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
