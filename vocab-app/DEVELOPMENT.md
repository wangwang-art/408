# VocabApp 开发指南

> 本文档面向参与 VocabApp 开发的工程师（含新手），描述项目架构、核心模块、开发规范与常见操作流程。

---

## 一、项目概览

VocabApp 是一个基于 **React Native + Expo** 的单词学习应用，核心功能：

- 多词本学习（CET-4 / CET-6 / IELTS）
- SM-2 间隔重复算法排程复习
- 词典原声发音下载与播放（有道/百度 → 系统 TTS 兜底）
- 学习统计（热力图、熟悉度分布、连续打卡）

**技术栈**：Expo SDK 52 / React Native 0.76 / expo-sqlite（本地持久化）/ react-navigation（导航）

---

## 二、架构分层

应用采用 **四层架构**，依赖方向严格自上而下：

```
┌─────────────────────────────────────────────┐
│  UI 层 (screens / components)                │  ← 只调用服务层，不直接碰数据库
├─────────────────────────────────────────────┤
│  服务层 (services)                           │  ← 业务逻辑编排
│  VocabManager · AudioDownloadService         │
│  TtsService · SrsScheduler                   │
│  ExampleCrawlerService                       │
├─────────────────────────────────────────────┤
│  数据层 (StorageService)                     │  ← 纯 SQL 操作，无业务判断
├─────────────────────────────────────────────┤
│  持久化 (SQLite · 文件系统)                   │
└─────────────────────────────────────────────┘
        ↑ 支撑层
  config.js（常量）· theme.js（设计令牌）
  AppContext（全局状态）· utils（工具函数）
```

### 分层规则

| 规则 | 说明 |
|------|------|
| UI 层不直接 import StorageService | 所有数据访问通过 VocabManager 门面方法 |
| 服务层不 import React | 服务层是纯 JS，可在 Jest 中直接测试 |
| config.js / theme.js 是唯一事实源 | 颜色、常量、阈值统一定义，不散落各文件 |
| settings key 必须带词本维度 | 用 `SETTING_KEY.xxx(bookTag)` 生成，禁止硬编码 |

---

## 三、目录结构

```
vocab-app/
├── App.js                     # 根组件：初始化 DB + 组装 Provider
├── app.json                   # Expo 配置
├── babel.config.js            # Babel 配置（babel-preset-expo）
├── package.json               # 依赖 + Jest 配置
│
├── src/
│   ├── config.js              # 应用常量（词本列表/SM-2参数/配额/SETTING_KEY）
│   ├── theme.js               # 设计令牌（颜色/评分色/工具函数）
│   │
│   ├── context/
│   │   └── AppContext.js      # 全局状态（当前词本/音频下载进度）
│   │
│   ├── navigation/
│   │   └── AppNavigator.js    # Stack 导航配置
│   │
│   ├── screens/               # 页面组件（5 个）
│   │   ├── HomeScreen.js      #   首页：词本选择 + 今日学习/复习 + 预下载
│   │   ├── ReviewScreen.js    #   复习页：卡片翻转 + 评分
│   │   ├── WordListScreen.js  #   词表页：全部单词列表
│   │   ├── WordDetailScreen.js#   详情页：单词信息 + 标签 + 熟悉度
│   │   └── StatsScreen.js     #   统计页：热力图 + 熟悉度分布
│   │
│   ├── components/            # 可复用 UI 组件
│   │   ├── RatingButtons.js   #   评分按钮组（1~5）
│   │   ├── FlashCard.js       #   翻转卡片
│   │   ├── BookSelector.js    #   词本选择器
│   │   ├── AudioPreloadCard.js#   音频下载进度卡片
│   │   ├── ProgressBar.js     #   进度条
│   │   └── TagManager.js      #   标签管理
│   │
│   ├── services/              # 业务服务层
│   │   ├── VocabManager.js    #   词汇管理门面（单例工厂）
│   │   ├── StorageService.js  #   SQLite 存储服务（迁移机制）
│   │   ├── SrsScheduler.js    #   SM-2 间隔重复算法
│   │   ├── TtsService.js      #   发音服务（下载 + 播放 + 兜底链）
│   │   ├── AudioDownloadService.js # 音频预下载编排
│   │   └── ExampleCrawlerService.js # 例句/释义抓取服务（爬取后缓存）
│   │
│   ├── utils/
│   │   ├── dateHelper.js      #   日期工具（ISO 格式/加减天/比较）
│   │   ├── fileHelper.js      #   文件路径工具
│   │   ├── audioAssets.js     #   打包音频资源映射
│   │   └── exampleParser.js   #   有道返回解析（纯函数，可测试）
│   │
│   └── data/
│       └── wordbooks/         #   词库 JSON（cet4/cet6/ielts）
│
├── __tests__/                 # Jest 单元测试
│   ├── SrsScheduler.test.js
│   └── dateHelper.test.js
│
├── assets/                    # 打包资源（图标/音频）
├── tools/                     # 辅助脚本（音频下载/词库转换/APK 构建）
└── .gitignore
```

