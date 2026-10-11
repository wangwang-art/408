/* 页面：目标（模板 + 初始化；概览、目标卡与打卡、习惯打卡周历） */
(function (root) {
  'use strict';
  root.TD = root.TD || {};
  root.TD.Pages = root.TD.Pages || {};
  root.TD.TPL = root.TD.TPL || {};

  root.TD.TPL.goals =
    '<style>' +
    '.checkin-today { background: var(--diary-primary-soft); box-shadow: 0 0 0 2px var(--diary-primary); }' +
    '.celebrate-illustration { display: block; width: 100%; max-width: 260px; height: 9rem; margin-inline: auto; object-fit: contain; }' +
    '</style>' +
    '<main class="w-full max-w-md mx-auto px-4">' +
    '<header class="flex items-center justify-between pb-4" style="padding-top:calc(20px + var(--safe-top))">' +
    '<div class="min-w-0"><h1 class="diary-h3">目标</h1>' +
    '<p class="diary-caption mt-1">坚持，时间会给你答案</p></div>' +
    '<button type="button" id="cta-goal-add" class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--diary-primary)] text-[var(--diary-primary-ink)] shadow-[var(--diary-shadow-2)] transition-transform hover:-translate-y-0.5" aria-label="新建目标">' +
    '<i data-lucide="plus" class="h-5 w-5"></i></button>' +
    '</header>' +
    '<section class="diary-card px-4 py-4">' +
    '<div class="mb-3 flex items-center justify-between"><h2 class="diary-h3">本周目标</h2>' +
    '<span id="week-num" class="diary-chip">第 -- 周</span></div>' +
    '<div class="grid grid-cols-3 divide-x divide-[var(--diary-border)]">' +
    '<div class="min-w-0 pr-3"><p id="ov-achieved" class="diary-num whitespace-nowrap text-[22px] font-bold leading-none text-[var(--diary-foreground)]">0</p>' +
    '<p class="mt-1.5 truncate text-[12px] text-[var(--diary-muted-foreground)]">目标达成</p></div>' +
    '<div class="min-w-0 px-3"><p id="ov-focus" class="diary-num whitespace-nowrap text-[22px] font-bold leading-none text-[var(--diary-foreground)]">0</p>' +
    '<p class="mt-1.5 truncate text-[12px] text-[var(--diary-muted-foreground)]">累计专注</p></div>' +
    '<div class="min-w-0 pl-3"><p id="ov-streak" class="diary-num whitespace-nowrap text-[22px] font-bold leading-none text-[var(--diary-foreground)]">0</p>' +
    '<p class="mt-1.5 truncate text-[12px] text-[var(--diary-muted-foreground)]">连续打卡</p></div></div>' +
    '<div class="mt-3 h-2 overflow-hidden rounded-full bg-[var(--diary-primary-tint)]">' +
    '<div id="ov-bar" class="h-full w-0 rounded-full bg-[var(--diary-primary)]"></div></div>' +
    '<p id="ov-caption" class="mt-2 text-[12px] text-[var(--diary-muted-foreground)]"></p>' +
    '</section>' +
    '<section class="mt-4 space-y-3"><h2 class="diary-h3 px-1">我的目标</h2>' +
    '<div id="goal-list" class="space-y-3"></div></section>' +
    '<section class="diary-card mt-4 px-4 py-4">' +
    '<div class="mb-3 flex items-center justify-between"><h2 class="diary-h3">习惯打卡</h2>' +
    '<span class="diary-caption">本周</span></div>' +
    '<div id="habit-grid" class="grid grid-cols-7 gap-1.5"></div>' +
    '<div class="mt-3 flex items-center justify-center gap-1.5 border-t border-[var(--diary-border)] pt-3">' +
    '<svg class="h-4 w-4 text-[var(--diary-primary)]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M12 2l2.4 6.2L21 9l-5 4.1 1.8 6.4L12 16l-5.8 3.5L8 13.1 3 9l6.6-.8z"/></svg>' +
    '<p id="habit-caption" class="text-[12px] text-[var(--diary-muted-foreground)]">今天还没有记录，从一小步开始</p></div>' +
    '</section>' +
    '<section class="mt-4 flex flex-col items-center gap-2 px-4 py-4 text-center">' +
    '<img src="assets/goal-celebrate.png" alt="达成目标欢呼庆祝插画" class="celebrate-illustration h-36 w-full max-w-[260px] object-contain" />' +
    '<p class="diary-caption">每天进步一点点，时间看得见</p></section>' +
    '</main>';

  root.TD.Pages.goals = async function (settings) {
    var $ = function (id) { return document.getElementById(id); };
    var UI = root.TD.UI, DU = root.TD.DateUtil, F = root.TD.Format, G = root.TD.Domain.goals;

    var now = Date.now();
    var goals = await root.TD.Repo.goals.list();
    var records = await root.TD.Repo.records.list();
    var cats = await root.TD.Repo.categories.list();
    var findCat = UI.catFinder(cats);

    /* ---------- 本周概览 ---------- */
    var ov = G.weekOverview(goals, records, now, now, settings.weekStart);
    $('week-num').textContent = '第 ' + DU.isoWeek(now) + ' 周';
    $('ov-achieved').innerHTML = ov.achieved + '<span class="text-[12px] font-medium text-[var(--diary-muted-foreground)]">/' + ov.total + '</span>';
    $('ov-focus').innerHTML = F.durationShort(ov.focusMinutes) + '<span class="text-[12px] font-medium text-[var(--diary-muted-foreground)]">' + (ov.focusTarget ? ' / ' + F.durationShort(ov.focusTarget) : '') + '</span>';
    $('ov-streak').innerHTML = root.TD.Domain.records.streakDays(records, now) + '<span class="text-[12px] font-medium text-[var(--diary-muted-foreground)]">天</span>';
    var ratio = ov.focusTarget ? Math.min(1, ov.focusMinutes / ov.focusTarget) : (ov.focusMinutes > 0 ? 1 : 0);
    $('ov-bar').style.width = Math.round(ratio * 100) + '%';
    $('ov-caption').textContent = ov.focusTarget
      ? '本周累计专注 ' + F.duration(ov.focusMinutes) + '，距离目标' + (ov.focusMinutes >= ov.focusTarget ? '已达成！' : '还差 ' + F.duration(ov.focusTarget - ov.focusMinutes))
      : '本周累计专注 ' + F.duration(ov.focusMinutes) + '，先创建一个目标吧';

    /* ---------- 新建按钮 ---------- */
    $('cta-goal-add').addEventListener('click', function () { UI.go('goalEdit'); });

    /* ---------- 目标卡片 ---------- */
    var listEl = $('goal-list');
    if (!goals.length) {
      listEl.innerHTML =
        '<article class="diary-card px-4 py-6 text-center">' +
        '<p class="diary-caption">还没有目标。定一个小目标，时间会给你答案。</p>' +
        '<button type="button" id="goal-empty-add" class="mt-3 inline-flex h-10 items-center gap-1.5 rounded-xl bg-[var(--diary-primary)] px-4 text-[13px] font-semibold text-[var(--diary-primary-ink)]">新建目标</button></article>';
      document.getElementById('goal-empty-add').addEventListener('click', function () { UI.go('goalEdit'); });
    } else {
      listEl.innerHTML = goals.map(function (g) {
        var p = G.progress(g, records, now, now, settings.weekStart);
        var c = findCat(g.categoryId);
        var chipCls = p.done ? 'diary-chip diary-chip-primary shrink-0' : 'diary-chip shrink-0';
        var chipText = p.done
          ? (p.unit === 'count' ? '已完成 ' + p.value + '/' + p.target + ' 次' : '已达成 ' + F.durationShort(p.value) + '/' + F.durationShort(p.target))
          : (p.unit === 'count' ? p.value + '/' + p.target + ' 次' : '已完成 ' + F.durationShort(p.value) + '/' + F.durationShort(p.target));
        var btnCls = p.done
          ? 'mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--diary-muted)] text-[13px] font-medium text-[var(--diary-muted-foreground)]" disabled'
          : 'mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--diary-primary)] text-[13px] font-semibold text-[var(--diary-primary-ink)] transition-transform hover:-translate-y-0.5 active:translate-y-0';
        var btnText = p.done ? '已达成' : (p.unit === 'count' ? '记录一次' : '去记录');
        return '<article class="diary-card px-4 py-4 transition-transform hover:-translate-y-0.5" data-goal="' + g.id + '" role="button" aria-label="编辑目标：' + UI.esc(g.name) + '">' +
          '<div class="flex items-center gap-2.5">' +
          '<span class="h-3 w-3 shrink-0 rounded-full" style="background:' + c.color + '"></span>' +
          '<div class="min-w-0 flex-1"><h3 class="truncate text-[15px] font-semibold text-[var(--diary-foreground)]">' + UI.esc(g.name) + '</h3>' +
          '<p class="mt-0.5 truncate text-[12px] text-[var(--diary-muted-foreground)]">关联：' + UI.esc(c.name) + ' · ' + (root.TD.Config.PERIODS[g.period] || g.period) + '</p></div>' +
          '<span class="' + chipCls + '">' + chipText + '</span></div>' +
          '<div class="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--diary-primary-tint)]"><div class="h-full rounded-full ' +
          (p.done ? 'bg-[var(--state-success)] w-full' : 'bg-[var(--diary-primary)]') + '" style="width:' + Math.round(Math.min(1, p.ratio) * 100) + '%"></div></div>' +
          '<button type="button" ' + btnCls + ' data-record="' + g.id + '"><i data-lucide="check-circle-2" class="h-4 w-4"></i><span class="whitespace-nowrap">' + btnText + '</span></button>' +
          '</article>';
      }).join('');

      listEl.querySelectorAll('[data-goal]').forEach(function (card) {
        card.addEventListener('click', function (e) {
          if (e.target.closest('[data-record]')) return;
          UI.go('goalEdit', { id: card.getAttribute('data-goal') });
        });
      });
      listEl.querySelectorAll('[data-record]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var g = goals.find(function (x) { return x.id === btn.getAttribute('data-record'); });
          if (g) UI.go('recordEdit', { date: DU.dateKey(now), cat: g.categoryId });
        });
      });
    }

    /* ---------- 习惯打卡周历 ---------- */
    var cells = G.habitWeek(goals, records, now, now, settings.weekStart);
    var labels = ['一', '二', '三', '四', '五', '六', '日'];
    var startDow = new Date(DU.startOfWeek(now, settings.weekStart)).getDay();
    $('habit-grid').innerHTML = cells.map(function (cell, i) {
      var dow = (startDow + i) % 7;
      var label = '周' + labels[(dow === 0 ? 6 : dow - 1)];
      var aria = label + (cell.done ? '已打卡' : (cell.future ? '未到' : '未打卡'));
      if (cell.done) {
        var cls = cell.isToday
          ? 'checkin-today flex h-10 items-center justify-center rounded-lg text-[12px] font-medium text-[var(--diary-primary-strong)]'
          : 'flex h-10 items-center justify-center rounded-lg text-[12px] text-[var(--state-success)]';
        return '<button type="button" class="' + cls + '" aria-label="' + aria + '"><i data-lucide="check" class="h-4 w-4"></i></button>';
      }
      if (cell.isToday) {
        return '<button type="button" class="checkin-today flex h-10 items-center justify-center rounded-lg border border-dashed border-[var(--diary-primary)] text-[12px] text-[var(--diary-primary-strong)]" aria-label="' + aria + '">今</button>';
      }
      return '<button type="button" class="flex h-10 items-center justify-center rounded-lg border border-dashed border-[var(--diary-border)] text-[12px] text-[var(--diary-muted-foreground)]" aria-label="' + aria + '" disabled></button>';
    }).join('');

    var streak = root.TD.Domain.records.streakDays(records, now);
    $('habit-caption').textContent = streak > 0
      ? '已连续记录 ' + streak + ' 天，继续保持！'
      : '今天还没有记录，从一小步开始';
  };
})(typeof window !== 'undefined' ? window : globalThis);
