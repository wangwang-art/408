---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: 626eed80195b74d1bf570a0768dfed33_ca83876ec15a11f1bc7f525400638852
    ReservedCode1: LNmfFlKWJe6OPpxfdHLZdzOBFLdCsCoMh4ge30c3FZDdHOXDwNofURpul6yGwH+GVfbkirlFnuPpOWIbjUF1ipbA0HPUXG75Icgez5bKtop82L0YdRQJYZVAnJjHJpSDG8hZBUGLDE9Os5ghmVZgCKx8tRvaI1M44duzs29oYCsufM1lWar7N2CqWZk=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: 626eed80195b74d1bf570a0768dfed33_ca83876ec15a11f1bc7f525400638852
    ReservedCode2: LNmfFlKWJe6OPpxfdHLZdzOBFLdCsCoMh4ge30c3FZDdHOXDwNofURpul6yGwH+GVfbkirlFnuPpOWIbjUF1ipbA0HPUXG75Icgez5bKtop82L0YdRQJYZVAnJjHJpSDG8hZBUGLDE9Os5ghmVZgCKx8tRvaI1M44duzs29oYCsufM1lWar7N2CqWZk=
---

# 身体追踪（Body Tracking）

基于 MediaPipe Pose 的摄像头实时人体姿态追踪程序。

## 用途

从摄像头实时检测人体 33 个关键点并绘制骨架连线。使用 MediaPipe Tasks API + `pose_landmarker.task` 模型（适配 mediapipe 1.0.x，该版本已移除 mp.solutions）；若模型文件缺失，脚本会打印下载地址后退出。

## 运行

便携分发场景（推荐）：直接双击本目录下的 `一键启动.bat`，无需安装 Python 环境。

手动运行（需已配置 Python 环境）：

```bash
python body_tracking.py
```

## 退出方式

在预览窗口中按 **q** 键退出。

## 依赖

- `mediapipe`
- `opencv-python`
- 模型文件 `pose_landmarker.task`（可选，已放置于本目录）

安装依赖（如缺失）：

```bash
pip install -r requirements.txt
```

## 模型来源与下载方式

模型：`pose_landmarker_lite.task`（float16 版），MediaPipe 官方地址：

```
https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task
```

下载命令：

```bash
curl -L -o pose_landmarker.task "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
```

若直接下载失败，可配置本机代理重试（如 `http://127.0.0.1:7897`）。模型缺失时运行脚本会提示下载地址并退出。

## 文件清单

| 文件 | 说明 |
| --- | --- |
| `body_tracking.py` | 主程序：Tasks API 摄像头实时姿态追踪，模型缺失时提示下载后退出 |
| `pose_landmarker.task` | MediaPipe 姿态模型（Tasks API 所需，官方下载） |
| `requirements.txt` | 依赖清单 |