---

## 四、核心模块说明

### 4.1 契约层：config.js + theme.js

**config.js** 集中管理所有应用常量：

```js
// 词本配置
export const AVAILABLE_BOOKS = ['cet4', 'cet6', 'ielts'];

// SM-2 算法参数
export const SM2_DEFAULT_EF = 2.5;
export const SM2_MIN_EF = 1.3;

// 业务阈值
export const HARD_WORD_THRESHOLD = 2;       // 困难词判定
export const MAX_RETRY_PER_SESSION = 2;     // 会话内重试上限

// settings 表 key 命名空间（按词本隔离）
export const SETTING_KEY = {
  dailyNewLimit: (bookTag) => `daily_new_limit_${bookTag}`,
  dailyReviewLimit: (bookTag) => `daily_review_limit_${bookTag}`,
  audioDone: (bookTag) => `audio_done_${bookTag}`,
};
```

**theme.js** 集中管理视觉常量与工具函数：

```js
export const colors = { primary: '#4A90D9', success: '#30A46C', ... };
export const rateColors = ['#E5484D', '#F76B15', '#FFB020', '#46A758', '#30A46C'];
export const rateLabels = ['忘记', '困难', '模糊', '顺利', '简单'];

// 熟悉度计算（从 progress 行推导 1~5 档）
export function familiarityFromProgress(progress) { ... }
// 热力图颜色（按复习次数取档位）
export function colorForHeat(count) { ... }
```

> **原则**：新增颜色或常量时，加到 config.js 或 theme.js，不要在组件内硬编码。

### 4.2 数据层：StorageService

负责所有 SQLite 操作，特点：

- **Promise 单例连接**：`getDB()` 返回缓存的数据库连接 Promise
- **user_version 迁移机制**：schema 变更通过版本化迁移管理（见下文）
- **纯 SQL 操作**：不含业务逻辑，只做 CRUD

### 4.3 服务层

#### VocabManager（词汇管理门面）

面向单个词本的业务门面，组合词库数据 + 存储 + 排程算法：

```js
// 单例工厂：同一 bookTag 全局复用同一实例
const manager = VocabManager.for('cet4');

// 门面方法（UI 层只需这些，不需要直接调 StorageService）
await manager.getNewQueue();          // 今日新词队列（未学会词反复出现直到学会）
await manager.getReviewQueue();       // 今日复习队列（只排除已学会词）
await manager.updateReview(word, 5);  // 提交评分 → SM-2 计算并落库
await manager.getAllProgress();       // 全部单词进度（含标签）
await manager.getReviewLogs();        // 复习日志（打卡/统计用）
await manager.getWordReviewLogs(word);// 单词复习历史
await manager.getDailyLimits();       // 读取配额（按词本独立）
await manager.setDailyLimits({newLimit, reviewLimit});
```

> **关键**：UI 层统一用 `VocabManager.for(bookTag)`，不要 `new VocabManager(bookTag)`。

#### AudioDownloadService（音频预下载编排）

封装批量下载、进度上报、完成标记：

```js
await AudioDownloadService.isPreloaded('cet4');   // 是否已完整下载过
await AudioDownloadService.preloadBook('cet4', {  // 批量预下载
  onProgress: (processed, total, succeeded) => { ... },
  isCancelled: () => shouldCancel,
});
await AudioDownloadService.countCached('cet4');   // 已缓存数
```

#### ExampleCrawlerService（例句/释义抓取，爬取后缓存）

为单词卡片提供"完整释义 + 双语例句"，数据源为有道词典 JSON 接口（与在线例句/发音同源）。

**缓存策略（核心约定）**：

- 读取一律缓存优先：命中 `word_cache` 表直接返回，不发网络请求
- 未命中才抓取：成功解析后立即写入 `word_cache`，之后永远命中
- 抓取失败（无网络/超时/解析失败）静默返回 null，UI 回退词库自带数据

