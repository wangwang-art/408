/* UI 层：通用组件与导航（纯函数，接收数据返回/挂载 DOM；组件禁止直接读写存储） */
(function (root) {
  'use strict';
  root.TD = root.TD || {};

  root.TD.UI = {
    esc: function (s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    icons: function () {
      /* lucide 对并发/已分离 DOM 会抛 null.setAttribute（文档 3.4），吞掉即可 */
      try {
        if (root.lucide && typeof root.lucide.createIcons === 'function') root.lucide.createIcons();
      } catch (err) {
        console.warn('[icons] 跳过一次图标渲染:', err && err.message);
      }
    },

    /** 页面生命周期令牌：页面 init 开头取 UI.pageToken()，await 后用 UI.still(token) 自查；
     *  路由器每次渲染都会更换令牌，离开本页后 still() 返回 false（文档 3.2/3.4）。 */
    pageToken: function () { return root.TD._pageToken || null; },
    still: function (token) { return root.TD._pageToken === token && token !== null; },

    /** 跳转：统一走路由器（hash + 压历史 + 动效）；路由器未就绪时回退直跳 */
    go: function (routeKey, params) {
      if (root.TD.Router) return root.TD.Router.go(routeKey, params);
      var url = root.TD.Config.ROUTES[routeKey];
      if (!url) throw new Error('未知路由: ' + routeKey);
      root.location.href = url;
    },

    /** 当前路由参数（SPA 走 hash query；node/降级环境走 location.search） */
    query: function () {
      if (root.TD.Router) return root.TD.Router.params;
      var out = {};
      new URLSearchParams(root.location.search).forEach(function (v, k) { out[k] = v; });
      return out;
    },

    /** 渲染底部导航：按路由表填充链接与高亮 */
    renderNav: function (pageKey) {
      var nav = document.querySelector('nav[data-mobile-nav="global"]');
      if (!nav) return;
      var C = root.TD.Config;
      nav.innerHTML = C.NAV_ITEMS.map(function (item) {
        var active = item.key === pageKey;
        var link = root.TD.Router ? root.TD.Router.href(item.key) : C.ROUTES[item.key];
        var cls = 'min-w-0 flex flex-col items-center justify-center gap-0.5 px-1 h-full ' +
          (active ? 'text-[var(--diary-primary)]' : 'text-[var(--diary-muted-foreground)]');
        return '<a href="' + link + '" data-nav-key="' + item.key + '"' +
          (active ? ' data-active="true" aria-current="page"' : '') +
          ' class="' + cls + '"><i data-lucide="' + item.icon + '" class="w-5 h-5 shrink-0"></i>' +
          '<span class="text-[11px] leading-none whitespace-nowrap truncate' + (active ? ' font-medium' : '') + '">' +
          item.label + '</span></a>';
      }).join('');
    },

    /** 绑定返回/关闭按钮：有历史则回退，否则回时间轴 */
    bindBack: function () {
      var self = this;
      document.querySelectorAll('[data-action="back"]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (root.history.length > 1) root.history.back();
          else self.go('timeline');
        });
      });
    },

    /** 静态跳转链接：[data-go="routeKey"] → 填充 hash 路由 href（动态参数由页面自行处理） */
    wireLinks: function () {
      var self = this;
      document.querySelectorAll('a[data-go]').forEach(function (a) {
        var key = a.getAttribute('data-go');
        if (root.TD.Config.ROUTES[key]) {
          a.setAttribute('href', root.TD.Router ? root.TD.Router.href(key) : root.TD.Config.ROUTES[key]);
        }
      });
      document.querySelectorAll('button[data-go]').forEach(function (btn) {
        btn.addEventListener('click', function () { self.go(btn.getAttribute('data-go')); });
      });
    },

    /** 环形占比图（自绘 SVG，不依赖图表库）
     * items: [{color, minutes, ratio}] */
    donut: function (el, items, centerHTML) {
      if (!el) return;
      var size = 224, r = 90, cx = size / 2, cy = size / 2;
      var circ = 2 * Math.PI * r;
      var total = items.reduce(function (s, x) { return s + x.minutes; }, 0);
      var offset = 0;
      var segs = items.filter(function (x) { return x.minutes > 0; }).map(function (x) {
        var frac = total ? x.minutes / total : 0;
        var dash = frac * circ;
        var seg = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + x.color +
          '" stroke-width="30" stroke-dasharray="' + dash + ' ' + (circ - dash) +
          '" stroke-dashoffset="' + (-offset) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')"/>';
        offset += dash;
        return seg;
      }).join('');
      el.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
      el.innerHTML = segs + (centerHTML || '');
    },

    /** 分类查找器：id → 分类实体（含已删除兜底） */
    catFinder: function (categories) {
      var map = {};
      (categories || []).forEach(function (c) { map[c.id] = c; });
      return function (id) { return map[id] || root.TD.Config.FALLBACK_CATEGORY; };
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
