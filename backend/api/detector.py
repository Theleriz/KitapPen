import threading
import logging
import base64

import numpy as np
import cv2
import mediapipe as mp
from django.conf import settings

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_detector = None

# Eye landmark indices for EAR calculation (MediaPipe Face Landmarker 478-point model)
_LEFT_EYE  = [33, 160, 158, 133, 153, 144]
_RIGHT_EYE = [362, 385, 387, 263, 373, 380]


def _build_detector():
    model_path = str(settings.MEDIAPIPE_MODEL_PATH)
    options = mp.tasks.vision.FaceLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=model_path),
        running_mode=mp.tasks.vision.RunningMode.IMAGE,
        num_faces=1,
    )
    return mp.tasks.vision.FaceLandmarker.create_from_options(options)


def _get_detector():
    global _detector
    if _detector is None:
        _detector = _build_detector()
    return _detector


def _ear(landmarks, indices):
    pts = [(landmarks[i].x, landmarks[i].y) for i in indices]
    A = np.linalg.norm(np.array(pts[1]) - np.array(pts[5]))
    B = np.linalg.norm(np.array(pts[2]) - np.array(pts[4]))
    C = np.linalg.norm(np.array(pts[0]) - np.array(pts[3]))
    return (A + B) / (2.0 * C) if C > 0 else 0.0


def analyze_frame(frame_base64: str) -> tuple[bool, float]:
    """
    Decode a base64 JPEG/PNG frame and return (is_reading, confidence).
    is_reading is True when a face with open eyes is detected.
    """
    try:
        frame_bytes = base64.b64decode(frame_base64)
        arr = np.frombuffer(frame_bytes, np.uint8)
        img_bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img_bgr is None:
            return False, 0.0

        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img_rgb)

        with _lock:
            result = _get_detector().detect(mp_image)

        if not result.face_landmarks:
            return False, 0.0

        lm = result.face_landmarks[0]
        left_ear  = _ear(lm, _LEFT_EYE)
        right_ear = _ear(lm, _RIGHT_EYE)
        avg_ear = (left_ear + right_ear) / 2.0

        eyes_open = avg_ear > 0.18
        confidence = min(0.95, 0.5 + avg_ear * 2.0) if eyes_open else 0.3
        is_reading = eyes_open and confidence > 0.65

        return is_reading, round(confidence, 2)

    except Exception as e:
        logger.exception("analyze_frame error: %s", e)
        return False, 0.0
