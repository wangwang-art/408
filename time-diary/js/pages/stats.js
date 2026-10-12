/* 页面：统计（模板 + 初始化；今日/本周/本月：环形图 + 图例 + 时间账本 + 洞察） */
(function (root) {
  'use strict';
  root.TD = root.TD || {};
  root.TD.Pages = root.TD.Pages || {};
  root.TD.TPL = root.TD.TPL || {};

  root.TD.TPL.stats =
    '<main class="w-full max-w-md mx-auto px-4">' +
    '<header class="pb-4" style="padding-top:calc(20px + var(--safe-top))">' +
    '<h1 class="diary-h3">统计</h1>' +
    '<p class="diary-caption mt-1">看看时间都花在了哪里</p></header>' +
    '<div class="flex items-center gap-1 rounded-xl bg-[var(--diary-muted)] p-1" role="tablist" aria-label="统计周期">' +
    '<button type="button" data-period="day" class="flex-1 whitespace-nowrap rounded-lg py-2 text-[13px] font-medium text-[var(--diary-muted-foreground)] transition-colors" role="tab">今日</button>' +
    '<button type="button" data-period="week" class="flex-1 whitespace-nowrap rounded-lg py-2 text-[13px] font-medium text-[var(--diary-muted-foreground)] transition-colors" role="tab">本周</button>' +
    '<button type="button" data-period="month" class="flex-1 whitespace-nowrap rounded-lg py-2 text-[13px] font-medium text-[var(--diary-muted-foreground)] transition-colors" role="tab">本月</button>' +
    '</div>' +
    '<section class="diary-card mt-4 px-4 py-4">' +
    '<div class="mb-3 flex items-center justify-between"><h2 class="diary-h3">时间占比</h2>' +
    '<span id="chart-chip" class="diary-chip diary-chip-primary">暂无数据</span></div>' +
    '<div class="relative mx-auto h-56 w-56">' +
    '<svg id="donut-chart" width="224" height="224" viewBox="0 0 224 224" aria-label="时间占比环形图" role="img"></svg>' +
    '<div id="chart-center" class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"></div>' +
    '<p id="chart-empty" class="absolute inset-0 flex items-end justify-center pb-2 text-[12px] text-[var(--diary-muted-foreground)]" style="display:none">该周期还没有记录</p></div>' +
    '<ul id="chart-list" class="mt-4 divide-y divide-[var(--diary-border)]"></ul>' +
    '</section>' +
    '<section class="diary-card mt-4 px-4 py-4">' +
    '<div class="mb-1 flex items-center justify-between"><h2 id="ledger-title" class="diary-h3">时间账本</h2>' +
    '<span id="ledger-sub" class="diary-caption">共 0</span></div>' +
    '<ul id="ledger-list" class="divide-y divide-[var(--diary-border)]"></ul>' +
    '</section>' +
    '<section class="mt-4 rounded-2xl border border-[var(--diary-border)] bg-[linear-gradient(160deg,var(--diary-primary-soft),var(--diary-primary-tint))] px-4 py-4">' +
    '<h2 class="diary-h3 mb-3">洞察</h2>' +
    '<ul id="insight-list" class="space-y-2.5"></ul>' +
    '<a href="#" data-go="goals" class="mt-4 inline-flex h-10 items-center gap-1.5 rounded-xl bg-[var(--diary-primary)] px-4 text-[13px] font-semibold text-[var(--diary-primary-ink)] transition-transform hover:-translate-y-0.5">' +
    '<i data-lucide="target" class="h-4 w-4"></i><span class="whitespace-nowrap">设置目标</span></a>' +
    '</section>' +
    '</main>';

  root.TD.Pages.stats = async function (settings) {
    var $ = function (id) { return document.getElementById(id); };
    var UI = root.TD.UI, DU = root.TD.DateUtil, F = root.TD.Format;
    var token = UI.pageToken();

    var PERIODS = { day: '今日', week: '本周', month: '本月' };
    var period = PERIODS[UI.query().p] ? UI.query().p : 'week';
    var now = Date.now();

    /* ---------- 周期切换 ---------- */
    document.querySelectorAll('[data-period]').forEach(function (b) {
      var key = b.getAttribute('data-period');
      var active = key === period;
      b.classList.toggle('bg-[var(--diary-primary-soft)]', active);
      b.classList.toggle('text-[var(--diary-primary-strong)]', active);
      b.classList.toggle('font-semibold', active);
      b.classList.toggle('text-[var(--diary-muted-foreground)]', !active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
      b.addEventListener('click', function () { UI.go('stats', { p: key }); });
    });

    /* ---------- 区间 ---------- */
    var range;
    if (period === 'day') range = { start: DU.startOfDay(now), end: DU.endOfDay(now), label: '今日' };
    else if (period === 'week') {
      var ws = DU.startOfWeek(now, settings.weekStart);
      range = { start: ws, end: ws + 7 * DU.DAY_MS, label: '本周' };
    } else {
      var ms = DU.startOfMonth(now);
      range = { start: ms, end: ms + DU.daysInMonth(now) * DU.DAY_MS, label: '本月' };
    }

    var records = await root.TD.Repo.records.list();
    var cats = await root.TD.Repo.categories.list();
    if (!UI.still(token)) return; /* 离开本页后放弃 DOM 写入（文档 3.2/3.4） */
    var findCat = UI.catFinder(cats);

    var segs = root.TD.Domain.records.segments(records, range.start, range.end, now);
    var byCat = root.TD.Domain.records.byCategory(records, range.start, range.end, now);
    var summary = root.TD.Domain.stats.summarize(byCat, cats);

    /* ---------- 环形图 + 图例 ---------- */
    $('chart-chip').textContent = summary.items.length ? summary.items.length + ' 项活动' : '暂无数据';
    $('chart-center').innerHTML =
      '<p class="diary-num text-[26px] font-bold leading-none text-[var(--diary-foreground)]">' +
      F.durationShort(summary.total).replace(/([a-z]+)/, '<span class="ml-0.5 text-[13px] font-medium text-[var(--diary-muted-foreground)]">$1</span>') +
      '</p><p class="mt-1 text-[11px] text-[var(--diary-muted-foreground)]">' + range.label + '记录</p>';
    UI.donut($('donut-chart'), summary.items);
    if (!summary.items.length) {
      $('chart-empty').style.display = '';
    }

    $('chart-list').innerHTML = summary.items.map(function (it) {
      return '<li class="flex items-center gap-2 py-2">' +
        '<span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background:' + it.color + '"></span>' +
        '<span class="flex-1 truncate text-[13px] text-[var(--diary-foreground)]">' + UI.esc(it.name) + '</span>' +
        '<span class="diary-num text-[13px] font-medium text-[var(--diary-foreground)]">' + F.durationShort(it.minutes) + '</span>' +
        '<span class="diary-num w-10 text-right text-[12px] text-[var(--diary-muted-foreground)]">' + F.pct(it.ratio) + '</span></li>';
    }).join('') || '<li class="py-4 text-center diary-caption">该周期还没有记录</li>';

    /* ---------- 时间账本 ---------- */
    $('ledger-title').textContent = range.label + '时间账本';
    $('ledger-sub').textContent = '共 ' + F.duration(summary.total);
    var ledger = root.TD.Domain.stats.ledger(segs, cats);
    $('ledger-list').innerHTML = ledger.map(function (it) {
      var ranges = period === 'day' && it.ranges.length
        ? '<span class="hidden w-0 shrink truncate text-[12px] text-[var(--diary-muted-foreground)] sm:block sm:w-auto sm:max-w-[160px]">' +
          UI.esc(it.ranges.map(function (r) { return r.replace('-now', ' 起'); }).join(' · ')) + '</span>'
        : '';
      return '<li class="flex items-center gap-2 py-3">' +
        '<span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background:' + it.color + '"></span>' +
        '<span class="flex-1 truncate text-[14px] font-medium text-[var(--diary-foreground)]">' + UI.esc(it.name) + '</span>' +
        ranges +
        '<span class="diary-num text-[14px] font-semibold text-[var(--diary-foreground)]">' + F.durationShort(it.minutes) + '</span></li>';
    }).join('') || '<li class="py-4 text-center diary-caption">该周期还没有记录</li>';

    /* ---------- 洞察 ---------- */
    /* 当前为规则版文案；AI 备选：await TD.AI.analyze(summary)（签名一致，见 services/ai.js） */
    var ongoing = await root.TD.Repo.records.ongoing();
    var insights = root.TD.Domain.stats.insights(summary, {
      ongoingCategoryName: ongoing ? findCat(ongoing.categoryId).name : null
    });
    $('insight-list').innerHTML = insights.map(function (t) {
      return '<li class="flex items-center gap-2.5">' +
        '<i data-lucide="sparkles" class="h-4 w-4 shrink-0 text-[var(--diary-primary-strong)]"></i>' +
        '<span class="min-w-0 flex-1 text-[13px] text-[var(--diary-foreground)]">' + UI.esc(t) + '</span></li>';
    }).join('');
  };
})(typeof window !== 'undefined' ? window : globalThis);
