/* UI 层：主题（读写设置，全站生效；切换带短颜色过渡，文档第八章） */
(function (root) {
  'use strict';
  root.TD = root.TD || {};

  var ANIM_MS = 220;

  root.TD.Theme = {
    /** 应用主题到 <html>（light/dark class + color-scheme） */
    apply: function (theme) {
      var el = document.documentElement;
      el.classList.remove('light', 'dark');
      el.classList.add(theme === 'dark' ? 'dark' : 'light');
    },

    /** 切换并持久化；返回新主题。切换期间给根加 .theme-switching（只过渡颜色属性） */
    set: async function (theme) {
      var el = document.documentElement;
      el.classList.add('theme-switching');
      await root.TD.Repo.settings.write({ theme: theme });
      this.apply(theme);
      setTimeout(function () { el.classList.remove('theme-switching'); }, ANIM_MS);
      return theme;
    },

    toggle: async function () {
      var cur = await root.TD.Repo.settings.read();
      return this.set(cur.theme === 'dark' ? 'light' : 'dark');
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
