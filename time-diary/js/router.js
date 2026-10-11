/* UI 层：hash 路由器（文档第二章：统一路由层）
 * - 路由表来自 Config.ROUTES，集中定义
 * - 跳转压历史，首次进入 replace（返回键不回空白页、不直接退出）
 * - 方向标记：前进/后退决定切换动效方向
 * - 返回后滚动位置恢复（动效结束后做，避免跳动）
 * - 弹窗压历史见 services/notify.js */
(function (root) {
  'use strict';
  root.TD = root.TD || {};

  var STACK_KEY = 'td:routestack';
  var SCROLL_KEY = 'td:scrollpos';
  var ANIM_MS = 260;

  var state = {
    current: null,      /* 当前路由 {key, params, hash} */
    stack: [],          /* hash 栈（sessionStorage 持久，支持刷新恢复） */
    pending: null,      /* 程序发起跳转的标记：'fwd' | 'replace' */
    direction: 'none',  /* 本次渲染的动效方向：'fwd' | 'back' | 'none' */
    animating: false
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

  function lock(app) { app.classList.add('page-locked'); state.animating = true; }

  function render(route) {
    var app = document.getElementById('app');
    var tpl = root.TD.TPL && root.TD.TPL[route.key];
    if (!tpl) { state.pending = 'replace'; root.location.replace(root.location.pathname + root.location.search + '#/timeline'); return; }

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

    var view = document.createElement('div');
    view.className = 'page-view';
    view.innerHTML = tpl;
    app.appendChild(view);
    state.current = route;

    /* 页面初始化（存储读取立刻开始，避免动画中内容跳变） */
    var pageFn = root.TD.Pages[route.key];
    Promise.resolve()
      .then(function () { return typeof pageFn === 'function' ? pageFn(root.TD._settings) : null; })
      .then(function () {
        root.TD.UI.icons();
        root.TD.UI.bindBack();
        root.TD.UI.wireLinks();
      })
      .catch(function (err) {
        console.error('[router] 页面初始化失败', err);
        root.TD.Notify.toast('页面加载出错：' + (err && err.message), 'error');
      });

    root.TD.UI.renderNav(route.key);
    document.title = (root.TD.TITLES && root.TD.TITLES[route.key]) || '时间日记';

    /* 方向决定动效（文档第四章：前进右进左出，后退相反） */
    var dir = state.direction || 'none';
    var animIn = (dir !== 'none' && old) ? (dir === 'back' ? 'anim-back-in' : 'anim-fwd-in') : null;
    var animOut = animIn ? (dir === 'back' ? 'anim-back-out' : 'anim-fwd-out') : null;

    if (animOut && old) {
      old.classList.add('leaving', animOut);
      view.classList.add(animIn);
      lock(app);
    } else if (old) {
      old.remove();
    }

    window.setTimeout(function () {
      var leaving = app.querySelector('.page-view.leaving');
      if (leaving) leaving.remove();
      if (animIn) view.classList.remove(animIn);
      app.classList.remove('page-locked');
      state.animating = false;
      /* 滚动恢复放在动效结束后（文档第四/六章） */
      if (animIn === 'anim-back-in') {
        var top = loadScroll()[route.hash];
        if (typeof top === 'number') view.scrollTop = top;
      }
    }, animOut ? ANIM_MS + 30 : 0);
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
      /* 手动改 hash / 浏览器前进等，视为前进 */
      state.direction = 'fwd';
      state.stack.push(route.hash);
    }
    saveStack();
    render(route);
  }

  function onPopState(ev) {
    var s = ev.state || {};
    if (s.tdDialog) return; /* 弹窗层历史，由 Notify 处理 */
  }

  /** 程序跳转：压历史（前进动效） */
  function go(key, params) {
    var target = href(key, params);
    if (target === root.location.hash) return;
    state.pending = 'fwd';
    root.location.hash = target;
  }

  /** 替换当前历史（无动效；首次进入/守卫重定向用） */
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

    if (!root.location.hash || stored[stored.length - 1] !== route.hash) {
      state.stack = [route.hash];
      saveStack();
      state.current = null;
      render(route); /* 无历史栈（新开页/直接带 hash 打开）直接渲染 */
    } else {
      /* 刷新：栈与 hash 一致，只重渲染当前页 */
      state.stack = stored;
      state.current = null;
      render(route);
    }
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
