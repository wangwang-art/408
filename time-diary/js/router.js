/* UI 层：hash 路由器（统一路由层；三轮优化：立即切换 + 仅入场动画）
 * - 跳转压历史，首次进入 replace（返回键不回空白页、不直接退出）
 * - 方向标记：前进/后退决定入场动画方向（前进右入、后退左入）
 * - 即时渲染：旧页立刻移除、新页立刻挂载，无叠层窗口期——快速连点天然安全，
 *   最后一次点击必胜，无输入锁、无排队（二轮的串行退出动画导致点击延迟，已废弃）
 * - 页面生命周期令牌：TD._pageToken，页面 await 后自查，离开即失效
 * - 保留：弹窗压历史（notify）、滚动位置按路由恢复、异常兜底 */
(function (root) {
  'use strict';
  root.TD = root.TD || {};

  var STACK_KEY = 'td:routestack';
  var SCROLL_KEY = 'td:scrollpos';
  var ANIM_MS = 220;

  var state = {
    current: null,      /* 当前路由 {key, params, hash} */
    stack: [],          /* hash 栈（sessionStorage 持久，支持刷新恢复） */
    pending: null,      /* 程序发起跳转的标记：'fwd' | 'replace' */
    direction: 'none'   /* 本次渲染的入场方向：'fwd' | 'back' | 'none' */
  };

  function kebab(key) {
    return String(key).replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); });
  }
  function camel(path) {
    return String(path).replace(/-([a-z])/g, function (m, c) { return c.toUpperCase(); });
  }

  /** 路由键 + 参数 → '#/record-edit?id=xx&date=yy' */
  function href(key, params) {
    var base = '#/' + kebab(key);
    if (params) {
      var qs = Object.keys(params)
        .filter(function (k) { return params[k] !== undefined && params[k] !== null && params[k] !== ''; })
        .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); })
        .join('&');
      if (qs) base += '?' + qs;
    }
    return base;
  }

  function parseHash(hash) {
    var h = String(hash || '').replace(/^#\/?/, '');
    if (!h) h = 'timeline';
    var qi = h.indexOf('?');
    var path = qi >= 0 ? h.slice(0, qi) : h;
    var params = {};
    if (qi >= 0) new URLSearchParams(h.slice(qi + 1)).forEach(function (v, k) { params[k] = v; });
    return { key: camel(path), params: params, hash: '#/' + h };
  }

  function loadStack() {
    try {
      var arr = JSON.parse(root.sessionStorage.getItem(STACK_KEY) || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function saveStack() {
    try { root.sessionStorage.setItem(STACK_KEY, JSON.stringify(state.stack.slice(-60))); } catch (e) { /* 忽略 */ }
  }
  function loadScroll() {
    try { return JSON.parse(root.sessionStorage.getItem(SCROLL_KEY) || '{}'); } catch (e) { return {}; }
  }
  function saveScrollPos(hash, top) {
    try {
      var map = loadScroll();
      map[hash] = Math.round(top);
      root.sessionStorage.setItem(SCROLL_KEY, JSON.stringify(map));
    } catch (e) { /* 忽略 */ }
  }

  /** 渲染目标页面（统一入口；即时切换，仅新页入场动画） */
  function render(route) {
    var app = document.getElementById('app');
    var tpl = root.TD.TPL && root.TD.TPL[route.key];
    if (!tpl) { state.pending = 'replace'; root.location.replace(root.location.pathname + root.location.search + '#/timeline'); return; }

    try {
      var old = app.querySelector('.page-view');
      if (old && state.current) {
        saveScrollPos(state.current.hash, old.scrollTop);
        /* 离开钩子：页面注册的兜底保存（如日记自动保存） */
        if (typeof root.TD._leaveHook === 'function') {
          try { root.TD._leaveHook(); } catch (e) { /* 忽略 */ }
          root.TD._leaveHook = null;
        }
        if (root.TD.Notify) root.TD.Notify._forceClose(); /* 切页时关闭残留弹窗 */
      }

      /* 生命周期令牌：每次渲染换新，旧页 await 后自查失效 */
      var token = {};
      root.TD._pageToken = token;

      var view = document.createElement('div');
      view.className = 'page-view';
      view.innerHTML = tpl;
      app.appendChild(view);
      /* 旧页立即移除（含此前任何残留）：DOM 中永远只有当前页，无叠层、无透视 */
      Array.prototype.forEach.call(app.querySelectorAll('.page-view'), function (v) {
        if (v !== view) v.remove();
      });
      state.current = route;

      root.TD.UI.renderNav(route.key);
      document.title = (root.TD.TITLES && root.TD.TITLES[route.key]) || '时间日记';

      /* 页面初始化（存储读取立刻开始）；init 内部用 UI.still(token) 自查 */
      var pageFn = root.TD.Pages[route.key];
      Promise.resolve()
        .then(function () { return typeof pageFn === 'function' ? pageFn(root.TD._settings) : null; })
        .then(function () {
          if (root.TD._pageToken !== token) return; /* 已离开本页，不再刷图标 */
          root.TD.UI.icons();
          root.TD.UI.bindBack();
          root.TD.UI.wireLinks();
        })
        .catch(function (err) {
          console.error('[router] 页面初始化失败', err);
          root.TD.Notify.toast('页面加载出错：' + (err && err.message), 'error');
        });

      /* 入场动画（仅新页；方向由导航栈决定） */
      var dir = state.direction || 'none';
      var animIn = (dir !== 'none') ? (dir === 'back' ? 'anim-back-in' : 'anim-fwd-in') : null;
      if (animIn) {
        view.classList.add(animIn);
        var finished = false;
        function finish() {
          if (finished) return;
          finished = true;
          view.classList.remove(animIn);
          /* 返回时恢复滚动位置（文档第六章） */
          if (animIn === 'anim-back-in') {
            var top = loadScroll()[route.hash];
            if (typeof top === 'number') view.scrollTop = top;
          }
        }
        view.addEventListener('animationend', finish, { once: true });
        setTimeout(finish, ANIM_MS + 120); /* 兜底：动画事件未触发也能收尾 */
      } else {
        /* 无动画（首次/replace）：滚动恢复直接做 */
        var top0 = loadScroll()[route.hash];
        if (typeof top0 === 'number') view.scrollTop = top0;
      }
    } catch (err) {
      console.error('[router] 渲染失败', err);
      root.TD.Notify.toast('页面加载出错：' + (err && err.message), 'error');
    }
  }

  /** 后退判定：目标 hash 是栈顶下面那个 */
  function isBack(route) {
    return state.stack.length >= 2 && state.stack[state.stack.length - 2] === route.hash;
  }

  function onHashChange() {
    var route = parseHash(root.location.hash);
    if (state.current && route.hash === state.current.hash) return;

    if (state.pending === 'replace') {
      state.pending = null;
      state.direction = 'none';
      state.stack[state.stack.length - 1] = route.hash;
    } else if (state.pending === 'fwd') {
      state.pending = null;
      state.direction = 'fwd';
      state.stack.push(route.hash);
    } else if (isBack(route)) {
      state.stack.pop();
      state.direction = 'back';
    } else {
      state.direction = 'fwd';
      state.stack.push(route.hash);
    }
    saveStack();
    render(route); /* 即时渲染：每次 hashchange 立即生效，最后一次点击必胜 */
  }

  function onPopState(ev) {
    var s = ev.state || {};
    if (s.tdDialog) return; /* 弹窗层历史，由 Notify 处理 */
  }

  /** 程序跳转：压历史（前进入场） */
  function go(key, params) {
    var target = href(key, params);
    if (target === root.location.hash) return;
    state.pending = 'fwd';
    root.location.hash = target;
  }

  /** 替换当前历史（无动画；首次进入/守卫重定向用） */
  function replace(key, params) {
    var target = href(key, params);
    state.pending = 'replace';
    root.location.replace(root.location.pathname + root.location.search + target);
  }

  function back() {
    if (root.history.length > 1) root.history.back();
    else replace('timeline');
  }

  /** 路由器启动：首次进入 replaceState，防返回键回空白页 */
  function start(settings) {
    root.TD._settings = settings;
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('popstate', onPopState);

    var route = parseHash(root.location.hash);
    var stored = loadStack();

    /* 首次引导守卫 */
    if (!settings.onboarded && route.key !== 'onboarding') {
      state.stack = [];
      saveStack();
      replace('onboarding');
      return;
    }

    state.stack = (stored[stored.length - 1] === route.hash) ? stored : [route.hash];
    saveStack();
    state.current = null;
    render(route);
  }

  root.TD.Router = {
    start: start,
    go: go,
    replace: replace,
    back: back,
    href: href,
    parse: parseHash,
    get params() { return state.current ? state.current.params : {}; },
    get current() { return state.current; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
