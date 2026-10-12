/* 页面：个人资料（模板 + 初始化；身份统计、分类入口、导入导出、外观切换、关于） */
(function (root) {
  'use strict';
  root.TD = root.TD || {};
  root.TD.Pages = root.TD.Pages || {};
  root.TD.TPL = root.TD.TPL || {};

  root.TD.TPL.profile =
    '<style>' +
    '.identity-card { background: linear-gradient(150deg, var(--diary-primary-soft) 0%, var(--diary-primary-tint) 100%); border-color: var(--diary-primary-tint); box-shadow: var(--diary-shadow-1); }' +
    '.mascot-banner { display: block; width: 100%; height: 10rem; object-fit: cover; }' +
    '.stats-value { font-size: 24px; font-weight: 700; letter-spacing: -0.01em; white-space: nowrap; color: var(--diary-foreground); }' +
    '.profile-footer { padding: 20px 0 8px; }' +
    '</style>' +
    '<main class="w-full max-w-md mx-auto px-4">' +
    '<section class="diary-card identity-card relative overflow-hidden" style="margin-top:calc(16px + var(--safe-top))">' +
    '<div class="relative">' +
    '<img src="assets/mascot-window.jpg" alt="看板娘·窗边书桌插画" class="mascot-banner h-40 w-full object-cover" />' +
    '<span class="absolute right-3 top-3 inline-flex h-6 items-center gap-1 rounded-full bg-[var(--diary-surface)]/90 px-2.5 text-[11px] font-medium text-[var(--diary-primary-strong)] backdrop-blur">' +
    '<i data-lucide="sparkles" class="h-3.5 w-3.5"></i><span class="whitespace-nowrap">守护你的时间</span></span></div>' +
    '<div class="relative z-10 flex items-center gap-4 p-5 pt-4">' +
    '<div class="min-w-0 flex-1"><h2 class="diary-h3 truncate">小时间的守护者</h2>' +
    '<div class="mt-2 flex min-w-0 items-center gap-2">' +
    '<p id="id-days" class="diary-caption truncate">已记录 0 天 · 累计 0</p>' +
    '<span id="id-streak" class="diary-chip diary-chip-primary shrink-0">连续 0 天</span></div></div></div>' +
    '</section>' +
    '<section class="diary-card stats-split mt-4 grid grid-cols-2 divide-x divide-[var(--diary-border)]">' +
    '<div class="min-w-0 px-4 py-4 text-center"><p id="stat-month" class="diary-num stats-value">0</p>' +
    '<p class="diary-caption mt-1 truncate">本月记录</p></div>' +
    '<div class="min-w-0 px-4 py-4 text-center"><p id="stat-week" class="diary-num stats-value">0</p>' +
    '<p class="diary-caption mt-1 truncate">本周专注</p></div>' +
    '</section>' +
    '<section class="diary-card profile-list mt-4 overflow-hidden">' +
    '<button type="button" id="link-category" class="profile-row">' +
    '<span class="profile-row-icon"><i data-lucide="palette" class="h-5 w-5 shrink-0"></i></span>' +
    '<span class="min-w-0 flex-1"><span class="profile-row-title">活动分类</span>' +
    '<span class="profile-row-desc">管理时间分类与颜色</span></span>' +
    '<i data-lucide="chevron-right" class="profile-row-chevron h-4 w-4 shrink-0"></i></button>' +
    '<button type="button" id="theme-row" class="profile-row">' +
    '<span class="profile-row-icon"><i data-lucide="moon" class="h-5 w-5 shrink-0"></i></span>' +
    '<span class="min-w-0 flex-1"><span class="profile-row-title">外观</span>' +
    '<span class="profile-row-desc">浅色 / 深色主题，全站生效</span></span>' +
    '<span id="theme-label" class="profile-row-badge">浅色</span>' +
    '<span id="theme-toggle" class="toggle" role="switch" aria-checked="false" aria-label="深色模式开关"></span></button>' +
    '<button type="button" id="link-export" class="profile-row">' +
    '<span class="profile-row-icon"><i data-lucide="download" class="h-5 w-5 shrink-0"></i></span>' +
    '<span class="min-w-0 flex-1"><span class="profile-row-title">数据导出</span>' +
    '<span class="profile-row-desc">导出 JSON 备份（含 schema 版本）</span></span>' +
    '<i data-lucide="chevron-right" class="profile-row-chevron h-4 w-4 shrink-0"></i></button>' +
    '<button type="button" id="link-import" class="profile-row">' +
    '<span class="profile-row-icon"><i data-lucide="upload" class="h-5 w-5 shrink-0"></i></span>' +
    '<span class="min-w-0 flex-1"><span class="profile-row-title">数据导入</span>' +
    '<span class="profile-row-desc">从 JSON 备份恢复（覆盖当前数据）</span></span>' +
    '<i data-lucide="chevron-right" class="profile-row-chevron h-4 w-4 shrink-0"></i></button>' +
    '<input type="file" id="import-file" accept="application/json,.json" style="display:none" />' +
    '<button type="button" id="link-install" class="profile-row">' +
    '<span class="profile-row-icon"><i data-lucide="smartphone" class="h-5 w-5 shrink-0"></i></span>' +
    '<span class="min-w-0 flex-1"><span class="profile-row-title">安装到桌面</span>' +
    '<span class="profile-row-desc">添加到主屏幕，随时记录</span></span>' +
    '<span class="profile-row-badge">已支持</span>' +
    '<i data-lucide="chevron-right" class="profile-row-chevron h-4 w-4 shrink-0"></i></button>' +
    '<button type="button" id="link-about" class="profile-row">' +
    '<span class="profile-row-icon"><i data-lucide="info" class="h-5 w-5 shrink-0"></i></span>' +
    '<span class="min-w-0 flex-1"><span class="profile-row-title">关于应用</span>' +
    '<span class="profile-row-desc">版本 1.2.2</span></span>' +
    '<i data-lucide="chevron-right" class="profile-row-chevron h-4 w-4 shrink-0"></i></button>' +
    '</section>' +
    '<section class="diary-card mt-4 p-4">' +
    '<div class="flex items-center gap-2">' +
    '<i data-lucide="shield-check" class="h-4 w-4 shrink-0 text-[var(--state-info)]"></i>' +
    '<h3 class="diary-h3">数据与隐私</h3></div>' +
    '<p class="diary-caption mt-2.5">所有数据仅保存在本机浏览器（localStorage），不会上传服务器</p>' +
    '<p class="diary-caption mt-1.5">导出功能可随时备份，卸载应用前请先导出</p>' +
    '</section>' +
    '<footer class="profile-footer"><p class="diary-caption text-center">时间日记 · 记录每一刻的成长</p></footer>' +
    '</main>';

  root.TD.Pages.profile = async function (settings) {
    var $ = function (id) { return document.getElementById(id); };
    var UI = root.TD.UI, DU = root.TD.DateUtil, F = root.TD.Format, N = root.TD.Notify;
    var token = UI.pageToken();

    var records = await root.TD.Repo.records.list();
    if (!UI.still(token)) return;
    var now = Date.now();

    /* ---------- 身份卡统计 ---------- */
    var dayKeys = root.TD.Domain.records.activeDayKeys(records);
    var totalMin = records.reduce(function (s, r) {
      var end = r.end === null ? now : r.end;
      return s + (end > r.start ? (end - r.start) / 60000 : 0);
    }, 0);
    var streak = root.TD.Domain.records.streakDays(records, now);
    $('id-days').textContent = '已记录 ' + dayKeys.length + ' 天 · 累计 ' + F.durationShort(totalMin);
    $('id-streak').textContent = '连续 ' + streak + ' 天';

    var monthSegs = root.TD.Domain.records.segments(records, DU.startOfMonth(now), DU.endOfDay(now), now);
    var ws = DU.startOfWeek(now, settings.weekStart);
    var weekSegs = root.TD.Domain.records.segments(records, ws, ws + 7 * DU.DAY_MS, now);
    $('stat-month').textContent = F.durationShort(root.TD.Domain.records.totalMinutes(monthSegs));
    $('stat-week').textContent = F.durationShort(root.TD.Domain.records.totalMinutes(weekSegs));

    /* ---------- 功能入口 ---------- */
    $('link-category').addEventListener('click', function () { UI.go('category'); });

    /* 导出 JSON */
    $('link-export').addEventListener('click', async function () {
      try {
        await root.TD.Backup.download();
        N.toast('已导出备份文件');
      } catch (err) {
        N.toast('导出失败：' + err.message, 'error');
      }
    });

    /* 导入 JSON */
    var fileInput = $('import-file');
    $('link-import').addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', async function () {
      var file = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      if (!file) return;
      try {
        var text = await file.text();
        var done = await root.TD.Backup.importFromText(text);
        if (done) {
          N.toast('导入成功，即将刷新');
          setTimeout(function () { root.location.reload(); }, 800);
        }
      } catch (err) {
        N.toast('导入失败：' + err.message, 'error');
      }
    });

    /* 安装到桌面（系统引导提示） */
    $('link-install').addEventListener('click', function () {
      N.toast('在浏览器菜单中选择「添加到主屏幕 / 安装应用」即可');
    });

    /* 关于 */
    $('link-about').addEventListener('click', function () {
      N.toast('时间日记 v' + root.TD.Config.VERSION + ' · 数据仅存本机');
    });

    /* ---------- 外观（主题切换，全站生效；整行点击切换） ---------- */
    var themeToggle = $('theme-toggle');
    var themeLabel = $('theme-label');
    function renderTheme() {
      var dark = settings.theme === 'dark';
      themeToggle.classList.toggle('on', dark);
      themeToggle.setAttribute('aria-checked', dark ? 'true' : 'false');
      themeLabel.textContent = dark ? '深色' : '浅色';
    }
    $('theme-row').addEventListener('click', async function () {
      var newTheme = await root.TD.Theme.toggle();
      settings.theme = newTheme; /* Theme.toggle 返回的是主题字符串 */
      renderTheme();
    });
    renderTheme();
  };
})(typeof window !== 'undefined' ? window : globalThis);
