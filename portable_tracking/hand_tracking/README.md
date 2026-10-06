---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: 626eed80195b74d1bf570a0768dfed33_b94cc612c14611f1a05452540064ee0f
    ReservedCode1: TwCDXy7cjROdjii2SsDfBsN5Nz2nTWmFWghRt71PTbYwGFHkFU7yOSarVgIwS+s4B3zJOWUwRp3e3iqPAUi1igS/sL1YhtmJGRiv0fY0xrdqNHsT3T+rJssvetgXI13zbM8jIHsTvGQKUfTvPqaCnz35AfpwGL4DDmzxnHFMckYJYSlyP0umn1YbH1I=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: 626eed80195b74d1bf570a0768dfed33_b94cc612c14611f1a05452540064ee0f
    ReservedCode2: TwCDXy7cjROdjii2SsDfBsN5Nz2nTWmFWghRt71PTbYwGFHkFU7yOSarVgIwS+s4B3zJOWUwRp3e3iqPAUi1igS/sL1YhtmJGRiv0fY0xrdqNHsT3T+rJssvetgXI13zbM8jIHsTvGQKUfTvPqaCnz35AfpwGL4DDmzxnHFMckYJYSlyP0umn1YbH1I=
---

# 手部追踪（Hand Tracking）

基于 MediaPipe Hand Landmarker 的摄像头实时手部关键点追踪程序。

## 用途

从摄像头实时检测最多 2 只手，绘制 21 个手部关键点及其连线。参考项目原 `venv/text.py` 的写法，已修复其中的乱码注释，并改用 MediaPipe Tasks API + `hand_landmarker.task` 模型。

## 运行

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
*（内容由AI生成，仅供参考）*
