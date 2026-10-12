/* 配置层：常量、默认值、路由表（唯一来源，禁止页面散落定义） */
(function (root) {
  'use strict';
  root.TD = root.TD || {};

  root.TD.Config = {
    APP: 'time-diary',
    VERSION: '1.2.3',
    SCHEMA_VERSION: 1,

    /* 存储键：统一前缀，避免同域冲突 */
    KEY_PREFIX: 'td:',
    KEYS: {
      meta: 'td:meta',
      settings: 'td:settings',
      categories: 'td:categories',
      records: 'td:records',
      goals: 'td:goals',
      diaries: 'td:diaries'
    },

    /* 分类色板（与 css/tokens.css 的 .cat-* 保持一致） */
    PALETTE: ['#ff8a7a', '#7fb5d9', '#b9a6e8', '#7bc8a4', '#f2b86b', '#e893b6', '#9aa5b1'],

    /* 心情枚举 */
    MOODS: [
      { key: 'happy', label: '开心' },
      { key: 'calm', label: '平静' },
      { key: 'tired', label: '疲惫' },
      { key: 'anxious', label: '焦虑' },
      { key: 'touched', label: '感动' }
    ],

    /* 目标周期枚举 */
    PERIODS: { daily: '每天', weekdays: '工作日', weekly: '每周', once: '仅一次' },

    /* 目标类型 */
    GOAL_TYPES: { duration: '时长', count: '次数' },

    /* 默认设置 */
    DEFAULT_SETTINGS: { theme: 'light', weekStart: 1, onboarded: false },

    /* 默认分类模板：主键用英文常量 id，禁止用名称/中文当 id */
    DEFAULT_CATEGORIES: [
      { id: 'cat_work', name: '工作', color: '#ff8a7a', sort: 0 },
      { id: 'cat_study', name: '学习', color: '#7fb5d9', sort: 1 },
      { id: 'cat_rest', name: '休息', color: '#b9a6e8', sort: 2 },
      { id: 'cat_play', name: '娱乐', color: '#7bc8a4', sort: 3 },
      { id: 'cat_sport', name: '运动', color: '#f2b86b', sort: 4 },
      { id: 'cat_read', name: '阅读', color: '#e893b6', sort: 5 }
    ],

    /* 路由表：集中定义（多页应用，路径即路由；扩展 SPA 时替换此表实现） */
    ROUTES: {
      onboarding: './onboarding.html',
      timeline: './timeline.html',
      diary: './diary.html',
      recordEdit: './record-edit.html',
      category: './category.html',
      goals: './goals.html',
      goalEdit: './goal-edit.html',
      stats: './stats.html',
      profile: './profile.html'
    },

    /* 底部导航（路由表的子集） */
    NAV_ITEMS: [
      { key: 'timeline', label: '时间轴', icon: 'clock-3' },
      { key: 'stats', label: '统计', icon: 'pie-chart' },
      { key: 'goals', label: '目标', icon: 'target' },
      { key: 'profile', label: '我的', icon: 'user-round' }
    ],

    /* 自动补录：新记录默认开始时间允许回接上一条结束时间的最大间隔 */
    AUTOFILL_GAP_MS: 24 * 60 * 60 * 1000,

    /* AI 洞察（预留接口，默认关闭；启用方式见 js/services/ai.js 头注释。
     * 注意：apiKey 建议将来存设置而非写死在此文件，且严禁提交真实密钥入库） */
    AI: { enabled: false, endpoint: '', model: '', apiKey: '' },

    /* 兜底分类（记录引用了已归档分类时显示） */
    FALLBACK_CATEGORY: { id: '__deleted__', name: '已删除', color: '#9aa5b1' }
  };
})(typeof window !== 'undefined' ? window : globalThis);
