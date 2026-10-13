# Changelog

本仓库变更记录。`apk`、`workflow`、`time-diary-v1.2.2`、`time-diary-v1.2.3` 四个条目由既有 tag 与提交历史回溯整理。

提交规范：`type: 中文描述 (版本号)`，`type` 取值 `feat` / `fix` / `perf` / `docs` / `chore` / `ci` / `build`。

## [未发布]

- `chore`: 新增根 `.editorconfig`，统一编码（UTF-8）、换行（LF）与缩进约定。
- `chore`: 新增根 `.gitattributes`，统一仓库换行并显式声明二进制类型。
- `docs`: 新增本 `CHANGELOG.md`。

## time-diary-v1.2.3 — 2026-10-12

- `perf`: 页面切换改为即时渲染——旧页立即移除、仅入场动画，取消输入锁与排队。
- 对应提交：`e19f0d1`。

## time-diary-v1.2.2 — 2026-10-12

- `fix`: 页面切换并发治理——快速导航合并对账、退出动画不透视、生命周期令牌、错误去重。
- 对应提交：`150fd23`。

## apk / workflow — 2026-10-06

- 两个 tag（`apk`、`workflow`）指向同一提交 `07e65fe`（`Delete workflow`）。
- 同期相关提交：`452074b`（Create workflow）、`b0f71af`（Add ComfyUI workflow files）、`9613541`（add workflow demo assets and effect showcase to workflow README）。

## 版本标记对照

| tag | 日期 | 指向提交 | 提交说明 |
|---|---|---|---|
| `apk` | 2026-10-06 | `07e65fe` | Delete workflow |
| `workflow` | 2026-10-06 | `07e65fe` | Delete workflow |
| `time-diary-v1.2.2` | 2026-10-12 | `150fd23` | fix: 页面切换并发治理 (v1.2.2) |
| `time-diary-v1.2.3` | 2026-10-12 | `e19f0d1` | perf: 页面切换改为即时渲染 (v1.2.3) |
