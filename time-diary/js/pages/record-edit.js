/* 页面：记录编辑（模板 + 初始化；新增/编辑、进行中、跨天次日、重叠校验） */
(function (root) {
  'use strict';
  root.TD = root.TD || {};
  root.TD.Pages = root.TD.Pages || {};
  root.TD.TPL = root.TD.TPL || {};

  root.TD.TPL.recordEdit =
    '<main class="w-full max-w-md mx-auto px-4">' +
    '<header class="sticky top-0 z-30 -mx-4 mb-4 flex items-center justify-between border-b border-[var(--diary-border)] bg-[var(--diary-background)]/95 px-4 backdrop-blur" style="height:calc(3.5rem + var(--safe-top));padding-top:var(--safe-top)">' +
    '<button type="button" data-action="back" class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--diary-muted-foreground)] transition-colors hover:bg-[var(--diary-surface-2)]" aria-label="返回">' +
    '<i data-lucide="x" class="h-5 w-5"></i></button>' +
    '<h1 class="diary-h3" id="page-title">新增记录</h1>' +
    '<button type="button" id="rec-delete" class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--state-error)] transition-colors hover:bg-[var(--diary-surface-2)]" aria-label="删除记录">' +
    '<i data-lucide="trash-2" class="h-5 w-5"></i></button>' +
    '</header>' +
    '<section class="diary-card px-4 py-4">' +
    '<h2 class="diary-h3 mb-3">活动分类</h2>' +
    '<div id="cat-grid" class="grid grid-cols-4 gap-2"></div>' +
    '</section>' +
    '<section class="diary-card mt-4 px-4 py-4">' +
    '<h2 class="diary-h3 mb-3">时间</h2>' +
    '<div class="grid grid-cols-2 gap-3"><div>' +
    '<label for="rec-start" class="mb-1.5 block text-[12px] text-[var(--diary-muted-foreground)]">开始时间</label>' +
    '<input id="rec-start" type="time" class="h-11 w-full rounded-xl border border-[var(--diary-input)] bg-[var(--diary-surface)] px-3 text-[15px] text-[var(--diary-foreground)] outline-none transition-shadow focus:ring-2 focus:ring-[var(--diary-ring)]" /></div>' +
    '<div><label for="rec-end" class="mb-1.5 block text-[12px] text-[var(--diary-muted-foreground)]">结束时间（留空 = 进行中）</label>' +
    '<input id="rec-end" type="time" class="h-11 w-full rounded-xl border border-[var(--diary-input)] bg-[var(--diary-surface)] px-3 text-[15px] text-[var(--diary-foreground)] outline-none transition-shadow focus:ring-2 focus:ring-[var(--diary-ring)]" /></div></div>' +
    '<div class="mt-3 flex items-center justify-between rounded-xl bg-[var(--diary-primary-soft)] px-3 py-2.5">' +
    '<span class="text-[13px] text-[var(--diary-primary-strong)]">本次时长</span>' +
    '<span id="rec-duration" class="diary-num text-[15px] font-semibold text-[var(--diary-primary-strong)]">--</span></div>' +
    '</section>' +
    '<section class="diary-card mt-4 px-4 py-4">' +
    '<label for="rec-note" class="mb-1.5 block text-[13px] font-medium text-[var(--diary-foreground)]">备注</label>' +
    '<textarea id="rec-note" rows="3" data-draft="record-note" aria-label="备注" placeholder="这段时间做了什么？" class="w-full resize-none rounded-xl border border-[var(--diary-input)] bg-[var(--diary-surface)] px-3 py-2.5 text-[14px] leading-6 text-[var(--diary-foreground)] outline-none transition-shadow placeholder:text-[var(--diary-muted-foreground)] focus:ring-2 focus:ring-[var(--diary-ring)]"></textarea>' +
    '</section>' +
    '<section class="mt-4">' +
    '<button type="button" id="rec-save" class="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--diary-primary)] text-[15px] font-semibold text-[var(--diary-primary-ink)] transition-transform hover:-translate-y-0.5 active:translate-y-0">' +
    '<i data-lucide="check" class="h-5 w-5"></i><span class="whitespace-nowrap">保存记录</span></button>' +
    '</section>' +
    '</main>';

  root.TD.Pages.recordEdit = async function () {
    var $ = function (id) { return document.getElementById(id); };
    var UI = root.TD.UI, DU = root.TD.DateUtil, F = root.TD.Format, N = root.TD.Notify;

    var q = UI.query();
    var cats = await root.TD.Repo.categories.active();
    var editing = q.id ? await root.TD.Repo.records.get(q.id) : null;
    var selectedCat = (editing && editing.categoryId) || q.cat || null;
    var timerHandle = null;

    function baseDayTs() {
      if (editing) return editing.start;
      return DU.keyToTs(q.date) || Date.now();
    }

    /* ---------- 分类网格 ---------- */
    function renderCats() {
      var box = $('cat-grid');
      if (!cats.length) {
        box.innerHTML = '<p class="col-span-4 py-3 text-center diary-caption">还没有分类，请先到「我的 → 活动分类」添加</p>';
        return;
      }
      box.innerHTML = cats.map(function (c) {
        var sel = c.id === selectedCat ? ' cat-selected' : '';
        return '<button type="button" data-cat="' + c.id + '" class="cat-option' + sel +
          ' flex flex-col items-center gap-1.5 rounded-xl border border-[var(--diary-border)] bg-[var(--diary-surface)] px-1 py-2.5 transition-colors">' +
          '<span class="cat-dot" style="--c:' + c.color + '"></span>' +
          '<span class="w-full truncate text-center text-[12px] text-[var(--diary-foreground)]">' + UI.esc(c.name) + '</span></button>';
      }).join('');
      box.querySelectorAll('[data-cat]').forEach(function (b) {
        b.addEventListener('click', function () {
          selectedCat = b.getAttribute('data-cat');
          box.querySelectorAll('.cat-option').forEach(function (x) { x.classList.remove('cat-selected'); });
          b.classList.add('cat-selected');
        });
      });
    }

    /* ---------- 时间默认值 ---------- */
    async function fillTimes() {
      var startTs, endTs;
      if (editing) {
        startTs = editing.start;
        endTs = editing.end;
      } else if (q.ongoing === '1') {
        startTs = Date.now(); /* 开始记录：从现在起，结束留空 = 进行中 */
        endTs = null;
      } else {
        /* 自动补录：默认接续上一条记录的结束时间（AUTOFILL_GAP 内），否则取当前时间 */
        var records = await root.TD.Repo.records.list();
        var le = root.TD.Domain.records.lastEnd(records);
        var now = Date.now();
        if (!q.start && le && le <= now && now - le <= root.TD.Config.AUTOFILL_GAP_MS) {
          startTs = le;
        } else {
          startTs = DU.parseHM(q.start, baseDayTs()) || now;
        }
        endTs = now > startTs ? now : startTs + 30 * 60000;
      }
      $('rec-start').value = DU.formatHM(startTs);
      $('rec-end').value = endTs === null || endTs === undefined ? '' : DU.formatHM(endTs);
      if (editing && editing.end === null) $('rec-end').placeholder = '进行中';
    }

    /* ---------- 时长展示 ---------- */
    function currentRange() {
      var day = baseDayTs();
      var s = DU.parseHM($('rec-start').value, day);
      var eRaw = $('rec-end').value.trim();
      if (!s) return null;
      var e = eRaw ? DU.parseHM(eRaw, day) : null;
      var overnight = false;
      if (e !== null && e < s) { e += DU.DAY_MS; overnight = true; }
      return { start: s, end: e, overnight: overnight };
    }

    function refreshDuration() {
      var r = currentRange();
      var el = $('rec-duration');
      if (!r) { el.textContent = '--'; return; }
      if (r.end === null || r.end === undefined) {
        el.textContent = '进行中 · 已 ' + F.duration((Date.now() - r.start) / 60000);
        if (!timerHandle) {
          timerHandle = setInterval(refreshDuration, 1000);
        }
        return;
      }
      if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
      var text = F.duration((r.end - r.start) / 60000);
      if (r.overnight) text += '（跨至次日）';
      el.textContent = text;
    }

    /* ---------- 保存 / 删除 ---------- */
    async function save() {
      var r = currentRange();
      if (!selectedCat) { N.toast('请先选择活动分类', 'error'); return; }
      if (!r) { N.toast('开始时间无效', 'error'); return; }
      if (r.end !== null && r.end <= r.start) { N.toast('结束时间需晚于开始时间', 'error'); return; }
      try {
        await root.TD.Repo.records.saveRecord({
          id: editing ? editing.id : null,
          categoryId: selectedCat,
          start: r.start,
          end: r.end,
          note: $('rec-note').value.trim()
        });
        try { root.sessionStorage.removeItem('td:draft:record-note'); } catch (e) { /* 忽略 */ }
        N.toast(editing ? '已保存修改' : '已添加记录');
        UI.go('timeline', { date: DU.dateKey(r.start) });
      } catch (err) {
        N.toast(err.message, 'error');
      }
    }

    async function del() {
      if (!editing) return;
      if (await N.confirm('删除记录', '删除后不可恢复，确定吗？', 'danger')) {
        await root.TD.Repo.records.remove(editing.id);
        N.toast('已删除记录');
        UI.go('timeline', { date: DU.dateKey(editing.start) });
      }
    }

    /* 编辑态：删除按钮可见；新增态隐藏 */
    if (!editing) $('rec-delete').style.display = 'none';
    $('page-title').textContent = editing ? '编辑记录' : '新增记录';

    /* 备注草稿：返回后回填（文档第六章） */
    try {
      var draft = root.sessionStorage.getItem('td:draft:record-note');
      if (draft !== null && !editing) $('rec-note').value = draft;
    } catch (e) { /* 忽略 */ }
    $('rec-note').addEventListener('input', function () {
      try { root.sessionStorage.setItem('td:draft:record-note', $('rec-note').value); } catch (e) { /* 忽略 */ }
    });

    renderCats();
    await fillTimes();
    refreshDuration();
    $('rec-start').addEventListener('input', refreshDuration);
    $('rec-end').addEventListener('input', refreshDuration);
    $('rec-save').addEventListener('click', save);
    $('rec-delete').addEventListener('click', del);

    /* 离开页面时清理进行中计时器（路由器卸载旧页前调用） */
    root.TD._leaveHook = function () {
      if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
