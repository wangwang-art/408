# -*- coding: utf-8 -*-
"""脸部实时追踪（MediaPipe Face Landmarker Tasks API）

使用 face_landmarker.task 模型，从摄像头实时检测脸部 478 个关键点，
以 TESSELATION 网格连线绘制人脸网格。

适配 mediapipe 1.0.x（该版本已移除 mp.solutions，改用 tasks 自带 drawing_utils，
网格连接表来自 FaceLandmarksConnections.FACE_LANDMARKS_TESSELATION）。

退出方式：在预览窗口中按 q 键退出。
"""
import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from mediapipe.tasks.python.vision import drawing_styles, drawing_utils
from mediapipe.tasks.python.vision.face_landmarker import FaceLandmarksConnections

BASE_OPTIONS = python.BaseOptions(model_asset_path="face_landmarker.task")
OPTIONS = vision.FaceLandmarkerOptions(
    base_options=BASE_OPTIONS,
    running_mode=vision.RunningMode.VIDEO,   # 视频流模式，需配合时间戳
    num_faces=1,                              # 同时追踪 1 张人脸
    min_face_detection_confidence=0.5,
    min_face_presence_confidence=0.5,
)

cap = cv2.VideoCapture(0)
if not cap.isOpened():
    raise SystemExit("无法打开摄像头，请检查摄像头设备是否可用")

with vision.FaceLandmarker.create_from_options(OPTIONS) as landmarker:
    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            break

        frame = cv2.flip(frame, 1)  # 水平翻转，形成镜像效果
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        timestamp_ms = int(cap.get(cv2.CAP_PROP_POS_MSEC))
        result = landmarker.detect_for_video(mp_image, timestamp_ms)

        for face_landmarks in result.face_landmarks:
            drawing_utils.draw_landmarks(
                frame,
                face_landmarks,
                FaceLandmarksConnections.FACE_LANDMARKS_TESSELATION,
                landmark_drawing_spec=None,                       # 只画网格线
                connection_drawing_spec=drawing_styles.get_default_face_mesh_tesselation_style(),
            )

        cv2.imshow("Face Tracking", frame)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

cap.release()
cv2.destroyAllWindows()
