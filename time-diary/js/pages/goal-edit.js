/* 页面：目标编辑（模板 + 初始化；新建/编辑；时长型/次数型；周期；提醒开关仅保存设置） */
(function (root) {
  'use strict';
  root.TD = root.TD || {};
  root.TD.Pages = root.TD.Pages || {};
  root.TD.TPL = root.TD.TPL || {};

  root.TD.TPL.goalEdit =
    '<main class="w-full max-w-md mx-auto px-4">' +
    '<header class="sticky top-0 z-30 -mx-4 mb-4 flex items-center justify-between border-b border-[var(--diary-border)] bg-[var(--diary-background)]/95 px-4 backdrop-blur" style="height:calc(3.5rem + var(--safe-top));padding-top:var(--safe-top)">' +
    '<button type="button" data-action="back" class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--diary-muted-foreground)] transition-colors hover:bg-[var(--diary-surface-2)]" aria-label="返回">' +
    '<i data-lucide="x" class="h-5 w-5"></i></button>' +
    '<h1 class="diary-h3" id="page-title">新建目标</h1>' +
    '<button type="button" id="goal-save" class="inline-flex h-9 items-center gap-1 rounded-lg bg-[var(--diary-primary)] px-3 text-[13px] font-semibold text-[var(--diary-primary-ink)] transition-transform hover:-translate-y-0.5" aria-label="保存目标">' +
    '<span class="whitespace-nowrap">保存</span></button>' +
    '<button type="button" id="rec-delete" class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--state-error)] transition-colors hover:bg-[var(--diary-surface-2)]" aria-label="删除目标">' +
    '<i data-lucide="trash-2" class="h-5 w-5"></i></button>' +
    '</header>' +
    '<section class="diary-card px-4 py-4">' +
    '<label for="goal-name" class="mb-1.5 block text-[13px] font-medium text-[var(--diary-foreground)]">目标名称</label>' +
    '<input id="goal-name" type="text" aria-label="目标名称" class="h-11 w-full rounded-xl border border-[var(--diary-input)] bg-[var(--diary-surface)] px-3 text-[15px] text-[var(--diary-foreground)] outline-none transition-shadow placeholder:text-[var(--diary-muted-foreground)] focus:ring-2 focus:ring-[var(--diary-ring)]" placeholder="如：每天阅读 30 分钟" />' +
    '<p class="mt-1.5 text-[12px] text-[var(--diary-muted-foreground)]">给目标起一个清晰的名字，方便追踪</p>' +
    '</section>' +
    '<section class="diary-card mt-4 px-4 py-4">' +
    '<h2 class="diary-h3 mb-3">目标类型</h2>' +
    '<div class="flex items-center gap-2 rounded-xl border border-[var(--diary-border)] p-1">' +
    '<button type="button" data-gtype="duration" class="cat-pill flex-1 justify-center">时长</button>' +
    '<button type="button" data-gtype="count" class="cat-pill flex-1 justify-center">次数</button></div>' +
    '<div id="duration-inputs" class="mt-3 grid grid-cols-2 gap-3">' +
    '<div><label for="goal-hours" class="mb-1.5 block text-[12px] text-[var(--diary-muted-foreground)]">小时</label>' +
    '<input id="goal-hours" type="number" min="0" max="24" value="1" class="h-11 w-full rounded-xl border border-[var(--diary-input)] bg-[var(--diary-surface)] px-3 text-[15px] text-[var(--diary-foreground)] outline-none transition-shadow focus:ring-2 focus:ring-[var(--diary-ring)]" /></div>' +
    '<div><label for="goal-minutes" class="mb-1.5 block text-[12px] text-[var(--diary-muted-foreground)]">分钟</label>' +
    '<input id="goal-minutes" type="number" min="0" max="59" value="0" class="h-11 w-full rounded-xl border border-[var(--diary-input)] bg-[var(--diary-surface)] px-3 text-[15px] text-[var(--diary-foreground)] outline-none transition-shadow focus:ring-2 focus:ring-[var(--diary-ring)]" /></div></div>' +
    '<div id="count-input" class="mt-3" style="display:none">' +
    '<label for="goal-count" class="mb-1.5 block text-[12px] text-[var(--diary-muted-foreground)]">目标次数</label>' +
    '<input id="goal-count" type="number" min="1" max="99" value="1" class="h-11 w-full rounded-xl border border-[var(--diary-input)] bg-[var(--diary-surface)] px-3 text-[15px] text-[var(--diary-foreground)] outline-none transition-shadow focus:ring-2 focus:ring-[var(--diary-ring)]" /></div>' +
    '<div class="mt-3 flex items-center gap-2 rounded-xl bg-[var(--diary-primary-soft)] px-3 py-2.5">' +
    '<i data-lucide="clock-3" class="h-4 w-4 shrink-0 text-[var(--diary-primary-strong)]"></i>' +
    '<span id="type-hint" class="text-[13px] text-[var(--diary-primary-strong)]">完成进度按所选活动的记录时长自动累计</span></div>' +
    '</section>' +
    '<section class="diary-card mt-4 px-4 py-4">' +
    '<h2 class="diary-h3 mb-3">关联活动</h2>' +
    '<div id="goal-cats" class="flex flex-wrap gap-2"></div>' +
    '</section>' +
    '<section class="diary-card mt-4 px-4 py-4">' +
    '<h2 class="diary-h3 mb-3">重复周期</h2>' +
    '<div class="flex items-center gap-2 rounded-xl border border-[var(--diary-border)] p-1">' +
    '<button type="button" data-period="daily" class="flex-1 whitespace-nowrap rounded-lg py-2 text-[13px] font-medium text-[var(--diary-muted-foreground)] transition-colors">每天</button>' +
    '<button type="button" data-period="weekdays" class="flex-1 whitespace-nowrap rounded-lg py-2 text-[13px] font-medium text-[var(--diary-muted-foreground)] transition-colors">工作日</button>' +
    '<button type="button" data-period="weekly" class="flex-1 whitespace-nowrap rounded-lg py-2 text-[13px] font-medium text-[var(--diary-muted-foreground)] transition-colors">每周</button>' +
    '<button type="button" data-period="once" class="flex-1 whitespace-nowrap rounded-lg py-2 text-[13px] font-medium text-[var(--diary-muted-foreground)] transition-colors">仅一次</button>' +
    '</div></section>' +
    '<section class="diary-card mt-4 flex items-center justify-between px-4 py-4">' +
    '<div class="min-w-0"><h2 class="text-[15px] font-semibold text-[var(--diary-foreground)]">打卡提醒</h2>' +
    '<p class="mt-0.5 truncate text-[12px] text-[var(--diary-muted-foreground)]">每天 20:00 提醒今日目标进度（v1 仅保存设置）</p></div>' +
    '<span id="goal-reminder" class="toggle" role="switch" aria-checked="false" aria-label="打卡提醒开关"></span>' +
    '</section>' +
    '<section class="mt-4 flex items-center justify-center gap-4 px-4 py-4">' +
    '<svg class="h-7 w-7 text-[var(--diary-primary)]" viewBox="0 0 48 48" fill="none" aria-hidden="true">' +
    '<path d="M24 6c-8 0-14 5-14 12 0 4 2 7 5 9v4c0 2 1 3 3 3h12c2 0 3-1 3-3v-4c3-2 5-5 5-9 0-7-6-12-14-12z" fill="var(--diary-primary-tint)"/>' +
    '<circle cx="19" cy="18" r="2" fill="var(--diary-primary)"/>' +
    '<circle cx="29" cy="18" r="2" fill="var(--diary-primary)"/>' +
    '<path d="M20 24c2 2 6 2 8 0" stroke="var(--diary-primary-strong)" stroke-width="2" stroke-linecap="round"/></svg>' +
    '<p class="diary-caption">坚持，时间会给你答案</p>' +
    '<svg class="h-5 w-5 text-[var(--diary-primary-tint)]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M12 2l2.4 6.2L21 9l-5 4.1 1.8 6.4L12 16l-5.8 3.5L8 13.1 3 9l6.6-.8z"/></svg>' +
    '</section>' +
    '</main>';

  root.TD.Pages.goalEdit = async function () {
    var $ = function (id) { return document.getElementById(id); };
    var UI = root.TD.UI, N = root.TD.Notify, DU = root.TD.DateUtil;
    var token = UI.pageToken();

    var q = UI.query();
    var editing = q.id ? await root.TD.Repo.goals.get(q.id) : null;
    var cats = await root.TD.Repo.categories.active();
    if (!UI.still(token)) return;
    var selectedCat = editing ? editing.categoryId : (cats[0] ? cats[0].id : null);
    var period = editing ? editing.period : 'daily';
    var type = editing ? (editing.type || 'duration') : 'duration';
    var reminder = editing ? !!editing.reminder : false;

    /* ---------- 名称 ---------- */
    if (editing) {
      $('goal-name').value = editing.name;
      $('page-title').textContent = '编辑目标';
    } else {
      $('rec-delete').style.display = 'none';
      $('page-title').textContent = '新建目标';
    }

    /* ---------- 类型切换 ---------- */
    function renderType() {
      document.querySelectorAll('[data-gtype]').forEach(function (b) {
        var on = b.getAttribute('data-gtype') === type;
        b.classList.toggle('cat-pill-selected', on);
      });
      $('duration-inputs').style.display = type === 'duration' ? '' : 'none';
      $('count-input').style.display = type === 'count' ? '' : 'none';
      $('type-hint').textContent = type === 'duration'
        ? '完成进度按所选活动的记录时长自动累计'
        : '完成进度按所选活动的记录条数自动累计（每次记录记 1 次）';
    }
    document.querySelectorAll('[data-gtype]').forEach(function (b) {
      b.addEventListener('click', function () { type = b.getAttribute('data-gtype'); renderType(); });
    });

    /* ---------- 时长 / 次数 ---------- */
    if (editing) {
      var t = Number(editing.targetMinutes) || 0;
      $('goal-hours').value = Math.floor(t / 60);
      $('goal-minutes').value = t % 60;
      $('goal-count').value = Number(editing.targetCount) || 1;
    } else {
      $('goal-hours').value = 1;
      $('goal-minutes').value = 0;
      $('goal-count').value = 1;
    }

    /* ---------- 关联分类 ---------- */
    var catBox = $('goal-cats');
    if (!cats.length) {
      catBox.innerHTML = '<p class="diary-caption">还没有分类，请先到「我的 → 活动分类」添加</p>';
    } else {
      catBox.innerHTML = cats.map(function (c) {
        return '<button type="button" class="cat-pill' + (c.id === selectedCat ? ' cat-pill-selected' : '') +
          '" data-cat="' + c.id + '">' + UI.esc(c.name) + '</button>';
      }).join('');
      catBox.querySelectorAll('[data-cat]').forEach(function (b) {
        b.addEventListener('click', function () {
          selectedCat = b.getAttribute('data-cat');
          catBox.querySelectorAll('.cat-pill').forEach(function (x) { x.classList.remove('cat-pill-selected'); });
          b.classList.add('cat-pill-selected');
        });
      });
    }

    /* ---------- 周期 ---------- */
    function renderPeriod() {
      document.querySelectorAll('[data-period]').forEach(function (b) {
        b.classList.toggle('cat-pill-selected', b.getAttribute('data-period') === period);
        b.classList.toggle('bg-[var(--diary-primary-soft)]', b.getAttribute('data-period') === period);
        b.classList.toggle('text-[var(--diary-primary-strong)]', b.getAttribute('data-period') === period);
      });
    }
    document.querySelectorAll('[data-period]').forEach(function (b) {
      b.addEventListener('click', function () { period = b.getAttribute('data-period'); renderPeriod(); });
    });

    /* ---------- 提醒开关（v1 仅保存设置，不触发系统通知） ---------- */
    var toggleEl = $('goal-reminder');
    function renderReminder() { toggleEl.classList.toggle('on', reminder); toggleEl.setAttribute('aria-checked', reminder ? 'true' : 'false'); }
    toggleEl.addEventListener('click', function () { reminder = !reminder; renderReminder(); });

    /* ---------- 保存 / 删除 ---------- */
    async function save() {
      var name = ($('goal-name').value || '').trim();
      if (!name) { N.toast('请填写目标名称', 'error'); return; }
      if (!selectedCat) { N.toast('请选择关联活动', 'error'); return; }
      var input = {
        id: editing ? editing.id : null,
        name: name,
        categoryId: selectedCat,
        type: type,
        period: period,
        startDate: editing ? editing.startDate : DU.startOfDay(Date.now()),
        endDate: editing ? editing.endDate : null,
        reminder: reminder
      };
      if (type === 'duration') {
        var h = parseInt($('goal-hours').value, 10) || 0;
        var m = parseInt($('goal-minutes').value, 10) || 0;
        if (h * 60 + m <= 0) { N.toast('目标时长需大于 0 分钟', 'error'); return; }
        input.targetMinutes = h * 60 + m;
        input.targetCount = null;
      } else {
        var cnt = parseInt($('goal-count').value, 10) || 0;
        if (cnt <= 0) { N.toast('目标次数需大于 0', 'error'); return; }
        input.targetMinutes = null;
        input.targetCount = cnt;
      }
      try {
        await root.TD.Repo.goals.upsert(input);
        N.toast(editing ? '已保存目标' : '已创建目标');
        UI.go('goals');
      } catch (err) {
        N.toast(err.message, 'error');
      }
    }

    async function del() {
      if (!editing) return;
      if (await N.confirm('删除目标', '删除后不可恢复，历史记录不受影响，确定吗？', 'danger')) {
        await root.TD.Repo.goals.remove(editing.id);
        N.toast('已删除目标');
        UI.go('goals');
      }
    }

    renderType();
    renderPeriod();
    renderReminder();
    $('goal-save').addEventListener('click', save);
    $('rec-delete').addEventListener('click', del);
  };
})(typeof window !== 'undefined' ? window : globalThis);
