/* Repository 层：业务数据访问接口（上层唯一的数据入口）
 * 按实体分区；统一 id/时间戳维护；分类软删除、记录硬删除。 */
(function (root) {
  'use strict';
  root.TD = root.TD || {};

  var C = root.TD.Config;

  /** 通用 CRUD 工厂（数组存储，按实体一个 key） */
  function crud(key) {
    var S = root.TD.Storage;
    return {
      key: key,
      async list() {
        var arr = await S.get(key, []);
        return Array.isArray(arr) ? arr : [];
      },
      async get(id) {
        var arr = await this.list();
        return arr.find(function (x) { return x.id === id; }) || null;
      },
      /** 新增或更新；自动维护 id/createdAt/updatedAt；返回保存后的实体 */
      async upsert(item) {
        if (!item || typeof item !== 'object') throw new Error('upsert 需要对象');
        var arr = await this.list();
        var now = Date.now();
        if (!item.id) {
          item.id = root.TD.uuid();
          item.createdAt = now;
        }
        item.updatedAt = now;
        var idx = arr.findIndex(function (x) { return x.id === item.id; });
        if (idx >= 0) arr[idx] = item; else arr.push(item);
        await S.set(key, arr);
        return item;
      },
      /** 硬删除 */
      async remove(id) {
        var arr = await this.list();
        var next = arr.filter(function (x) { return x.id !== id; });
        await S.set(key, next);
        return arr.length !== next.length;
      },
      async clear() {
        await S.set(key, []);
      }
    };
  }

  root.TD.Repo = {
    /* ---------- 分类（软删除：archived=true） ---------- */
    categories: Object.assign(crud(C.KEYS.categories), {
      async active() {
        var arr = await this.list();
        return arr
          .filter(function (c) { return !c.archived; })
          .sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
      },
      /** 软删除（保留记录引用的名称/颜色） */
      async archive(id) {
        var c = await this.get(id);
        if (!c) return false;
        c.archived = true;
        return !!(await this.upsert(c));
      }
    }),

    /* ---------- 记录（硬删除；end=null 表示进行中，全局最多一条） ---------- */
    records: Object.assign(crud(C.KEYS.records), {
      async ongoing() {
        var arr = await this.list();
        return arr.find(function (r) { return r.end === null || r.end === undefined; }) || null;
      },
      /** 校验并保存记录；重叠检测排除自身与进行中记录 */
      async saveRecord(input) {
        if (!input.categoryId) throw new Error('请先选择分类');
        if (typeof input.start !== 'number') throw new Error('开始时间无效');
        var rec = {
          id: input.id || null,
          categoryId: input.categoryId,
          start: input.start,
          end: input.end === undefined ? null : input.end,
          note: input.note || ''
        };
        if (rec.end !== null && rec.end <= rec.start) throw new Error('结束时间需晚于开始时间');
        if (rec.end === null && (await this.ongoing()) && !(rec.id && rec.id === (await this.ongoing()).id)) {
          throw new Error('已有进行中的记录，请先结束它');
        }
        var others = (await this.list()).filter(function (r) { return r.id !== rec.id; });
        var clash = others.find(function (r) {
          if (r.end === null) return false;
          return rec.start < r.end && (rec.end === null || r.start < rec.end);
        });
        if (clash) throw new Error('与现有记录时间重叠，请调整时间');
        return this.upsert(rec);
      }
    }),

    /* ---------- 目标 ---------- */
    goals: crud(C.KEYS.goals),

    /* ---------- 日记（按 dateKey 唯一，一天一篇） ---------- */
    diaries: Object.assign(crud(C.KEYS.diaries), {
      async byDateKey(dateKey) {
        var arr = await this.list();
        return arr.find(function (d) { return d.dateKey === dateKey; }) || null;
      },
      async upsertByDate(diary) {
        if (!diary.dateKey) throw new Error('日记缺少日期');
        var exist = await this.byDateKey(diary.dateKey);
        return this.upsert(Object.assign({}, diary, exist && exist.id ? { id: exist.id } : {}));
      }
    }),

    /* ---------- 设置（单对象，合并默认值） ---------- */
    settings: {
      async read() {
        var saved = await root.TD.Storage.get(C.KEYS.settings, {});
        return Object.assign({}, C.DEFAULT_SETTINGS, saved);
      },
      async write(patch) {
        var cur = await this.read();
        var next = Object.assign({}, cur, patch);
        await root.TD.Storage.set(C.KEYS.settings, next);
        return next;
      }
    },

    /* ---------- 首次种子：默认分类 + 元数据（幂等，仅在为空时执行） ---------- */
    async seedIfEmpty() {
      var cats = await this.categories.list();
      if (cats.length === 0) {
        var now = Date.now();
        var seeded = C.DEFAULT_CATEGORIES.map(function (t) {
          return Object.assign({ icon: '', parentId: null, archived: false, createdAt: now, updatedAt: now }, t);
        });
        await root.TD.Storage.set(C.KEYS.categories, seeded);
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
