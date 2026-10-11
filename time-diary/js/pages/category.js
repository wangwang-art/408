/* 页面：分类管理（模板 + 初始化；增删；颜色选择；今日时长展示） */
(function (root) {
  'use strict';
  root.TD = root.TD || {};
  root.TD.Pages = root.TD.Pages || {};
  root.TD.TPL = root.TD.TPL || {};

  root.TD.TPL.category =
    '<main class="w-full max-w-md mx-auto px-4">' +
    '<header class="sticky top-0 z-30 -mx-4 mb-4 flex items-center justify-between border-b border-[var(--diary-border)] bg-[var(--diary-background)]/95 px-4 backdrop-blur" style="height:calc(3.5rem + var(--safe-top));padding-top:var(--safe-top)">' +
    '<button type="button" data-action="back" class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--diary-muted-foreground)] transition-colors hover:bg-[var(--diary-surface-2)]" aria-label="返回">' +
    '<i data-lucide="chevron-left" class="h-5 w-5"></i></button>' +
    '<h1 class="diary-h3">分类管理</h1>' +
    '<button type="button" id="cat-add" class="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--diary-primary)] text-[var(--diary-primary-ink)] transition-transform hover:-translate-y-0.5" aria-label="新增分类">' +
    '<i data-lucide="plus" class="h-5 w-5"></i></button>' +
    '</header>' +
    '<section class="diary-card px-2 py-2">' +
    '<ul id="cat-list" class="divide-y divide-[var(--diary-border)]"></ul>' +
    '</section>' +
    '<section class="diary-card mt-4 px-4 py-4">' +
    '<h2 class="diary-h3 mb-3">新增分类</h2>' +
    '<div class="flex gap-2">' +
    '<input id="cat-name" type="text" aria-label="分类名称" placeholder="分类名称（如：冥想）" class="h-11 min-w-0 flex-1 rounded-xl border border-[var(--diary-input)] bg-[var(--diary-surface)] px-3 text-[14px] text-[var(--diary-foreground)] outline-none transition-shadow placeholder:text-[var(--diary-muted-foreground)] focus:ring-2 focus:ring-[var(--diary-ring)]" />' +
    '<button type="button" id="cat-add-btn" class="inline-flex h-11 shrink-0 items-center gap-1 rounded-xl bg-[var(--diary-primary)] px-4 text-[13px] font-semibold text-[var(--diary-primary-ink)] transition-transform hover:-translate-y-0.5">' +
    '<i data-lucide="plus" class="h-4 w-4"></i><span class="whitespace-nowrap">添加</span></button></div>' +
    '<div class="mt-3"><p class="mb-2 text-[12px] text-[var(--diary-muted-foreground)]">选择颜色</p>' +
    '<div id="swatches" class="flex flex-wrap gap-2"></div></div>' +
    '</section>' +
    '</main>';

  root.TD.Pages.category = async function () {
    var $ = function (id) { return document.getElementById(id); };
    var UI = root.TD.UI, F = root.TD.Format, N = root.TD.Notify;
    var selectedColor = root.TD.Config.PALETTE[0];

    function renderSwatches() {
      var box = $('swatches');
      box.innerHTML = root.TD.Config.PALETTE.map(function (c, i) {
        var cls = ['sw-coral', 'sw-blue', 'sw-lavender', 'sw-mint', 'sw-apricot', 'sw-sakura', 'sw-mist'][i];
        return '<button type="button" class="swatch ' + cls + (c === selectedColor ? ' swatch-active' : '') +
          '" data-color="' + c + '" aria-label="颜色 ' + (i + 1) + '"></button>';
      }).join('');
      box.querySelectorAll('.swatch').forEach(function (b) {
        b.addEventListener('click', function () {
          selectedColor = b.getAttribute('data-color');
          box.querySelectorAll('.swatch').forEach(function (x) { x.classList.remove('swatch-active'); });
          b.classList.add('swatch-active');
        });
      });
    }

    async function renderList() {
      var cats = await root.TD.Repo.categories.list();
      var active = cats.filter(function (c) { return !c.archived; })
        .sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
      var records = await root.TD.Repo.records.list();
      var dayStart = root.TD.DateUtil.startOfDay(Date.now());
      var segs = root.TD.Domain.records.daySegments(records, dayStart, Date.now());
      var mins = {};
      segs.forEach(function (s) { mins[s.rec.categoryId] = (mins[s.rec.categoryId] || 0) + s.minutes; });

      var ul = $('cat-list');
      if (!active.length) {
        ul.innerHTML = '<li class="px-3 py-6 text-center diary-caption">还没有分类，先在下方添加一个</li>';
        return;
      }
      ul.innerHTML = active.map(function (c) {
        var today = mins[c.id] ? F.durationShort(mins[c.id]) + ' 今天' : '今天暂无';
        return '<li class="flex items-center gap-3 px-3 py-3">' +
          '<span class="h-3.5 w-3.5 shrink-0 rounded-full" style="background:' + c.color + '"></span>' +
          '<span class="min-w-0 flex-1 truncate text-[15px] font-medium text-[var(--diary-foreground)]">' + UI.esc(c.name) + '</span>' +
          '<span class="diary-num shrink-0 text-[12px] text-[var(--diary-muted-foreground)]">' + today + '</span>' +
          '<button type="button" data-del="' + c.id + '" class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--diary-muted-foreground)] transition-colors hover:bg-[var(--diary-surface-2)] hover:text-[var(--state-error)]" aria-label="删除' + UI.esc(c.name) + '分类">' +
          '<i data-lucide="trash-2" class="h-4 w-4"></i></button></li>';
      }).join('');

      ul.querySelectorAll('[data-del]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          var id = btn.getAttribute('data-del');
          var cat = await root.TD.Repo.categories.get(id);
          var count = (await root.TD.Repo.records.list()).filter(function (r) { return r.categoryId === id; }).length;
          var msg = count > 0
            ? '「' + cat.name + '」有 ' + count + ' 条记录。\n删除后分类不再可选，已有记录会显示为"已删除"（分类软删除，可保数据完整）。'
            : '确定删除分类「' + cat.name + '」吗？';
          if (await N.confirm('删除分类', msg, 'danger')) {
            await root.TD.Repo.categories.archive(id);
            N.toast('已删除「' + cat.name + '」');
            await renderList();
            UI.icons();
          }
        });
      });
    }

    async function addCategory() {
      var input = $('cat-name');
      var name = (input.value || '').trim();
      if (!name) { N.toast('请输入分类名称', 'error'); input.focus(); return; }
      var cats = await root.TD.Repo.categories.list();
      var maxSort = cats.reduce(function (m, c) { return Math.max(m, c.sort || 0); }, 0);
      await root.TD.Repo.categories.upsert({
        name: name, color: selectedColor, sort: maxSort + 1,
        icon: '', parentId: null, archived: false
      });
      input.value = '';
      N.toast('已添加「' + name + '」');
      await renderList();
      UI.icons();
    }

    renderSwatches();
    await renderList();
    $('cat-add').addEventListener('click', addCategory);
    $('cat-add-btn').addEventListener('click', addCategory);
    $('cat-name').addEventListener('keydown', function (e) { if (e.key === 'Enter') addCategory(); });
  };
})(typeof window !== 'undefined' ? window : globalThis);