```js
await ExampleCrawlerService.readCachedInfos(words); // 批量读缓存（纯本地，首屏用）
await ExampleCrawlerService.getWordInfo(word);      // 缓存优先，未命中则抓取
await ExampleCrawlerService.ensureInfos(words);     // 批量补齐（只抓缺失词，并发受限）
```

解析逻辑（`utils/exampleParser.js`）为纯函数，已用真实接口返回结构覆盖单测。
卡片展示时通过 `pickRandomExample` 从缓存例句中随机选一条，每次出现可能是新句子。

> **近似词防护（重要）**：有道 jsonapi_s 接口对无法精确匹配的词会返回"近似词"词条
> （实测 aid -> 字母 x 的词条、although -> tip-up 的词条），若直接解析会得到错误的
> 含义与例句并被缓存。因此 `parseYoudaoResponse(json, queryWord)` 必须传入查询词，
> 内部校验词条头（`return-phrase`，兼容字符串与 `{l:{i}}` 对象两种格式）与查询词
> 归一化匹配（小写、去连字符/空格），不匹配则返回 null、不写缓存。新增解析/校验
> 逻辑时务必保持此约束。

> **UI 接入**：学习/复习页加载队列后，先 `getCachedWordInfos` 用缓存渲染首屏，
> 再后台 `ensureWordInfos` 补齐未缓存词并合并回卡片；详情页用 `getWordInfo` 展示完整含义与例句。

#### SrsScheduler（SM-2 算法）

纯函数，无副作用，输入当前进度 + 评分，输出新进度：

```js
const next = SrsScheduler.calculate(currentProgress, rating);
// → { ef, interval, repetitions, next_review, last_review }
```

> **遗忘处理约定**：评分 1/2（没记住）时 `interval = 0`，`next_review = 今天`。
> 配合队列逻辑"未学会的词当天不排除"，没学会的词会反复出现直到学会（评分 >= 3），
> 而不是推到明天导致当天"已学完"却仍有未学会的词。

### 4.4 全局状态：AppContext

使用 `useReducer` 管理全局状态：

| 状态 | 说明 |
|------|------|
| `currentBookTag` | 当前选中词本（null = 未选择） |
| `isAudioPreloading` | 是否正在批量下载音频 |
| `preloadProgress` | 下载进度 `{completed, total}` |

```js
const { state, selectBook, startPreload, updatePreload, finishPreload } = useApp();
```

---

## 五、数据库迁移机制

### 原理

SQLite 内置 `PRAGMA user_version`（整数）记录 schema 版本。`initDB()` 启动时读取当前版本，依次执行后续迁移：

```
v1 → 建表（progress / tags / review_log / settings + 索引）
v2 → 补列（hard_count / is_new，兼容极早期版本）
v3 → settings key 命名空间迁移（全局 key → 按词本 key）
v4 → 例句/释义抓取缓存表（word_cache：word / meaning / examples / source / fetched_at）
v5 → 清空 word_cache（修复有道"近似词"错误缓存，见 exampleParser 说明）
```

### 如何新增迁移

1. 在 `StorageService.js` 末尾添加迁移函数（**必须幂等**）：

```js
async function migrate_v4(db) {
  // 示例：给 progress 表加新列
  const cols = await db.getAllAsync('PRAGMA table_info(progress)');
  if (!cols.some((c) => c.name === 'example_field')) {
    await db.execAsync('ALTER TABLE progress ADD COLUMN example_field TEXT');
  }
}
```

2. 注册到 migrations 数组并 bump `DB_VERSION`：

```js
const migrations = [migrate_v1, migrate_v2, migrate_v3, migrate_v4];
const DB_VERSION = 4;
```

> **注意**：迁移函数必须幂等（重复执行不报错），因为中途失败会在下次启动时重试。

---

## 六、开发规范

### 6.1 settings key 必须用 SETTING_KEY

```js
// ✅ 正确：通过 SETTING_KEY 生成，自动带词本维度
await StorageService.setSetting(SETTING_KEY.dailyNewLimit(bookTag), '20');

// ❌ 错误：硬编码 key，切换词本会互相覆盖
await StorageService.setSetting('daily_new_limit', '20');
```

### 6.2 VocabManager 用单例工厂

```js
// ✅ 正确：单例工厂，同一词本复用实例
const manager = VocabManager.for(bookTag);

// ❌ 错误：每次 new 创建新实例，浪费内存
const manager = new VocabManager(bookTag);
```

