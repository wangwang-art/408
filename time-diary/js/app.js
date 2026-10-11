/* 应用入口（唯一）：迁移 → 种子 → 主题 → 视口 → 路由启动
 * SPA 架构：index.html 单页 + hash 路由，页面模板在 js/pages/*.js 的 TD.TPL 中 */
(function (root) {
  'use strict';
  root.TD = root.TD || {};
  root.TD.Pages = root.TD.Pages || {};
  root.TD.TPL = root.TD.TPL || {};
  root.TD.TITLES = {
    onboarding: '时间日记',
    timeline: '时间轴 · 时间日记',
    diary: '写日记 · 时间日记',
    recordEdit: '记录编辑 · 时间日记',
    category: '分类管理 · 时间日记',
    goals: '目标 · 时间日记',
    goalEdit: '目标设置 · 时间日记',
    stats: '统计 · 时间日记',
    profile: '我的 · 时间日记'
  };

  async function boot() {
    /* 1. schema 迁移（必须最先执行） */
    await root.TD.Migrations.run();

    /* 2. 首次种子（幂等） */
    await root.TD.Repo.seedIfEmpty();

    /* 3. 全局设置与主题 */
    var settings = await root.TD.Repo.settings.read();
    root.TD.Theme.apply(settings.theme);

    /* 4. 视口适配（键盘/横竖屏） */
    root.TD.Viewport.init();

    /* 5. 启动路由（首次进入 replace，防返回键回空白页） */
    await root.TD.Router.start(settings);
  }

  root.TD.boot = boot;

  boot().catch(function (err) {
    console.error('[boot] 初始化失败', err);
    if (root.TD.Notify) root.TD.Notify.toast('应用初始化失败：' + (err && err.message), 'error');
  });
})(typeof window !== 'undefined' ? window : globalThis);
