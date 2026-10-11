/* DB 层：schema 版本与迁移
 * 机制：td:meta 记录 schemaVersion；启动时低于当前版本就按迁移表依次执行；
 *       迁移函数必须幂等、不污染入参；执行完写回版本号。
 * 第一版只有版本号 1，迁移表为空但机制保留。 */
(function (root) {
  'use strict';
  root.TD = root.TD || {};

  root.TD.Migrations = {
    CURRENT: root.TD.Config.SCHEMA_VERSION,

    /* 版本号 → 迁移函数（把数据从 version-1 迁到 version）。示例：
     * 2: async function () { /* v1→v2：给记录补 updatedAt *\/ ... } */
    table: {},

    async run() {
      var KEYS = root.TD.Config.KEYS;
      var meta = await root.TD.Storage.get(KEYS.meta, null);
      var v = (meta && typeof meta.schemaVersion === 'number') ? meta.schemaVersion : 0;

      if (v > this.CURRENT) {
        /* 数据来自更新版本（例如换过设备/回滚安装），拒绝降级以免损坏 */
        console.warn('[Migrations] 数据版本 v' + v + ' 高于应用版本 v' + this.CURRENT + '，跳过迁移');
        return v;
      }

      while (v < this.CURRENT) {
        var next = v + 1;
        var fn = this.table[next];
        if (typeof fn === 'function') {
          await fn(); /* 迁移函数自己读写 Storage，必须幂等 */
        }
        await root.TD.Storage.set(KEYS.meta, { schemaVersion: next });
        v = next;
      }
      return v;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
