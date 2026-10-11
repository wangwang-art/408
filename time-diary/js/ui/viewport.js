/* UI 层：视口适配（文档第七章：键盘与横竖屏）
 * - visualViewport 监听键盘弹出，标记 .kb-open（隐藏底部固定元素）
 * - 输入框聚焦时滚动到可视区域
 * - 横竖屏/尺寸变化防抖重算，避免旋转过程中反复触发 */
(function (root) {
  'use strict';
  root.TD = root.TD || {};

  root.TD.Viewport = {
    init: function () {
      var vv = root.visualViewport;
      var html = document.documentElement;
      var timer = null;

      function recalc() {
        timer = null;
        var kbOpen = false;
        if (vv) kbOpen = (root.innerHeight - vv.height) > 120; /* 键盘占位判定 */
        html.classList.toggle('kb-open', kbOpen);
        html.style.setProperty('--vvh', (vv ? vv.height : root.innerHeight) + 'px');
      }
      function debounced() {
        if (timer) clearTimeout(timer);
        timer = setTimeout(recalc, 150);
      }

      if (vv) {
        vv.addEventListener('resize', debounced);
        vv.addEventListener('scroll', debounced);
      }
      window.addEventListener('orientationchange', debounced);
      window.addEventListener('resize', debounced);

      document.addEventListener('focusin', function (e) {
        var el = e.target;
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
          setTimeout(function () {
            if (el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }, 250);
        }
      });

      recalc();
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