### 6.3 UI 层不直接依赖 StorageService

```js
// ✅ 正确：通过 VocabManager 门面方法
const logs = await manager.getReviewLogs();

// ❌ 错误：UI 层直接 import StorageService
import * as StorageService from '../services/StorageService';
const logs = await StorageService.getReviewLogs(bookTag);
```

### 6.4 颜色/常量引用 theme / config

```js
// ✅ 正确：从 theme 导入
import { rateColors, familiarityFromProgress } from '../theme';

// ❌ 错误：在组件内定义局部颜色数组
const FAM_COLORS = ['#E5484D', ...];
```

### 6.5 错误处理策略

| 场景 | 策略 |
|------|------|
| 后台操作（下载/统计） | `try/catch` 静默处理 + `console.warn` |
| 用户主动操作（保存/重置） | `try/catch` + `Alert.alert` 提示用户 |
| 应用启动（initDB） | 异常冒泡到 App.js，写入 `vocab-error.log` |

---

## 七、常见开发操作

### 7.1 添加新词本

1. 在 `src/data/wordbooks/` 下创建 JSON 文件（如 `toefl.json`），格式：
   ```json
   [{"word":"abandon","phonetic":"əˈbændən","meaning":"v. 放弃","pos":"v.","example":"..."}]
   ```
2. 在 `src/data/wordbooks/index.js` 注册
3. 在 `config.js` 的 `AVAILABLE_BOOKS` 和 `BOOK_LABELS` 中添加

### 7.2 添加新页面

1. 在 `src/screens/` 下创建组件文件
2. 在 `src/navigation/AppNavigator.js` 注册路由
3. 用 `VocabManager.for(bookTag)` 获取数据，不要直接 import StorageService

### 7.3 修改数据库结构

按"数据库迁移机制"章节的步骤添加新迁移函数并 bump `DB_VERSION`。

### 7.4 添加新设置项

1. 在 `config.js` 的 `SETTING_KEY` 中添加 key 生成函数（带 bookTag 维度）
2. 在 `VocabManager` 中添加对应的 getter/setter 门面方法
3. UI 层通过门面方法访问

---

## 八、测试

### 运行测试

```bash
npm install     # 首次需安装 jest + babel-jest
npm test        # 运行全部测试
npm run test:watch  # 监听模式
```

### 测试覆盖

| 文件 | 测试内容 |
|------|----------|
| `SrsScheduler.test.js` | SM-2 算法：评分映射、间隔计算、遗忘重置、EF 下限、日期一致性 |
| `dateHelper.test.js` | 日期工具：格式化、加减天、跨月跨年、比较、天数差 |
| `exampleParser.test.js` | 有道返回解析：新旧接口结构、标签清洗、去重截断、随机选句 |

### 编写新测试

纯函数（无 React Native 依赖）直接用 `require` 导入测试：

```js
const { calculate } = require('../src/services/SrsScheduler');

test('首次复习评5分：interval=1', () => {
  const result = calculate(null, 5);
  expect(result.interval).toBe(1);
});
```

依赖当前日期的函数，用 `jest.mock` 固定日期：

```js
jest.mock('../src/utils/dateHelper', () => ({
  todayISOString: () => '2026-01-15',
  addDays: (iso, n) => { /* 简单日期运算 */ },
}));
```

---

## 九、构建与部署

### 开发调试

```bash
npm start          # 启动 Metro 开发服务器
npm run android    # 构建并安装到 Android 设备/模拟器
```

### 发布构建

```bash
# 使用项目内脚本构建 Release APK
./tools/build-apk.ps1
# 或手动：
cd android && ./gradlew assembleRelease
# 产物：android/app/build/outputs/apk/release/app-release.apk
```

> APK 文件已加入 `.gitignore`，不要提交到版本库。

---

## 十、待优化事项

以下为已知但尚未完成的项目，供后续迭代参考：

| 事项 | 说明 |
|------|------|
| 设计稿归档 | `pages/`、`partials/`、`colors_and_type.css` 等设计稿文件建议移至 `design/` 目录 |
| StyleSheet 颜色迁移 | 各 screen 的 StyleSheet 仍有硬编码颜色，可逐步迁移引用 `theme.colors` |
| 服务层测试覆盖 | VocabManager / AudioDownloadService 的集成测试（需 mock SQLite） |
| 暗色主题 | theme.js 已定义颜色体系，可扩展 `colors.dark` 支持 dark mode |
