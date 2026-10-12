/* UI 层：hash 路由器（文档第二章：统一路由层；二轮优化：并发合并 + 生命周期对齐）
 * - 跳转压历史，首次进入 replace（返回键不回空白页、不直接退出）
 * - 方向标记：前进/后退决定切换动效方向
 * - 动画期间新导航只保留最后一次目标（合并，不排队不叠加）
 * - 清理由 animationend 驱动、定时器兜底；每次切页移除所有非当前视图
 * - 页面生命周期令牌：TD._pageToken，页面 await 后自查，离开即失效
 * - 输入锁定 body 级（连底部导航），异常时必解锁 */
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
    animating: false,
    dirty: false        /* 动画期间 hash 又变了 → 结束后按实时 hash 对账渲染 */
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

  function lock() { document.body.classList.add('page-locked'); state.animating = true; }
  function unlock() { document.body.classList.remove('page-locked'); state.animating = false; }

  /** 渲染目标页面（统一入口；动画期间被合并的导航在动画结束后从这里续跑） */
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
      state.current = route;

      /* 旧视图全部标记退出（含此前泄漏的中间层），统一由 finish 移除 */
      var oldViews = [];
      Array.prototype.forEach.call(app.querySelectorAll('.page-view'), function (v) {
        if (v !== view) { v.classList.add('leaving'); oldViews.push(v); }
      });

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

      /* 动效：方向决定进出场；旧页只位移不渐隐（不透视） */
      var dir = state.direction || 'none';
      var animIn = (dir !== 'none') ? (dir === 'back' ? 'anim-back-in' : 'anim-fwd-in') : null;
      var animOut = animIn ? (dir === 'back' ? 'anim-back-out' : 'anim-fwd-out') : null;

      if (animIn) view.classList.add(animIn);
      if (animOut) {
        oldViews.forEach(function (v) { v.classList.add(animOut); });
        lock(); /* 文档 3.5：动画期间锁输入（body 级，含导航） */
      }

      /* 清理：animationend 驱动（文档 3.3），定时器兜底防事件不触发；只执行一次 */
      var finished = false;
      function finish() {
        if (finished) return;
        finished = true;
        Array.prototype.forEach.call(app.querySelectorAll('.page-view.leaving'), function (v) { v.remove(); });
        if (animIn) view.classList.remove(animIn);
        unlock();
        /* 滚动恢复放在动效结束后（文档第四/六章） */
        if (animIn === 'anim-back-in') {
          var top = loadScroll()[route.hash];
          if (typeof top === 'number') view.scrollTop = top;
        }
        /* 合并导航（文档 3.1）：以 location.hash 实时值为准对账，避免快照过期 */
        if (state.dirty) {
          state.dirty = false;
          var live = parseHash(root.location.hash);
          if (!state.current || live.hash !== state.current.hash) render(live);
        }
      }

      if (animOut) {
        view.addEventListener('animationend', finish, { once: true });
        setTimeout(finish, ANIM_MS + 120); /* 兜底：动画事件未触发也能清理 */
      } else {
        finish();
      }
    } catch (err) {
      /* 文档 3.6：渲染异常必须清锁回稳，避免永远锁死 */
      console.error('[router] 渲染失败', err);
      root.TD.Notify.toast('页面加载出错：' + (err && err.message), 'error');
      unlock();
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

    /* 并发合并（文档 3.1）：动画进行中不再渲染，仅记账；结束后按实时 hash 对账续跑 */
    if (state.animating) {
      state.dirty = true;
      return;
    }
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

    state.stack = (stored[stored.length - 1] === route.hash) ? stored : [route.hash];
    saveStack();
    state.current = null;
    state.animating = false;
    state.dirty = false;
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
