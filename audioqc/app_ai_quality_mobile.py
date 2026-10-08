# app_ai_quality_mobile.py
# 智能音频质检 —— 规则质检 + DNSMOS 本地无参考音质评估（MOS）
# Termux 手机版：去掉 librosa/numba 依赖（mel/stft 用手写 numpy 实现，重采样用 soxr）。
# DNSMOS 环境通过环境变量 DNSMOS_DIR 定位（默认 ~/dnsmos），子进程调用 dnsmos_local_mobile.py。
import os
import sys
import shutil
import tempfile

# 嵌入式 Python（embeddable）不会自动把脚本所在目录加入 sys.path，这里显式注入，
# 保证无论用系统 Python / venv / 嵌入式 Python 运行都能 import 到同目录模块。
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
import gradio as gr
import soundfile as sf
from PIL import Image, ImageDraw

import dnsmos_local_mobile as dns

SR = 16000

# ==================== AI 配置（兼容源码运行与 PyInstaller 打包） ====================
def _resource_path(rel):
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, rel)

PRIMARY_MODEL = _resource_path(os.path.join("DNSMOS", "sig_bak_ovr.onnx"))
P808_MODEL = _resource_path(os.path.join("DNSMOS", "model_v8.onnx"))
AI_READY = bool(os.path.exists(PRIMARY_MODEL) and os.path.exists(P808_MODEL))

_SCORER = None
def get_scorer():
    global _SCORER
    if _SCORER is None:
        _SCORER = dns.ComputeScore(PRIMARY_MODEL, P808_MODEL)
    return _SCORER


