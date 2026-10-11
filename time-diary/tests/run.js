/* 领域层/工具层测试：node tests/run.js（不依赖浏览器） */
'use strict';

/* 按依赖顺序装载共享脚本（UMD-lite 直接挂到 globalThis） */
require('../js/config/constants.js');
require('../js/utils/id.js');
require('../js/utils/date.js');
require('../js/utils/format.js');
require('../js/db/storage.js');
require('../js/db/migrations.js');
require('../js/repo/repositories.js');
require('../js/domain/records.js');
require('../js/domain/goals.js');
require('../js/domain/stats.js');
require('../js/services/backup.js');

var assert = require('assert');
var TD = globalThis.TD;
var DU = TD.DateUtil, F = TD.Format, DR = TD.Domain.records, DG = TD.Domain.goals, DS = TD.Domain.stats;

var passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (err) {
    failed++;
    console.error('  ✗ ' + name + '\n    ' + err.message);
  }
}

/* 固定"现在"：2026-10-07（周三）12:00 本地时间 */
var NOW = new Date(2026, 9, 7, 12, 0, 0).getTime();
var DAY = DU.startOfDay(NOW);
var MIN = 60000;

console.log('\n[DateUtil]');
test('dateKey 与 keyToTs 互逆', function () {
  var key = DU.dateKey(NOW);
  assert.strictEqual(key, '2026-10-07');
  assert.strictEqual(DU.keyToTs(key), DAY);
});
test('keyToTs 拒绝非法输入', function () {
  assert.strictEqual(DU.keyToTs('2026-13-99'), null);
  assert.strictEqual(DU.keyToTs('abc'), null);
  assert.strictEqual(DU.keyToTs(''), null);
});
test('addDays 跨月', function () {
  assert.strictEqual(DU.addDays('2026-10-31', 1), '2026-11-01');
  assert.strictEqual(DU.addDays('2026-10-07', -7), '2026-09-30');
});
test('startOfWeek 周一起始（weekStart=1）', function () {
  var ws = DU.startOfWeek(NOW, 1);
  assert.strictEqual(DU.dateKey(ws), '2026-10-05'); /* 周一 */
  assert.strictEqual(DU.dateKey(DU.startOfWeek(NOW, 0)), '2026-10-04'); /* 周日 */
});
test('parseHM/formatHM 往返', function () {
  var ts = DU.parseHM('07:30', DAY);
  assert.strictEqual(DU.formatHM(ts), '07:30');
  assert.strictEqual(DU.parseHM('25:00', DAY), null);
  assert.strictEqual(DU.parseHM('12:60', DAY), null);
});
test('startOfMonth/daysInMonth', function () {
  assert.strictEqual(DU.dateKey(DU.startOfMonth(NOW)), '2026-10-01');
  assert.strictEqual(DU.daysInMonth(NOW), 31);
});

console.log('\n[Format]');
test('duration 中文格式', function () {
  assert.strictEqual(F.duration(450), '7小时30分');
  assert.strictEqual(F.duration(60), '1小时');
  assert.strictEqual(F.duration(45), '45分');
  assert.strictEqual(F.duration(0), '0分');
});
test('durationShort', function () {
  assert.strictEqual(F.durationShort(450), '7h30m');
  assert.strictEqual(F.durationShort(120), '2h');
  assert.strictEqual(F.durationShort(5), '5m');
});
test('clock', function () {
  assert.strictEqual(F.clock(32 * 60 + 18), '00:32:18');
  assert.strictEqual(F.clock(0), '00:00:00');
});
test('pct 边界', function () {
  assert.strictEqual(F.pct(0.75), '75%');
  assert.strictEqual(F.pct(0.001), '1%');
  assert.strictEqual(F.pct(0), '0%');
});

/* 测试数据集：跨天睡眠 + 工作 + 进行中 */
var CATS = [
  { id: 'cat_rest', name: '休息', color: '#b9a6e8' },
  { id: 'cat_study', name: '学习', color: '#7fb5d9' },
  { id: 'cat_sport', name: '运动', color: '#f2b86b' }
];
var RECORDS = [
  { id: 'r1', categoryId: 'cat_rest', start: DAY - 60 * MIN, end: DAY + 450 * MIN, note: '' },   /* 昨23:00 → 今07:30 */
  { id: 'r2', categoryId: 'cat_study', start: DAY + 480 * MIN, end: DAY + 690 * MIN, note: '' }, /* 08:00→11:30 */
  { id: 'r3', categoryId: 'cat_rest', start: DAY + 690 * MIN, end: null, note: '' }              /* 11:30 起进行中 */
];

