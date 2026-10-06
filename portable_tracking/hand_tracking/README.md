---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: 626eed80195b74d1bf570a0768dfed33_c8cd8da7c15a11f1bc7f525400638852
    ReservedCode1: t41VX3fzkelwRzjepRPYuTW15sEHz3/m/ZfUCi2KzfKxnrIOigXcCdX1UzS+sK5RbKYKD+StRclecAH6ypUpDGqrCfsaVm62juwZWclDshOXRKlOBGgSyrDwvHivTZcdj9zgCx0wG19O8devhGDdDL41WLxJgy4j85wg8JlqSE4E/PeHPNbVgATqHC4=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: 626eed80195b74d1bf570a0768dfed33_c8cd8da7c15a11f1bc7f525400638852
    ReservedCode2: t41VX3fzkelwRzjepRPYuTW15sEHz3/m/ZfUCi2KzfKxnrIOigXcCdX1UzS+sK5RbKYKD+StRclecAH6ypUpDGqrCfsaVm62juwZWclDshOXRKlOBGgSyrDwvHivTZcdj9zgCx0wG19O8devhGDdDL41WLxJgy4j85wg8JlqSE4E/PeHPNbVgATqHC4=
---

# 手部追踪（Hand Tracking）

基于 MediaPipe Hand Landmarker 的摄像头实时手部关键点追踪程序。

## 用途

从摄像头实时检测最多 2 只手，绘制 21 个手部关键点及其连线。参考项目原 `venv/text.py` 的写法，已修复其中的乱码注释，并改用 MediaPipe Tasks API + `hand_landmarker.task` 模型。

## 运行

便携分发场景（推荐）：直接双击本目录下的 `一键启动.bat`，无需安装 Python 环境。

手动运行（需已配置 Python 环境）：

```bash
python hand_tracking.py
```

## 退出方式

在预览窗口中按 **q** 键退出。

## 依赖

- `mediapipe`
- `opencv-python`
- 模型文件 `hand_landmarker.task`（已放置于本目录，从项目根目录复制）

安装依赖（如缺失）：

```bash
pip install -r requirements.txt
```

## 文件清单

| 文件 | 说明 |
| --- | --- |
| `hand_tracking.py` | 主程序：摄像头实时手部关键点追踪与连线绘制 |
| `hand_landmarker.task` | MediaPipe 手部关键点模型（Tasks API 所需） |
| `requirements.txt` | 依赖清单 |
