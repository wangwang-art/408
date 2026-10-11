/* 页面：日记（模板 + 初始化；按日期一篇；心情；字数；防抖自动保存；当日记录关联） */
(function (root) {
  'use strict';
  root.TD = root.TD || {};
  root.TD.Pages = root.TD.Pages || {};
  root.TD.TPL = root.TD.TPL || {};

  root.TD.TPL.diary =
    '<style>' +
    '.sticker-illustration { display: inline-block; object-fit: contain; }' +
    '</style>' +
    '<main class="w-full max-w-md mx-auto px-4">' +
    '<header class="sticky top-0 z-30 -mx-4 mb-4 flex items-center justify-between border-b border-[var(--diary-border)] bg-[var(--diary-background)]/95 px-4 backdrop-blur" style="height:calc(3.5rem + var(--safe-top));padding-top:var(--safe-top)">' +
    '<button type="button" data-action="back" class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--diary-muted-foreground)] transition-colors hover:bg-[var(--diary-surface-2)]" aria-label="返回">' +
    '<i data-lucide="x" class="h-5 w-5"></i></button>' +
    '<h1 class="diary-h3">写日记</h1>' +
    '<button type="button" id="diary-save" class="inline-flex h-9 items-center gap-1 rounded-lg bg-[var(--diary-primary)] px-3 text-[13px] font-semibold text-[var(--diary-primary-ink)] transition-transform hover:-translate-y-0.5" aria-label="保存日记">' +
    '<span class="whitespace-nowrap">保存</span></button>' +
    '</header>' +
    '<section class="diary-card px-4 py-4">' +
    '<input id="diary-title" type="text" aria-label="日记标题" class="w-full border-0 bg-transparent text-[18px] font-semibold text-[var(--diary-foreground)] outline-none placeholder:text-[var(--diary-muted-foreground)]" placeholder="给今天起个标题" />' +
    '<div class="mt-3 h-px bg-[var(--diary-border)]"></div>' +
    '<div class="mt-4 flex flex-wrap items-center gap-2">' +
    '<span class="text-[13px] text-[var(--diary-muted-foreground)]">心情</span>' +
    '<div id="mood-box" class="flex flex-wrap items-center gap-2"></div></div>' +
    '<textarea id="diary-content" rows="9" aria-label="日记正文" placeholder="今天做了什么？时间花在了哪里？有什么想对自己说的……" class="mt-4 w-full resize-none border-0 bg-transparent text-[15px] leading-7 text-[var(--diary-foreground)] outline-none placeholder:text-[var(--diary-muted-foreground)]"></textarea>' +
    '<div class="mt-3 flex items-center justify-between border-t border-[var(--diary-border)] pt-3">' +
    '<span id="diary-count" class="text-[12px] text-[var(--diary-muted-foreground)]">字数 0</span>' +
    '<span id="diary-autosave" class="text-[12px] text-[var(--diary-muted-foreground)]">自动保存已开启</span></div>' +
    '</section>' +
    '<section class="diary-card mt-4 px-4 py-4">' +
    '<div class="mb-3 flex items-center justify-between"><h2 class="diary-h3">当日时间记录</h2>' +
    '<span class="diary-chip">自动关联</span></div>' +
    '<ul id="diary-records" class="divide-y divide-[var(--diary-border)]"></ul>' +
    '<p class="mt-2 border-t border-[var(--diary-border)] pt-3 text-[12px] text-[var(--diary-muted-foreground)]">按日期自动与当天时间记录关联，形成日报复盘。</p>' +
    '</section>' +
    '<section class="mt-4 flex items-center justify-center gap-3 px-4 py-4">' +
    '<img src="assets/sticker-star.png" alt="星星贴纸" class="sticker-illustration h-9 w-9 object-contain" />' +
    '<img src="assets/sticker-cat.png" alt="猫咪贴纸" class="sticker-illustration h-11 w-11 object-contain" />' +
    '<img src="assets/sticker-moon.png" alt="月亮贴纸" class="sticker-illustration h-9 w-9 object-contain" />' +
    '</section>' +
    '</main>';

  root.TD.Pages.diary = async function () {
    var $ = function (id) { return document.getElementById(id); };
    var UI = root.TD.UI, DU = root.TD.DateUtil, N = root.TD.Notify;

    var q = UI.query();
    var dateKey = DU.keyToTs(q.date) ? q.date : DU.dateKey(Date.now());
    var diary = await root.TD.Repo.diaries.byDateKey(dateKey);
    var mood = diary ? diary.mood : null;
    var saveHandle = null;
    var dirty = false;

    $('diary-title').value = diary ? diary.title : '';
    $('diary-content').value = diary ? diary.content : '';
    updateCount();

    /* ---------- 心情 ---------- */
    var moodBox = $('mood-box');
    moodBox.innerHTML = root.TD.Config.MOODS.map(function (m) {
      return '<button type="button" class="mood-chip' + (m.key === mood ? ' mood-active' : '') +
        '" data-mood="' + m.key + '">' + m.label + '</button>';
    }).join('');
    moodBox.querySelectorAll('[data-mood]').forEach(function (b) {
      b.addEventListener('click', function () {
        mood = b.getAttribute('data-mood');
        moodBox.querySelectorAll('.mood-chip').forEach(function (x) { x.classList.remove('mood-active'); });
        b.classList.add('mood-active');
        markDirty();
      });
    });

    /* ---------- 字数与自动保存 ---------- */
    function updateCount() {
      $('diary-count').textContent = '字数 ' + $('diary-content').value.length;
    }
    function collect() {
      return {
        dateKey: dateKey,
        title: $('diary-title').value.trim(),
        mood: mood,
        content: $('diary-content').value
      };
    }
    async function persist(silent) {
      var d = collect();
      if (!d.title && !d.content.trim()) return; /* 空日记不保存 */
      await root.TD.Repo.diaries.upsertByDate(d);
      dirty = false;
      if (!silent) N.toast('已保存日记');
      else $('diary-autosave').textContent = '已自动保存 ' + DU.formatHM(Date.now());
    }
    function markDirty() {
      dirty = true;
      updateCount();
      clearTimeout(saveHandle);
      saveHandle = setTimeout(function () { persist(true); }, 1200);
    }
    ['diary-title', 'diary-content'].forEach(function (id) {
      $(id).addEventListener('input', markDirty);
    });
    /* 路由切走时兜底保存（路由器在卸载旧页前调用） */
    root.TD._leaveHook = function () {
      if (dirty) {
        var d0 = collect();
        if (d0.title || d0.content.trim()) {
          try { root.TD.Repo.diaries.upsertByDate(d0); } catch (_) { /* 尽力而为 */ }
        }
      }
    };
    /* 真实卸载（关标签页/刷新）同样兜底 */
    root.addEventListener('beforeunload', function () {
      if (dirty) {
        var d = collect();
        if (d.title || d.content.trim()) {
          try { root.TD.Repo.diaries.upsertByDate(d); } catch (_) { /* 尽力而为 */ }
        }
      }
    });
    $('diary-save').addEventListener('click', function () { persist(false); });

    /* ---------- 当日时间记录关联（按日期推导，非外键） ---------- */
    var records = await root.TD.Repo.records.list();
    var cats = await root.TD.Repo.categories.list();
    var findCat = UI.catFinder(cats);
    var dayTs = DU.keyToTs(dateKey);
    var byCat = root.TD.Domain.records.byCategory(records, dayTs, DU.endOfDay(dayTs), Date.now());
    $('diary-records').innerHTML = byCat.length ? byCat.map(function (x) {
      var c = findCat(x.categoryId);
      return '<li class="flex items-center gap-2 py-2.5">' +
        '<span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background:' + c.color + '"></span>' +
        '<span class="flex-1 truncate text-[13px] text-[var(--diary-foreground)]">' + UI.esc(c.name) + '</span>' +
        '<span class="diary-num shrink-0 text-[13px] text-[var(--diary-muted-foreground)]">' + root.TD.Format.durationShort(x.minutes) + '</span></li>';
    }).join('') : '<li class="py-3 text-center diary-caption">当天还没有时间记录</li>';
  };
})(typeof window !== 'undefined' ? window : globalThis);