console.log('\n[Domain.records]');
test('跨天记录按天裁剪（读时拆分）', function () {
  var segs = DR.daySegments(RECORDS, DAY, NOW);
  assert.strictEqual(segs.length, 3);
  assert.strictEqual(Math.round(segs[0].minutes), 450); /* 今天只算 0:00-07:30 */
  assert.strictEqual(Math.round(segs[1].minutes), 210);
  assert.strictEqual(Math.round(segs[2].minutes), 30);  /* 进行中算到 now */
});
test('昨天的片段不含今天的部分', function () {
  var ySegs = DR.daySegments(RECORDS, DAY - DU.DAY_MS, DAY - DU.DAY_MS + DU.DAY_MS);
  assert.strictEqual(ySegs.length, 1);
  assert.strictEqual(Math.round(ySegs[0].minutes), 60); /* 昨天只算 23:00-24:00 */
});
test('timelineBlocks 自动补 gap', function () {
  var blocks = DR.timelineBlocks(RECORDS, DAY, NOW);
  assert.strictEqual(blocks[0].type, 'block');  /* 0:00 起即有记录 */
  assert.strictEqual(blocks[1].type, 'gap');    /* 07:30-08:00 */
  assert.strictEqual(Math.round(blocks[1].minutes), 30);
  var last = blocks[blocks.length - 1];
  assert.strictEqual(last.type, 'gap');         /* 12:00-24:00 */
  assert.strictEqual(Math.round(last.minutes), 720);
});
test('totalMinutes / byCategory', function () {
  var segs = DR.daySegments(RECORDS, DAY, NOW);
  assert.strictEqual(Math.round(DR.totalMinutes(segs)), 690);
  var byCat = DR.byCategory(RECORDS, DAY, DAY + DU.DAY_MS, NOW);
  assert.strictEqual(byCat[0].categoryId, 'cat_rest');
  assert.strictEqual(Math.round(byCat[0].minutes), 480);
  assert.strictEqual(byCat[1].categoryId, 'cat_study');
});
test('streakDays 连续记录', function () {
  assert.strictEqual(DR.streakDays(RECORDS, NOW), 2); /* 今+昨 */
  var onlyYesterday = [{ id: 'x', categoryId: 'cat_rest', start: DAY - 120 * MIN, end: DAY - 60 * MIN }];
  assert.strictEqual(DR.streakDays(onlyYesterday, NOW), 1); /* 今天没记，从昨天起算 */
  assert.strictEqual(DR.streakDays([], NOW), 0);
});

