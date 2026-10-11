/* 页面：引导（模板 + 初始化；首次启动流程；完成后标记 onboarded） */
(function (root) {
  'use strict';
  root.TD = root.TD || {};
  root.TD.Pages = root.TD.Pages || {};
  root.TD.TPL = root.TD.TPL || {};

  root.TD.TPL.onboarding =
    '<style>' +
    '.onboarding-hero { display: block; width: 100%; height: 16rem; object-fit: cover; }' +
    '.h-13 { height: 3.25rem; }' +
    '.h-4\\.5 { height: 1.125rem; }' +
    '.w-4\\.5 { width: 1.125rem; }' +
    '</style>' +
    '<main class="w-full max-w-md mx-auto px-4">' +
    '<section class="relative overflow-hidden rounded-[20px] border border-[var(--diary-border)] bg-[var(--diary-surface)] shadow-[var(--diary-shadow-1)]" style="margin-top:calc(16px + var(--safe-top))">' +
    '<div class="relative">' +
    '<img src="assets/onboarding-hero.jpg" alt="时间日记启动画面插画" class="onboarding-hero h-64 w-full object-cover" />' +
    '<div class="absolute inset-0 bg-gradient-to-t from-[var(--diary-surface)] via-transparent to-transparent"></div></div>' +
    '<div class="relative z-10 -mt-12 px-5 pb-5">' +
    '<h1 class="diary-h1 text-[26px] leading-tight">时间日记</h1>' +
    '<p class="mt-2 text-[14px] leading-6 text-[var(--diary-muted-foreground)]">记录时间 · 分析时间 · 调整时间<br/>把每一天过成想要的样子</p></div>' +
    '</section>' +
    '<section class="mt-4 space-y-3">' +
    '<div class="flex items-center gap-3 rounded-2xl border border-[var(--diary-border)] bg-[var(--diary-surface)] px-4 py-3.5 shadow-[var(--diary-shadow-1)]">' +
    '<span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--diary-primary-soft)] text-[var(--diary-primary-strong)]">' +
    '<i data-lucide="clock-3" class="h-4.5 w-4.5"></i></span>' +
    '<span class="min-w-0 flex-1"><span class="block text-[14px] font-semibold text-[var(--diary-foreground)]">一键记录</span>' +
    '<span class="block truncate text-[12px] text-[var(--diary-muted-foreground)]">开始 / 结束，忘记结束也能自动补录</span></span></div>' +
    '<div class="flex items-center gap-3 rounded-2xl border border-[var(--diary-border)] bg-[var(--diary-surface)] px-4 py-3.5 shadow-[var(--diary-shadow-1)]">' +
    '<span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--diary-primary-soft)] text-[var(--diary-primary-strong)]">' +
    '<i data-lucide="pie-chart" class="h-4.5 w-4.5"></i></span>' +
    '<span class="min-w-0 flex-1"><span class="block text-[14px] font-semibold text-[var(--diary-foreground)]">可视分析</span>' +
    '<span class="block truncate text-[12px] text-[var(--diary-muted-foreground)]">环形图与时间账本，时间去向一目了然</span></span></div>' +
    '<div class="flex items-center gap-3 rounded-2xl border border-[var(--diary-border)] bg-[var(--diary-surface)] px-4 py-3.5 shadow-[var(--diary-shadow-1)]">' +
    '<span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--diary-primary-soft)] text-[var(--diary-primary-strong)]">' +
    '<i data-lucide="target" class="h-4.5 w-4.5"></i></span>' +
    '<span class="min-w-0 flex-1"><span class="block text-[14px] font-semibold text-[var(--diary-foreground)]">目标打卡</span>' +
    '<span class="block truncate text-[12px] text-[var(--diary-muted-foreground)]">设定每日 / 每周目标，持续追踪完成</span></span></div>' +
    '</section>' +
    '<section class="mt-4 flex items-center gap-2.5 rounded-2xl border border-dashed border-[var(--diary-border)] px-4 py-3.5">' +
    '<i data-lucide="shield-check" class="h-4 w-4 shrink-0 text-[var(--state-info)]"></i>' +
    '<p class="min-w-0 flex-1 text-[12px] leading-5 text-[var(--diary-muted-foreground)]">所有数据仅保存在本机，无广告无社区，纯粹的个人时间记录工具</p>' +
    '</section>' +
    '<section class="mt-6">' +
    '<button type="button" id="cta-start" class="inline-flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[var(--diary-primary)] text-[15px] font-semibold text-[var(--diary-primary-ink)] shadow-[var(--diary-shadow-2)] transition-transform hover:-translate-y-0.5 active:translate-y-0">' +
    '<span class="whitespace-nowrap">开始使用</span>' +
    '<i data-lucide="arrow-right" class="h-4.5 w-4.5"></i></button>' +
    '<p class="mt-3 text-center text-[12px] text-[var(--diary-muted-foreground)]">已有记录？数据会自动保留在本地</p>' +
    '</section>' +
    '</main>';

  root.TD.Pages.onboarding = async function () {
    var cta = document.getElementById('cta-start');
    cta.addEventListener('click', async function () {
      await root.TD.Repo.settings.write({ onboarded: true });
      root.TD.Notify.toast('欢迎来到时间日记');
      root.TD.Router.replace('timeline');
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