# ==================== 无 librosa 的信号工具（与 librosa 数值一致） ====================
def _stft(y, n_fft, hop_length):
    win = np.hanning(n_fft + 1)[:-1].astype(np.float64)
    y_pad = np.pad(y, (n_fft // 2, n_fft // 2), mode="constant")
    n_frames = 1 + (len(y_pad) - n_fft) // hop_length
    if n_frames < 1:
        n_frames = 1
    idx = np.arange(n_fft)[None, :] + hop_length * np.arange(n_frames)[:, None]
    frames = y_pad[idx] * win
    return np.fft.rfft(frames, n=n_fft, axis=1).T


def load(path):
    y, sr0 = sf.read(path, dtype="float32", always_2d=True)
    y = np.mean(y, axis=1)  # mono
    if sr0 != SR:
        try:
            import soxr
            y = soxr.resample(y, sr0, SR)
        except ImportError:
            from scipy import signal as _sg
            y = _sg.resample_poly(y, SR, sr0)
    return y.astype(np.float32)


def frames(y, flen=400, hop=160):          # 25ms/10ms @16k
    n = max(0, 1 + (len(y) - flen) // hop)
    idx = np.arange(flen)[None, :] + hop * np.arange(n)[:, None]
    return y[idx]


# ==================== 原有规则质检（始终保留） ====================
def rule_analyze(path):
    y = load(path)
    issues = []

    # 1) 直流偏移
    dc = float(np.mean(y))
    if abs(dc) > 0.01: issues.append(("直流偏移", f"{dc:.4f}", "高通滤波"))

    # 2) 削波
    clip = float(np.mean(np.abs(y) > 0.985))
    if clip > 0.001: issues.append(("削波/爆音", f"{clip*100:.2f}%", "限幅"))

    # 3) 响度（近似 dBFS，正式版换 pyloudnorm）
    peak = float(np.max(np.abs(y)))
    rms  = float(np.sqrt(np.mean(y ** 2)))
    lufs = 20 * np.log10(rms + 1e-9)
    if lufs < -40: issues.append(("音量过低", f"{lufs:.1f} dBFS", "增益归一化"))
    if peak > 0.99 and lufs > -9: issues.append(("音量过高", f"{peak:.3f}", "衰减"))

    # 4) 静音占比
    fr = frames(y)
    r = np.sqrt(np.mean(fr ** 2, axis=1)) if len(fr) else np.array([0.0])
    sil = float(np.mean(r < 1e-3))
    if sil > 0.3: issues.append(("静音过多", f"{sil*100:.0f}%", "裁剪/补录"))

    # 5) 高频能量占比（带宽/发闷）—— 手写 stft 等价 librosa.stft
    S = np.abs(_stft(y, 2048, 512)) ** 2
    f = np.fft.rfftfreq(2048, d=1.0 / SR)
    hf = float(S[f > 4000].sum() / (S.sum() + 1e-9))
    if hf < 0.02: issues.append(("高频缺失/发闷", f"{hf*100:.1f}%", "EQ 提高频"))

    verdict = "异常" if issues else "正常"
    lines = "\n".join([f"- {n}｜实测 {v}｜建议 {fix}" for n, v, fix in issues]) or "- 未发现异常"
    return f"判定：{verdict}\n\n{lines}", y


# ==================== AI 无参考音质评估（DNSMOS 本地推理） ====================
def ai_quality_review(path):
    """同进程调用 DNSMOS（复用 ComputeScore，绕开子进程/CSV 中转）。"""
    y = load(path)
    tmpdir = tempfile.mkdtemp(prefix="dnsmos_in_")
    wav_path = os.path.join(tmpdir, "upload.wav")
    try:
        sf.write(wav_path, y, SR)
        m = get_scorer()(wav_path, SR, False)
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)
    return {
        "SIG":   float(m["SIG"]),
        "BAK":   float(m["BAK"]),
        "OVRL":  float(m["OVRL"]),
        "P808_MOS":  float(m["P808_MOS"]),
    }


def mos_grade(x):
    if x >= 4.5: return "优秀"
    if x >= 4.0: return "良好"
    if x >= 3.0: return "一般"
    return "较差"


def build_preview(y, width=640):
    # 上半：波形（PIL 画线，替代 matplotlib.plot）
    wav_h = 160
    img = Image.new("RGB", (width, wav_h + 200), "white")
    d = ImageDraw.Draw(img)
    d.line([(0, wav_h // 2), (width, wav_h // 2)], fill="#cccccc", width=1)
    step = max(1, len(y) // width)
    ys = y[::step][:width]
    amp = float(np.max(np.abs(ys))) + 1e-9
    scale = (wav_h / 2 - 4) / amp
    pts = [(i, wav_h / 2 - float(v) * scale) for i, v in enumerate(ys)]
    if pts:
        d.line(pts, fill="#1f77b4", width=1)
    # 下半：频谱灰度图（手写 stft 与 librosa.specgram 同源）
    S = np.abs(_stft(y, 1024, 512)) ** 2
    mag = np.log10(S + 1e-10)
    mag -= mag.min()
    mag /= (mag.max() + 1e-9)
    spec = Image.fromarray((mag * 255).astype(np.uint8).T, "L")
    spec = spec.resize((width, 200), Image.LANCZOS)
    img.paste(spec.convert("RGB"), (0, wav_h))
    return img


def format_ai_report(m):
    ovrl, sig, bak = m["OVRL"], m["SIG"], m["BAK"]
    head = (f"整体听感 MOS（OVRL）：{ovrl:.2f}（{mos_grade(ovrl)}）\n"
            f"语音信号质量（SIG）：{sig:.2f}（{mos_grade(sig)}）\n"
            f"背景噪声抑制（BAK）：{bak:.2f}（{mos_grade(bak)}）\n"
            f"P808_MOS（旧模型参考）：{m['P808_MOS']:.2f}")

    notes = []
    if ovrl >= 4.3:
        notes.append("综合音质优秀，主观听感好，无明显可闻劣化")
    elif ovrl >= 3.5:
        notes.append("综合音质中等，存在可感知的音质损伤，建议结合规则指标定位问题")
    else:
        notes.append("综合音质较差，明显影响听感，建议重新录音或针对性处理")

    if bak < 3.5:
        notes.append("背景噪声偏大（BAK 较低），建议降噪处理")
    if sig < 3.5:
        notes.append("语音信号受损/失真明显（SIG 较低），建议检查录音设备与码率")
    if sig >= 4.0 and bak < 3.5:
        notes.append("噪声污染为主：语音本身保留较好，优先做环境降噪")
    if sig < 3.5 and bak >= 4.0:
        notes.append("信号失真为主：环境较干净但语音受损，优先排查采集链路")
    if abs(sig - bak) < 0.3 and ovrl < 4.0:
        notes.append("各维度表现接近且整体偏低，疑似录音条件整体不佳（距离/增益/设备）")

    if sig < 4.0:
        notes.append("清晰度受限（SIG 偏低）：语音细节损失明显，可参考规则质检的“高频缺失”项判断带宽")
    else:
        notes.append("清晰度良好：语音细节保留充分")

    return head + "\n\n" + "\n".join(f"- {n}" for n in notes)


# ==================== 主流程 ====================
def analyze(path):
    # 1) 规则质检（始终保留）
    rule_text, y = rule_analyze(path)

    # 2) 可视化（PIL 绘制波形/频谱，替代 matplotlib）
    preview = build_preview(y)

    # 3) AI 无参考音质评估（DNSMOS）
    if not AI_READY:
        ai_mos = ("（DNSMOS 模型未就绪："
                  f"sig_bak_ovr.onnx {'存在' if os.path.exists(PRIMARY_MODEL) else '缺失'}，"
                  f"model_v8.onnx {'存在' if os.path.exists(P808_MODEL) else '缺失'}）")
        ai_detail = "（DNSMOS 未就绪，AI 音质评估不可用；规则质检与波形/频谱不受影响。）"
    else:
        try:
            m = ai_quality_review(path)
            ai_mos = (f"整体听感 MOS：{m['OVRL']:.2f}（{mos_grade(m['OVRL'])}）\n"
                      f"SIG（语音清晰/失真）：{m['SIG']:.2f}\n"
                      f"BAK（背景噪声）：{m['BAK']:.2f}\n"
                      f"P808_MOS（参考）：{m['P808_MOS']:.2f}\n\n"
                      "MOS 为 1~5 分：>=4.5 优秀；4.0~4.5 良好；3.0~4.0 一般；<3.0 较差。")
            ai_detail = format_ai_report(m)
        except Exception as e:
            ai_mos = f"（AI 音质评估失败：{e}）"
            ai_detail = f"（AI 音质评估失败：{e}）"

    return rule_text, ai_mos, ai_detail, preview


gr.Interface(
    fn=analyze,
    inputs=gr.Audio(type="filepath", label="上传音频"),
    outputs=[
        gr.Textbox(label="规则质检结果"),
        gr.Textbox(label="AI 音质评分（MOS）"),
        gr.Textbox(label="AI 评估详情（噪声/失真/清晰度）"),
        gr.Image(label="波形/频谱"),
    ],
    title="智能音频质检（规则质检 + AI 音质评估 DNSMOS）",
).launch(server_name="0.0.0.0", server_port=7860, inbrowser=False)
