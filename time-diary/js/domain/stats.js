/* 领域层：统计纯逻辑（聚合、占比、账本、洞察） */
(function (root) {
  'use strict';
  root.TD = root.TD || {};

  root.TD.Domain = root.TD.Domain || {};

  root.TD.Domain.stats = {
    /** byCategory 结果 + 分类表 → 图例/账本条目（含名称颜色与占比） */
    summarize: function (byCat, categories) {
      var total = byCat.reduce(function (s, x) { return s + x.minutes; }, 0);
      var catMap = {};
      (categories || []).forEach(function (c) { catMap[c.id] = c; });
      return {
        total: total,
        items: byCat.map(function (x) {
          var c = catMap[x.categoryId] || root.TD.Config.FALLBACK_CATEGORY;
          return {
            id: x.categoryId,
            name: c.name,
            color: c.color,
            minutes: x.minutes,
            ratio: total ? x.minutes / total : 0
          };
        })
      };
    },

    /** 时间账本：分类 → 合计 + 当日各段时间文本 */
    ledger: function (segments, categories) {
      var catMap = {};
      (categories || []).forEach(function (c) { catMap[c.id] = c; });
      var DU = root.TD.DateUtil;
      var order = [];
      var map = {};
      segments.forEach(function (seg) {
        var id = seg.rec.categoryId;
        if (!map[id]) {
          map[id] = { id: id, name: (catMap[id] || root.TD.Config.FALLBACK_CATEGORY).name, color: (catMap[id] || root.TD.Config.FALLBACK_CATEGORY).color, minutes: 0, ranges: [] };
          order.push(id);
        }
        map[id].minutes += seg.minutes;
        map[id].ranges.push(DU.formatHM(seg.start) + '-' + (seg.rec.end === null ? 'now' : DU.formatHM(seg.end)));
      });
      return order.map(function (id) { return map[id]; })
        .sort(function (a, b) { return b.minutes - a.minutes; });
    },

    /** 洞察文案（纯推导，不做智能推荐） */
    insights: function (summary, opts) {
      var F = root.TD.Format;
      var out = [];
      var items = summary.items;
      if (!items.length) {
        out.push('还没有记录，去时间轴记下第一笔吧');
        return out;
      }
      var top = items[0];
      out.push(top.name + '占比最高，共 ' + F.duration(top.minutes) + '（' + F.pct(top.ratio) + '）');
      if (items[1]) {
        out.push(items[1].name + '累计 ' + F.duration(items[1].minutes) + '，节奏不错');
      }
      if (opts && opts.ongoingCategoryName) {
        out.push('正在进行：' + opts.ongoingCategoryName + '，记得结束后保存复盘');
      }
      return out;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
