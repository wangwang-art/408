---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: 626eed80195b74d1bf570a0768dfed33_ba425401c14611f1a05452540064ee0f
    ReservedCode1: JO7ZZqF65x8dIoZhUwqJ0KYJ7CICow9J5RPD/xuDmfL/ybIHJSermA8L9LbpXGySHhMRqxV/3rFFx+64vWUztija4r7ElPA0HD/EPbaoaMKMbpDIdDeSvaTV4HLMmr+AzMp56XLrjoLAFNl8Q5cZsBrtm5lQ7flTmutIaHP886FikQK+GvdinApjKfo=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: 626eed80195b74d1bf570a0768dfed33_ba425401c14611f1a05452540064ee0f
    ReservedCode2: JO7ZZqF65x8dIoZhUwqJ0KYJ7CICow9J5RPD/xuDmfL/ybIHJSermA8L9LbpXGySHhMRqxV/3rFFx+64vWUztija4r7ElPA0HD/EPbaoaMKMbpDIdDeSvaTV4HLMmr+AzMp56XLrjoLAFNl8Q5cZsBrtm5lQ7flTmutIaHP886FikQK+GvdinApjKfo=
---

# 脸部追踪（Face Tracking）

基于 MediaPipe Face Landmarker 的摄像头实时人脸关键点追踪程序。

## 用途

从摄像头实时检测人脸 478 个关键点，以 TESSELATION 网格连线绘制人脸网格。使用 MediaPipe Tasks API + `face_landmarker.task` 模型。

## 运行

便携分发场景（推荐）：直接双击本目录下的 `一键启动.bat`，无需安装 Python 环境。

手动运行（需已配置 Python 环境）：

```bash
python face_tracking.py
```

## 退出方式

在预览窗口中按 **q** 键退出。

## 依赖

- `mediapipe`
- `opencv-python`
- 模型文件 `face_landmarker.task`（已放置于本目录，从项目根目录复制）

安装依赖（如缺失）：

```bash
pip install -r requirements.txt
```

## 文件清单

| 文件 | 说明 |
| --- | --- |
| `face_tracking.py` | 主程序：摄像头实时人脸网格/关键点追踪绘制 |
| `face_landmarker.task` | MediaPipe 人脸关键点模型（Tasks API 所需） |
| `requirements.txt` | 依赖清单 |
*（内容由AI生成，仅供参考）*
