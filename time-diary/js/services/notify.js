/* 服务层：通知（toast / confirm 对话框）
 * 统一交互入口，页面禁止直接用 alert/confirm —— 便于以后整体换 UI。
 * confirm 压入一条历史：手机返回键/浏览器返回先关弹窗，而不是退出页面（文档第二章）。 */
(function (root) {
  'use strict';
  root.TD = root.TD || {};

  var toastWrap = null;
  var openDialog = null; /* 当前打开的 confirm 弹层 */
  var lastToast = { msg: '', at: 0 }; /* 文档 3.6：同一错误提示只出现一次，不叠加 */

  function ensureWrap() {
    if (!toastWrap || !document.body.contains(toastWrap)) {
      toastWrap = document.createElement('div');
      toastWrap.className = 'td-toast-wrap';
      document.body.appendChild(toastWrap);
    }
    return toastWrap;
  }

  /* 返回键：
   * - 弹窗开着且历史态非弹窗态 → 关弹窗（历史已被系统弹出）
   * - 无弹窗但落在残留弹窗历史态（切页遗留）→ 自动跳过该条 */
  window.addEventListener('popstate', function (ev) {
    var st = ev.state || {};
    if (openDialog) {
      if (!st.tdDialog) closeDialog(false, true);
      return;
    }
    if (st.tdDialog) root.history.back();
  });

  function closeDialog(value, fromPop) {
    if (!openDialog) return;
    var overlay = openDialog;
    var resolve = overlay._resolve;
    openDialog = null;
    overlay.remove();
    /* 主动关闭时消费掉压入的那条历史，保持栈干净 */
    if (!fromPop && root.history && root.history.state && root.history.state.tdDialog) {
      root.history.back();
    }
    if (resolve) resolve(value);
  }

  root.TD.Notify = {
    toast: function (msg, type) {
      var now = Date.now();
      if (msg === lastToast.msg && now - lastToast.at < 2500) return; /* 同消息 2.5s 内去重 */
      lastToast = { msg: msg, at: now };
      var wrap = ensureWrap();
      var el = document.createElement('div');
      el.className = 'td-toast' + (type === 'error' ? ' td-toast-error' : '');
      el.textContent = msg;
      wrap.appendChild(el);
      requestAnimationFrame(function () { el.classList.add('show'); });
      setTimeout(function () {
        el.classList.remove('show');
        setTimeout(function () { el.remove(); }, 220);
      }, 2400);
    },

    /** 返回 Promise<boolean>；kind: 'primary' | 'danger' */
    confirm: function (title, msg, kind) {
      var self = this;
      return new Promise(function (resolve) {
        if (openDialog) closeDialog(false, true); /* 已有弹窗先关 */
        var overlay = document.createElement('div');
        overlay.className = 'td-overlay';
        overlay.innerHTML =
          '<div class="td-dialog" role="dialog" aria-modal="true">' +
          '  <p class="td-dialog-title"></p>' +
          '  <p class="td-dialog-msg"></p>' +
          '  <div class="td-dialog-actions">' +
          '    <button type="button" class="td-dialog-btn" data-act="cancel">取消</button>' +
          '    <button type="button" class="td-dialog-btn td-dialog-btn-primary" data-act="ok">确定</button>' +
          '  </div>' +
          '</div>';
        overlay.querySelector('.td-dialog-title').textContent = title;
        overlay.querySelector('.td-dialog-msg').textContent = msg;
        var okBtn = overlay.querySelector('[data-act="ok"]');
        if (kind === 'danger') okBtn.classList.replace('td-dialog-btn-primary', 'td-dialog-btn-danger');
        overlay._resolve = resolve;
        overlay.querySelector('[data-act="cancel"]').addEventListener('click', function () { closeDialog(false); });
        okBtn.addEventListener('click', function () { closeDialog(true); });
        overlay.addEventListener('click', function (e) { if (e.target === overlay) closeDialog(false); });
        document.body.appendChild(overlay);
        openDialog = overlay;
        try { root.history.pushState({ tdDialog: true }, ''); } catch (e) { /* 环境不支持时静默 */ }
        okBtn.focus();
      });
    },

    /** 路由切换时强制关闭弹窗（不恢复 Promise 以外的副作用） */
    _forceClose: function () { closeDialog(false, true); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
