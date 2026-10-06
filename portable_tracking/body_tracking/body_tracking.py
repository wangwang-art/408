# -*- coding: utf-8 -*-
"""身体实时追踪（MediaPipe Pose，Tasks API）

使用 pose_landmarker.task 模型，从摄像头实时检测人体 33 个关键点并绘制骨架连线。

适配 mediapipe 1.0.x（该版本已移除 mp.solutions，改用 tasks 自带 drawing_utils，
连接表来自 PoseLandmarksConnections.POSE_LANDMARKS）。

若模型文件缺失，程序会提示下载地址后退出。

退出方式：在预览窗口中按 q 键退出。
"""
import os
import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from mediapipe.tasks.python.vision import drawing_utils
from mediapipe.tasks.python.vision.pose_landmarker import PoseLandmarksConnections

MODEL_PATH = "pose_landmarker.task"
MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/"
    "pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
)

# 骨架连线统一绘制样式
_POSE_CONNECTION_STYLE = drawing_utils.DrawingSpec(
    color=(0, 255, 0), thickness=2
)
_POSE_LANDMARK_STYLE = drawing_utils.DrawingSpec(
    color=(0, 0, 255), thickness=-1, circle_radius=3
)

if __name__ == "__main__":
    if not os.path.exists(MODEL_PATH):
        raise SystemExit(
            "未找到 pose_landmarker.task，请先下载模型：\n"
            + MODEL_URL
            + "\n（下载失败可配置代理 http://127.0.0.1:7897 重试）"
        )

    base_options = python.BaseOptions(model_asset_path=MODEL_PATH)
    options = vision.PoseLandmarkerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.VIDEO,  # 视频流模式，需配合时间戳
        num_poses=1,
        min_pose_detection_confidence=0.5,
        min_pose_presence_confidence=0.5,
    )

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        raise SystemExit("无法打开摄像头，请检查摄像头设备是否可用")

    with vision.PoseLandmarker.create_from_options(options) as landmarker:
        while cap.isOpened():
            success, frame = cap.read()
            if not success:
                break

            frame = cv2.flip(frame, 1)  # 水平翻转，形成镜像效果
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            timestamp_ms = int(cap.get(cv2.CAP_PROP_POS_MSEC))
            result = landmarker.detect_for_video(mp_image, timestamp_ms)

            for pose_landmarks in result.pose_landmarks:
                drawing_utils.draw_landmarks(
                    frame,
                    pose_landmarks,
                    PoseLandmarksConnections.POSE_LANDMARKS,
                    _POSE_LANDMARK_STYLE,
                    _POSE_CONNECTION_STYLE,
                )

            cv2.imshow("Body Tracking", frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

    cap.release()
    cv2.destroyAllWindows()
