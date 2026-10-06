# VocabApp 项目交接文档（经验总结）

> 本文档总结 VocabApp（背单词 React Native app）开发过程中遇到的全部问题、根因与解决方案，
> 供后续接手开发的 AI 直接复用，避免重复踩坑。

---

## 1. 项目概况

- 技术栈：React Native + Expo SDK 52（Expo Router 之外的 Stack 导航），SQLite（expo-sqlite），expo-av 播放音频
- 位置：`vocab-app/`
- 词表：CET-4 4537 词 + CET-6 2165 词 + IELTS 1319 词，共 8021 词（`src/data/wordbooks/{cet4,cet6,ielts}.json`）
- 构建 APK：
  ```powershell
  $env:JAVA_HOME='<JDK 安装路径>'
  $env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"; $env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
  cd vocab-app/\android
  .\gradlew.bat assembleRelease --project-cache-dir '<gradle 缓存目录>'
  ```
  产物：`android\app\build\outputs\apk\release\app-release.apk`，导出为项目根目录 `VocabApp-v1.0.0-release.apk`，用 `adb install -r` 安装。
- 核心模块：
  - `src/services/VocabManager.js`：业务门面（今日学习/复习队列、每日配额、困难词）
  - `src/services/StorageService.js`：SQLite 封装（progress / tags / review_log / settings 四张表）
  - `src/services/SrsScheduler.js`：SM-2 间隔重复算法
  - `src/services/TtsService.js`：发音服务（四级播放链 + 批量下载）
  - `src/screens/`：Home / Review / Stats / WordList / WordDetail
  - `src/components/`：FlashCard（3D 翻转卡）、ProgressBar、RatingButtons、AudioPreloadCard、TagManager、BookSelector

---

## 2. 发音方案演进（最重要的决策）

### 2.1 为什么放弃系统 TTS 引擎
- 初始用 `expo-speech`，小米手机默认走 `com.xiaomi.mibrain`（小米引擎），音质差。
- 尝试切 Google TTS：`adb shell settings put secure tts_default_synth com.google.android.tts` 可以改设置值，但需要"USB 调试（安全设置）"权限（小米的开发者选项开关，需登录小米账号），且 **Google TTS 语音包国内网络无法下载**（`/data/data/com.google.android.tts/files/` 为空），实际合成永远失败并回退小米。
- **结论：国内环境不要依赖 Google TTS，也不要依赖任何系统 TTS 引擎。**

### 2.2 最终方案：词典原声（app 内下载 + 本地缓存）
- 主源（有道，标准美音，国内直连）：
  `https://dict.youdao.com/dictvoice?audio={word}&type=2`
  （`type=2` 美音，`type=1` 英音；约 10-20KB/词）
- 备源（百度翻译，有道偶发失败时兜底）：
  `https://fanyi.baidu.com/gettts?lan=en&text={word}&spd=3&source=web`
- 缓存路径：`FileSystem.documentDirectory + audio/{bookTag}/{word}.mp3`（见 `src/utils/fileHelper.js`）
- 播放链（`TtsService.speak`，严格按序）：
  1. 本地缓存 mp3（存在即播）
  2. 未缓存 → 即时下载该词并播放（单请求很快）
  3. 打包进 APK 的 mp3（少量高频词）
  4. 系统 TTS 兜底

### 2.3 依赖与打包注意
- 用 `expo-av`（`Audio.Sound`）播放本地文件；从打包资源读必须 `Asset.fromModule(mod).downloadAsync()` 后再用 `localUri`。
- **APK 里的打包 mp3 会落在 `res/` 目录而非 `assets/`**（RN 原生打包机制），检查是否打进包用：
  ```powershell
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip=[System.IO.Compression.ZipFile]::OpenRead($apk)
  $zip.Entries | Where-Object { $_.FullName -like 'res/*.mp3' } | Measure-Object
  ```
  看到 `res/` 下 43 个 mp3 属正常，不要误判为丢失。

---

## 3. 高频踩坑与修复（务必先读）

### 3.1 下载进度条"重进就重来 / 永远下不完"
- **症状**：每次重进 app 进度从 0 重算；显示"下不完"；或进度条不动但文件确实在下。
- **根因（三个叠加）**：
  1. `batchDownload` 的计数从 0 开始，没把已存在文件计入基数 → 重进看着像重下；
  2. 进度只统计"成功数"，只要有个别词失败，`succeeded` 永远到不了 total → 进度条卡住；
  3. App 回前台自动触发全量下载，完成标记只在内存（`bookDoneRef`），重启失效 → 反复重扫 4537 词。
- **修复方案**：
  - 进度按**已处理数 processed** 推进（保证能走到 100%），已下载数单独用 `countCachedAudio()` 作为基数起步；
  - 每词先 `isAudioCached()` 跳过已下载（幂等续传）；
  - 完成状态持久化到 settings 表（key：`audio_done_{bookTag}`），回前台只刷新统计、不再自动重扫；手动点"下载发音"按钮时清除标记允许重试；
  - 失败词不阻塞：播放时按需即时下载补下。
- **教训**：进度条要区分"已处理"与"已成功"两种语义；批量下载必须幂等 + 续传；"是否跑完"要持久化，不能只靠内存标记。

### 3.2 例句网页 404 / 手机端布局错误
- **错误 URL**：`https://dict.youdao.com/example/english/{word}` → **404**（此路径不存在，曾误以为可用）。
- 桌面版可用：`https://dict.youdao.com/w/{word}`（200，但手机上显示桌面布局）。
- **最终手机版（正确）**：`https://dict.youdao.com/m/result?word={word}&lang=en`（200，SSR 页面含音标/释义/例句，移动端自适应）。
- **教训**：外链 URL 必须先用 curl 实测（HTTP 状态码 + 页面内容是否含目标词），不能凭经验猜；给手机端要优先用 `m.` 子域或移动端 URL。