console.log('\n[Domain.goals]');
var GOAL_DAILY = { id: 'g1', categoryId: 'cat_study', type: 'duration', targetMinutes: 120, period: 'daily', startDate: 0, endDate: null };
var GOAL_COUNT = { id: 'g2', categoryId: 'cat_sport', type: 'count', targetCount: 3, period: 'weekly', startDate: 0, endDate: null };
test('progress：时长型（含进行中）', function () {
  var p = DG.progress(GOAL_DAILY, RECORDS, NOW, NOW, 1);
  assert.strictEqual(p.unit, 'min');
  assert.strictEqual(Math.round(p.value), 210);
  assert.strictEqual(p.done, true);
});
test('progress：次数型', function () {
  var recs = RECORDS.concat([
    { id: 'r4', categoryId: 'cat_sport', start: DAY + 30 * MIN, end: DAY + 90 * MIN },
    { id: 'r5', categoryId: 'cat_sport', start: DAY - 2 * DU.DAY_MS, end: DAY - 2 * DU.DAY_MS + 60 * MIN }
  ]);
  var p = DG.progress(GOAL_COUNT, recs, NOW, NOW, 1);
  assert.strictEqual(p.unit, 'count');
  assert.strictEqual(p.value, 2); /* 本周两条 */
  assert.strictEqual(p.done, false);
});
test('periodRange：weekly 覆盖整周', function () {
  var r = DG.periodRange(GOAL_COUNT, NOW, 1);
  assert.strictEqual(DU.dateKey(r.start), '2026-10-05');
  assert.strictEqual(r.end - r.start, 7 * DU.DAY_MS);
});
test('isActiveOn：工作日目标周日不生效', function () {
  var sunday = new Date(2026, 9, 11, 10, 0).getTime(); /* 2026-10-11 周日 */
  var g = Object.assign({}, GOAL_DAILY, { period: 'weekdays' });
  assert.strictEqual(DG.isActiveOn(g, sunday), false);
  assert.strictEqual(DG.isActiveOn(GOAL_DAILY, sunday), true);
});
test('weeklyMinutes 折算', function () {
  assert.strictEqual(DG.weeklyMinutes({ period: 'daily', targetMinutes: 30 }), 210);
  assert.strictEqual(DG.weeklyMinutes({ period: 'weekdays', targetMinutes: 30 }), 150);
  assert.strictEqual(DG.weeklyMinutes({ period: 'weekly', targetMinutes: 150 }), 150);
  assert.strictEqual(DG.weeklyMinutes({ period: 'once', targetMinutes: 999 }), 0);
});
test('habitWeek 输出 7 格且未来天未打卡', function () {
  var cells = DG.habitWeek([GOAL_DAILY], RECORDS, NOW, NOW, 1);
  assert.strictEqual(cells.length, 7);
  assert.strictEqual(cells[6].future, true);
  assert.strictEqual(cells[2].done, true); /* 周三学习已达标 */
});

console.log('\n[Domain.stats]');
test('summarize 汇总占比', function () {
  var byCat = DR.byCategory(RECORDS, DAY, DAY + DU.DAY_MS, NOW);
  var s = DS.summarize(byCat, CATS);
  assert.strictEqual(Math.round(s.total), 690);
  assert.strictEqual(s.items[0].name, '休息');
  assert.ok(s.items[0].ratio > 0.6);
});
test('ledger 输出时间段文本', function () {
  var segs = DR.daySegments(RECORDS, DAY, NOW);
  var ledger = DS.ledger(segs, CATS);
  var rest = ledger.find(function (x) { return x.id === 'cat_rest'; });
  assert.ok(rest.ranges[0].indexOf('00:00-07:30') === 0);
});
test('insights 空数据兜底', function () {
  var out = DS.insights({ total: 0, items: [] }, {});
  assert.strictEqual(out.length, 1);
  assert.ok(out[0].indexOf('还没有记录') >= 0);
});

console.log('\n[Backup.validate]');
var GOOD = JSON.stringify({
  app: 'time-diary', schemaVersion: 1, exportedAt: '2026-10-07T00:00:00Z',
  data: { categories: CATS, records: RECORDS, goals: [], diaries: [], settings: {} }
});
test('合法备份通过', function () {
  var v = TD.Backup.validate(GOOD);
  assert.strictEqual(v.ok, true);
});
test('非法 JSON 被拒', function () {
  assert.strictEqual(TD.Backup.validate('{oops').ok, false);
});
test('非本应用文件被拒', function () {
  var v = TD.Backup.validate(JSON.stringify({ app: 'other', schemaVersion: 1, data: {} }));
  assert.strictEqual(v.ok, false);
});
test('缺 schema 版本被拒', function () {
  var v = TD.Backup.validate(JSON.stringify({ app: 'time-diary', data: {} }));
  assert.strictEqual(v.ok, false);
});
test('未来版本被拒', function () {
  var v = TD.Backup.validate(JSON.stringify({ app: 'time-diary', schemaVersion: 99, data: {} }));
  assert.strictEqual(v.ok, false);
});
test('records 缺字段被拒', function () {
  var v = TD.Backup.validate(JSON.stringify({
    app: 'time-diary', schemaVersion: 1,
    data: { categories: [], records: [{ categoryId: 'x' }], goals: [], diaries: [], settings: {} }
  }));
  assert.strictEqual(v.ok, false);
});

console.log('\n----------------------------------------');
console.log('通过 ' + passed + '，失败 ' + failed);
process.exit(failed ? 1 : 0);
