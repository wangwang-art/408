/* 服务层：导入导出（JSON，带 schema 版本校验）
 * 导出文件结构：{ app, schemaVersion, exportedAt, data: {categories, records, goals, diaries, settings} } */
(function (root) {
  'use strict';
  root.TD = root.TD || {};

  var C;
  function conf() { return C || (C = root.TD.Config); }

  root.TD.Backup = {
    /** 组装导出数据（从 Repository 走，保证与线上数据一致） */
    async build() {
      var R = root.TD.Repo;
      return {
        app: conf().APP,
        schemaVersion: conf().SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        data: {
          categories: await R.categories.list(),
          records: await R.records.list(),
          goals: await R.goals.list(),
          diaries: await R.diaries.list(),
          settings: await R.settings.read()
        }
      };
    },

    async download() {
      var payload = await this.build();
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      var d = new Date();
      var pad = function (n) { return n < 10 ? '0' + n : n; };
      a.href = url;
      a.download = 'time-diary-backup-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    },

    /** 校验导入文本：可独立测试；返回 {ok, payload?, error?} */
    validate(text) {
      var obj;
      try {
        obj = JSON.parse(text);
      } catch (err) {
        return { ok: false, error: '不是合法的 JSON 文件' };
      }
      if (!obj || typeof obj !== 'object') return { ok: false, error: '文件内容为空' };
      if (obj.app !== conf().APP) return { ok: false, error: '不是时间日记的备份文件' };
      if (typeof obj.schemaVersion !== 'number' || obj.schemaVersion < 1) return { ok: false, error: '缺少 schema 版本' };
      if (obj.schemaVersion > conf().SCHEMA_VERSION) return { ok: false, error: '备份来自更新版本的应用，请先升级应用' };
      var d = obj.data;
      if (!d || typeof d !== 'object') return { ok: false, error: '缺少 data 字段' };
      var arrays = ['categories', 'records', 'goals', 'diaries'];
      for (var i = 0; i < arrays.length; i++) {
        if (!Array.isArray(d[arrays[i]])) return { ok: false, error: 'data.' + arrays[i] + ' 应为数组' };
      }
      var bad = d.records.find(function (r) { return !r || typeof r.start !== 'number' || !r.categoryId; });
      if (bad) return { ok: false, error: 'records 中存在缺字段的数据' };
      var badc = d.categories.find(function (c) { return !c || !c.id || !c.name; });
      if (badc) return { ok: false, error: 'categories 中存在缺字段的数据' };
      return { ok: true, payload: obj };
    },

    /** 导入：校验 → 确认覆盖 → 写入 → 重新跑迁移 → 刷新 */
    async importFromText(text) {
      var v = this.validate(text);
      if (!v.ok) throw new Error(v.error);
      var okGo = await root.TD.Notify.confirm('导入备份', '导入将覆盖当前全部数据（分类、记录、目标、日记、设置），确定继续吗？', 'danger');
      if (!okGo) return false;
      var S = root.TD.Storage, KEYS = conf().KEYS, d = v.payload.data;
      await S.set(KEYS.categories, d.categories);
      await S.set(KEYS.records, d.records);
      await S.set(KEYS.goals, d.goals);
      await S.set(KEYS.diaries, d.diaries);
      await S.set(KEYS.settings, Object.assign({}, conf().DEFAULT_SETTINGS, d.settings));
      await S.set(KEYS.meta, { schemaVersion: v.payload.schemaVersion });
      await root.TD.Migrations.run(); /* 旧版本备份补跑迁移 */
      return true;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