### 3.3 adb 自动化点击不可靠
- 小米手机 `adb shell input tap` 常静默失败；`uiautomator dump` 报 `ERROR: could not get idle state.`（重试或加延迟可缓解）。
- 需要"USB 调试（安全设置）"权限才能 `input` 注入与 `settings put`，用户未授权时不要反复尝试。
- **正确做法**：让用户手动操作 UI；用 `uiautomator dump /sdcard/ui.xml` + `adb shell cat` 解析文本坐标做只读验证即可。

### 3.4 无 root 读不到 app 私有目录 → 误判
- `adb shell ls /data/data/com.vocabapp.learner/files/...` 在无 root 时返回空，曾导致误判"下载从未成功"。
- 实际上 app 内下载正常（用户反馈"发音没问题，是有道的声音"）。
- **正确做法**：功能是否生效以 UI 状态 + 用户反馈为准（`uiautomator dump` 看界面文本），不要依赖读取私有目录。

### 3.5 每日配额"超发"bug
- **症状**：今日已学 6 个词后，按钮仍显示"剩 30 个"，会把用户带进 36 个词。
- **根因**：队列截取用完整 `limit`，没用 `limit - 今日已学`。
- **修复**：`remaining = Math.max(0, limit - learned)`，其中 `learned` 来自 `getTodayStats()`（按词去重统计，会话内重试会产生同词多条记录，必须去重）。

### 3.6 数据库表结构迁移
- 新版本加列（review_log.is_new、progress.hard_count），旧库没有：
  ```js
  const cols = await db.getAllAsync('PRAGMA table_info(progress)');
  if (!cols.some((c) => c.name === 'hard_count')) {
    await db.execAsync('ALTER TABLE progress ADD COLUMN hard_count INTEGER DEFAULT 0');
  }
  ```
- settings 表用 `INSERT OR REPLACE` 做 upsert。

### 3.7 词表获取与解析
- 来源：GitHub `mahavivo/english-wordlists`（文件是 `.txt` 不是 `.json`，下载前先 WebFetch 仓库确认文件名）。
- 格式：`abandon [əˈbændən] vt.丢弃；放弃，抛弃`，正则 `^(\S+)\s+\[([^\]]+)\]\s+(.+)$` 解析。
- 词表字段：`{word, phonetic, pos, meaning, example}`。

---

## 4. 已实现功能清单

- 词本选择（CET-4 / CET-6 / IELTS），全局当前词本持久化
- **每日学习（新词）与每日复习（到期词）分离**，各自独立配额，可在首页"调整每日学习/复习量"弹窗自定义（settings 表，词本维度）
- 复习卡片（FlashCard）：3D 翻转、左右滑评分（左=忘记1 / 右=简单5）、发音、标签、长按进详情
- **会话内重试**：评分 ≤ 2 的词重新入队尾，本轮最多再出现 2 次（`MAX_RETRY_PER_SESSION = 2`），保证本次学会；卡片 key 带重试次数强制重挂载恢复正面
- **困难词机制**：`hard_count` 累计失败 ≥ 2（`HARD_WORD_THRESHOLD`）视为困难词，无视 SM-2 排程每天出现在复习队列最前，直到评分 ≥ 3 清零
- SM-2 排程（ef / interval / repetitions / next_review）
- 发音：词典原声四级播放链 + 批量预下载（进度续传、失败不阻塞、完成持久化）
- 单词本页（WordList）：搜索、总词数/已学/困难词统计、每词发音按钮 + 外链例句（有道手机版）、状态徽标（未学/困难/熟悉度 1-5 彩标）
- 单词详情页：发音、标签云、熟悉度滑块、**复习历史**（每次评分记录：颜色圆点+评分文字+学习/复习类型+日期）、重置进度
- 统计页：今日/本周/总计分段、连续打卡、复习次数、正确率、90 天热力图、熟悉度分布环形图、**最近复习记录列表（30 条）**

---

## 5. 遗留/可优化点（供后续迭代）

- 发音批量下载的失败词：目前靠"播放时按需补下"，可加"重新下载失败词"按钮
- 困难词在复习队列无视觉标识（只有排列在前），可加"困难"徽标或不同底色
- 每日配额目前按词本维度存 settings（key 未带 bookTag，实际是全局生效，如需按词本要改 key）
- 热力图 / 复习历史的展示数据量增长后，SQL 可加分页
- 例句跳转目前用系统浏览器，可考虑 app 内 WebView（需评估体验）

---

## 6. 给下一个 AI 的速查表

| 事项 | 结论 |
|---|---|
| 语音源 | 有道 `dictvoice?audio={w}&type=2` + 百度 `gettts` 双源 |
| 例句 URL | `https://dict.youdao.com/m/result?word={w}&lang=en`（手机版） |
| 进度条 | processed（已处理）驱动，succeeded 单独显示，base = countCachedAudio |
| 反复下载 | settings `audio_done_{tag}` 持久化完成标记 |
| 学习/复习 | getNewQueue / getReviewQueue 分离，`remaining = limit - learned` |
| 数据库 | PRAGMA 检查 + ALTER TABLE 兼容旧库 |
| 构建 | 先设 JAVA_HOME / ANDROID_HOME，`--project-cache-dir` 指向临时目录 |
| APK 资源 | 打包 mp3 在 `res/`，用 ZipFile API 检查 |
| 真机验证 | uiautomator dump 看 UI，不读私有目录、不依赖 input 注入 |
