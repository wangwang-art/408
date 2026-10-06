# -*- coding: utf-8 -*-
"""手部实时追踪（MediaPipe Hand Landmarker Tasks API）

使用 hand_landmarker.task 模型，从摄像头实时检测最多 2 只手，
绘制 21 个手部关键点及其连线。

参考项目原 venv/text.py 的写法，修复了其中的乱码注释；
适配 mediapipe 1.0.x（该版本已移除 mp.solutions，改用 tasks 自带 drawing_utils）。

退出方式：在预览窗口中按 q 键退出。
"""
import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from mediapipe.tasks.python.vision import drawing_styles, drawing_utils
from mediapipe.tasks.python.vision.hand_landmarker import HandLandmarksConnections

BASE_OPTIONS = python.BaseOptions(model_asset_path="hand_landmarker.task")
OPTIONS = vision.HandLandmarkerOptions(
    base_options=BASE_OPTIONS,
    running_mode=vision.RunningMode.VIDEO,   # 视频流模式，需配合时间戳
    num_hands=2,                              # 最多检测 2 只手
    min_hand_detection_confidence=0.5,
    min_hand_presence_confidence=0.5,
)

cap = cv2.VideoCapture(0)
if not cap.isOpened():
    raise SystemExit("无法打开摄像头，请检查摄像头设备是否可用")

with vision.HandLandmarker.create_from_options(OPTIONS) as landmarker:
    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            break

        frame = cv2.flip(frame, 1)  # 水平翻转，形成镜像效果
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        timestamp_ms = int(cap.get(cv2.CAP_PROP_POS_MSEC))
        result = landmarker.detect_for_video(mp_image, timestamp_ms)

        for hand_landmarks in result.hand_landmarks:
            drawing_utils.draw_landmarks(
                frame,
                hand_landmarks,
                HandLandmarksConnections.HAND_CONNECTIONS,
                drawing_styles.get_default_hand_landmarks_style(),
                drawing_styles.get_default_hand_connections_style(),
            )

        cv2.imshow("Hand Tracking", frame)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

cap.release()
cv2.destroyAllWindows()
