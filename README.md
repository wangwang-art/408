# 408

个人项目合集仓库，包含以下子项目：

| 目录 | 项目 | 说明 |
|---|---|---|
| `vocab-app/` | VocabApp 背单词 | React Native + Expo 单词学习应用（SM-2 间隔重复、词典原声发音、学习统计） |
| `time-diary/` | 时间日记 | 二次元风格时间记录 SPA（hash 路由动效、安全区适配、一键记录/时间轴/统计/目标/日记，本地存储 + JSON 备份；Capacitor 打包安卓 APK，见 [Releases](https://github.com/wangwang-art/408/releases)） |
| `workflow/` | ComfyUI 工作流 | AI 绘画工作流 JSON（real to anime 写实转动漫、videoflow H3 视频工作流、z-image 图像生成） |
| `portable_tracking/` | 人体追踪便携包 | MediaPipe 手部/脸部/身体实时追踪（Python + Tasks API，内置一键配置与一键启动，零安装便携分发） |
| `audioqc/` | 音频质检工具 | 规则质检 + DNSMOS 本地无参考音质评估（Gradio/Flask 双界面，内置一键启动，零安装便携分发） |

各子项目内部自带 README 与 .gitignore，可独立浏览。

## 项目速览（技术栈 / 运行前置 / 测试 / 构建）

| 子项目 | 技术栈 | 运行前置 | 常用命令 |
|---|---|---|---|
| `time-diary/` | 原生 HTML/CSS/JS SPA（零构建零依赖）+ Capacitor | Node.js（仅测试与 APK 打包需要） | 测试：`node tests/run.js`；APK 打包见 `time-diary/README.md`（`apk/tools/build-apk.ps1`，工具链路径可参数化） |
| `vocab-app/` | React Native（Expo 52）+ SQLite | Node.js；APK 需 JDK 17 + Android SDK | `npm install` → 测试 `npm test`；lint `npm run lint`；APK `npm run build:apk` |
| `audioqc/` | Python（Flask/Gradio 双界面 + ONNX 推理） | 双击一键配置（内置嵌入式 Python 自动下载） | 双击 `audioqc\一键配置.bat`，完成后 `一键启动.bat`（Gradio 版）或 `启动Flask版.bat`；依赖清单见 `audioqc/requirements.txt`（全量精确锁定） |
| `portable_tracking/` | Python（MediaPipe Tasks API） | 摄像头 + 双击一键配置 | 双击 `portable_tracking\一键配置.bat`，完成后运行各子目录 `一键启动.bat`；依赖锁定于 `portable_tracking/requirements.txt` |
| `workflow/` | ComfyUI 工作流资产 | ComfyUI | 直接导入 `workflow/*.json` |

> **体积约定**：各子项目的 `runtime/`（嵌入式 Python 免安装环境）、`time-diary/apk/` 构建环境、根目录 `project/` 本地工作区均被 `.gitignore` 排除、不入库；fresh clone 后按上表「运行前置」重新配置即可。
