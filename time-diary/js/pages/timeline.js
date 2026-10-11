/* 页面：时间轴（模板 + 初始化；SPA 由路由器挂载） */
(function (root) {
  'use strict';
  root.TD = root.TD || {};
  root.TD.Pages = root.TD.Pages || {};
  root.TD.TPL = root.TD.TPL || {};

  root.TD.TPL.timeline =
    '<style>' +
    '.timeline-bar { display: flex; flex-direction: column; gap: 1px; height: 520px; overflow: hidden; border-radius: var(--diary-radius-medium); background: var(--diary-surface-2); }' +
    '.tl-block, .tl-gap { flex: 1 1 0; }' +
    '.tl-block { width: 100%; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 1px; padding: 3px 10px; border: 0; border-radius: 8px; background: var(--c, var(--diary-muted-foreground)); color: var(--diary-primary-ink); text-align: left; overflow: hidden; cursor: pointer; transition: filter .15s ease; }' +
    '.tl-block:hover { filter: brightness(0.95); }' +
    '.tl-sm { align-items: center; justify-content: center; }' +
    '.tl-time { font-size: 10px; line-height: 1; opacity: .92; white-space: nowrap; }' +
    '.tl-name { font-size: 12px; font-weight: 600; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }' +
    '.tl-live { box-shadow: 0 0 0 2px var(--diary-primary); }' +
    '.empty-illustration { display: block; width: 100%; max-width: 240px; height: 9rem; margin-inline: auto; object-fit: cover; border-radius: var(--diary-radius-medium); }' +
    '</style>' +
    '<main class="w-full max-w-md mx-auto px-4">' +
    '<header class="flex items-center justify-between pb-4" style="padding-top:calc(20px + var(--safe-top))">' +
    '<button type="button" id="btn-prev" class="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-[13px] text-[var(--diary-muted-foreground)] transition-colors hover:bg-[var(--diary-surface-2)]" aria-label="前一天">' +
    '<i data-lucide="chevron-left" class="h-4 w-4"></i><span class="whitespace-nowrap">前一天</span></button>' +
    '<div class="flex items-center gap-2">' +
    '<h1 class="diary-h3 whitespace-nowrap" id="date-label">今天</h1>' +
    '<button type="button" id="btn-diary" class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--diary-border)] bg-[var(--diary-surface)] text-[var(--diary-foreground)] transition-transform hover:-translate-y-0.5" aria-label="打开日记">' +
    '<i data-lucide="book-open" class="h-4 w-4"></i></button></div>' +
    '<button type="button" id="btn-next" class="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-[13px] text-[var(--diary-muted-foreground)] transition-colors hover:bg-[var(--diary-surface-2)]" aria-label="后一天">' +
    '<span class="whitespace-nowrap">后一天</span><i data-lucide="chevron-right" class="h-4 w-4"></i></button>' +
    '</header>' +
    '<section id="today-summary" class="diary-card px-4 py-4">' +
    '<div class="flex items-center justify-between gap-3"><div class="min-w-0">' +
    '<p class="diary-caption mb-1">今日已记录</p>' +
    '<p class="diary-num text-[30px] font-bold leading-none tracking-[-0.02em] text-[var(--diary-foreground)]"><span id="today-total">0</span></p>' +
    '<p class="diary-num mt-1 text-[11px] text-[var(--diary-muted-foreground)]"><span id="record-count">0 条记录</span></p></div>' +
    '<div id="ongoing-card" class="flex shrink-0 items-center gap-2 rounded-xl bg-[var(--diary-primary-soft)] px-3 py-2" style="display:none">' +
    '<span class="relative flex h-2 w-2"><span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--diary-primary)] opacity-60"></span>' +
    '<span class="relative inline-flex h-2 w-2 rounded-full bg-[var(--diary-primary)]"></span></span>' +
    '<div class="min-w-0 text-right">' +
    '<p class="whitespace-nowrap text-[13px] font-medium text-[var(--diary-primary-strong)]" id="ongoing-name">进行中</p>' +
    '<p class="diary-num whitespace-nowrap text-[11px] text-[var(--diary-muted-foreground)]" id="ongoing-mins">已 0 分钟</p></div></div></div>' +
    '</section>' +
    '<section id="timeline-area" class="mt-4">' +
    '<div class="mb-2 flex items-center justify-between"><h2 class="diary-h3">时间轴</h2>' +
    '<span class="diary-chip diary-chip-primary">自动补录已开启</span></div>' +
    '<div class="diary-card px-3 py-4"><div class="flex gap-2">' +
    '<div class="flex w-9 shrink-0 flex-col justify-between pb-0.5 pt-0.5">' +
    '<span class="text-[10px] leading-none text-[var(--diary-muted-foreground)]">00</span>' +
    '<span class="text-[10px] leading-none text-[var(--diary-muted-foreground)]">02</span>' +
    '<span class="text-[10px] leading-none text-[var(--diary-muted-foreground)]">04</span>' +
    '<span class="text-[10px] leading-none text-[var(--diary-muted-foreground)]">06</span>' +
    '<span class="text-[10px] leading-none text-[var(--diary-muted-foreground)]">08</span>' +
    '<span class="text-[10px] leading-none text-[var(--diary-muted-foreground)]">10</span>' +
    '<span class="text-[10px] leading-none text-[var(--diary-muted-foreground)]">12</span>' +
    '<span class="text-[10px] leading-none text-[var(--diary-muted-foreground)]">14</span>' +
    '<span class="text-[10px] leading-none text-[var(--diary-muted-foreground)]">16</span>' +
    '<span class="text-[10px] leading-none text-[var(--diary-muted-foreground)]">18</span>' +
    '<span class="text-[10px] leading-none text-[var(--diary-muted-foreground)]">20</span>' +
    '<span class="text-[10px] leading-none text-[var(--diary-muted-foreground)]">22</span></div>' +
    '<div id="timeline-bar" class="timeline-bar relative flex-1"></div></div></div>' +
    '</section>' +
    '<section class="sticky z-30 mt-4 rounded-2xl border border-[var(--diary-border)] bg-[var(--diary-surface)]/95 p-3 shadow-[var(--diary-shadow-2)] backdrop-blur kb-hide" style="bottom:calc(72px + var(--safe-bottom))">' +
    '<div class="flex items-center gap-3">' +
    '<button type="button" id="btn-record" class="btn-record inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--diary-primary)] text-[var(--diary-primary-ink)] text-[15px] font-semibold transition-transform hover:-translate-y-0.5 active:translate-y-0" aria-label="开始记录">' +
    '<i data-lucide="play" class="h-5 w-5"></i><span class="whitespace-nowrap">开始记录</span></button>' +
    '<div class="min-w-0">' +
    '<p class="diary-caption mb-0.5" id="ongoing-hint">开始后忘记结束也没关系，随时回来补录</p>' +
    '<p class="diary-num whitespace-nowrap text-[13px] font-medium text-[var(--diary-foreground)]" id="ongoing-timer">开始时间默认接续上一条记录</p></div></div>' +
    '</section>' +
    '<section class="mt-4">' +
    '<a href="#" id="cta-diary" class="diary-card flex items-center gap-3 px-4 py-4 transition-transform hover:-translate-y-0.5">' +
    '<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--diary-primary-soft)] text-[var(--diary-primary-strong)]">' +
    '<i data-lucide="pen-line" class="h-5 w-5"></i></span>' +
    '<span class="min-w-0 flex-1"><span class="block text-[15px] font-semibold text-[var(--diary-foreground)]">今日复盘</span>' +
    '<span class="block truncate text-[13px] text-[var(--diary-muted-foreground)]">写一篇日记，记录时间与心情</span></span>' +
    '<i data-lucide="chevron-right" class="h-4 w-4 shrink-0 text-[var(--diary-muted-foreground)]"></i></a>' +
    '</section>' +
    '<section id="empty-state" class="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--diary-border)] px-4 py-5 text-center" style="display:none">' +
    '<img src="assets/empty-timeline.jpg" alt="夜晚看日程表的插画" class="empty-illustration h-36 w-full max-w-[240px] rounded-xl object-cover" />' +
    '<p class="diary-caption">夜里睡前记得再记一笔，晚安好梦</p></section>' +
    '</main>';

  root.TD.Pages.timeline = async function (settings) {
    var $ = function (id) { return document.getElementById(id); };
    var UI = root.TD.UI, DU = root.TD.DateUtil, F = root.TD.Format, N = root.TD.Notify;

    var todayKey = DU.dateKey(Date.now());
    var dateKey = DU.keyToTs(q_date()) ? q_date() : todayKey;
    function q_date() { return UI.query().date; }

    var records = await root.TD.Repo.records.list();
    var cats = await root.TD.Repo.categories.list();
    var findCat = UI.catFinder(cats);

    /* ---------- 头部日期 ---------- */
    var dayTs = DU.keyToTs(dateKey);
    $('date-label').textContent = DU.formatCN(dayTs);
    $('btn-prev').addEventListener('click', function () { UI.go('timeline', { date: DU.addDays(dateKey, -1) }); });
    $('btn-next').addEventListener('click', function () { UI.go('timeline', { date: DU.addDays(dateKey, 1) }); });
    $('btn-diary').addEventListener('click', function () { UI.go('diary', { date: dateKey }); });

    /* ---------- 今日概览 + 时间轴 ---------- */
    var now = Date.now();
    var isToday = dateKey === todayKey;
    var segs = root.TD.Domain.records.daySegments(records, dayTs, isToday ? now : DU.endOfDay(dayTs));
    var total = root.TD.Domain.records.totalMinutes(segs);
    $('today-total').textContent = F.duration(total);
    $('record-count').textContent = segs.length + ' 条记录';

    var bar = $('timeline-bar');
    var blocks = root.TD.Domain.records.timelineBlocks(records, dayTs, isToday ? now : DU.endOfDay(dayTs));
    var ongoing = await root.TD.Repo.records.ongoing();

    /* 概览右侧：进行中卡片 */
    var oc = $('ongoing-card');
    if (ongoing && isToday) {
      oc.style.display = '';
      $('ongoing-name').textContent = '进行中：' + findCat(ongoing.categoryId).name;
      $('ongoing-mins').textContent = '已 ' + F.duration((now - ongoing.start) / 60000);
    } else {
      oc.style.display = 'none';
    }

    function blockLabel(b) {
      var c = findCat(b.rec.categoryId);
      var live = b.rec.end === null;
      var range = live ? DU.formatHM(b.start) + ' 起' : F.hmRange(b.start, b.end);
      var time = '<span class="tl-time">' + range + '</span>';
      var name = '<span class="tl-name truncate">' + UI.esc(c.name) + '</span>';
      if (b.minutes >= 45) return time + name;
      if (b.minutes >= 15) return name;
      return '';
    }

    bar.innerHTML = blocks.map(function (b) {
      var grow = Math.max(1, Math.round(b.minutes));
      if (b.type === 'gap') return '<div class="tl-gap" aria-hidden="true" style="flex-grow:' + grow + '"></div>';
      var c = findCat(b.rec.categoryId);
      var live = b.rec.end === null;
      var sizeCls = b.minutes >= 120 ? ' tl-lg' : (b.minutes <= 60 ? ' tl-sm' : '');
      return '<button type="button" class="tl-block' + sizeCls + (live ? ' tl-live' : '') +
        '" style="flex-grow:' + grow + ';--c:' + c.color + '" data-edit="' + b.rec.id + '" aria-label="编辑记录：' +
        UI.esc(c.name) + ' ' + DU.formatHM(b.start) + '">' + blockLabel(b) + '</button>';
    }).join('');

    bar.querySelectorAll('[data-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () { UI.go('recordEdit', { id: btn.getAttribute('data-edit') }); });
    });

    /* 空状态 */
    if (!segs.length) $('empty-state').style.display = '';
    else $('empty-state').style.display = 'none';

    /* ---------- 一键记录控制条 ---------- */
    var btn = $('btn-record');
    var btnIcon = btn.querySelector('i');
    var btnText = btn.querySelector('span');
    var timerEl = $('ongoing-timer');
    var hintEl = $('ongoing-hint');
    var timerHandle = null;

    function renderControl() {
      if (ongoing) {
        btnIcon.setAttribute('data-lucide', 'square');
        btnText.textContent = '结束记录';
        btn.setAttribute('aria-label', '结束记录');
        hintEl.textContent = '忘记结束？点左侧按钮立即补录';
        timerEl.textContent = '已计时 ' + F.clock((Date.now() - ongoing.start) / 1000);
        if (!timerHandle) timerHandle = setInterval(function () {
          timerEl.textContent = '已计时 ' + F.clock((Date.now() - ongoing.start) / 1000);
        }, 1000);
      } else {
        btnIcon.setAttribute('data-lucide', 'play');
        btnText.textContent = '开始记录';
        btn.setAttribute('aria-label', '开始记录');
        hintEl.textContent = '开始后忘记结束也没关系，随时回来补录';
        timerEl.textContent = '开始时间默认接续上一条记录';
      }
      UI.icons();
    }

    btn.addEventListener('click', async function () {
      if (ongoing) {
        if (!(await N.confirm('结束记录', '将「' + findCat(ongoing.categoryId).name + '」记录结束于当前时刻，确定吗？'))) return;
        ongoing.end = Date.now();
        await root.TD.Repo.records.upsert(ongoing);
        N.toast('已结束并补录');
        UI.go('timeline', { date: dateKey });
      } else {
        UI.go('recordEdit', { date: dateKey, ongoing: '1' });
      }
    });

    /* ---------- 今日复盘 CTA ---------- */
    $('cta-diary').addEventListener('click', function (e) {
      e.preventDefault();
      UI.go('diary', { date: dateKey });
    });

    renderControl();

    /* 离开页面时清理计时 interval（路由器卸载旧页前调用） */
    root.TD._leaveHook = function () {
      if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
