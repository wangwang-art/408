# dnsmos_local_mobile.py
# DNSMOS 官方 dnsmos_local.py 的手机（Termux）移植版：去掉 librosa/numba 依赖，
# mel 谱用 dsp_common 的手写 numpy 实现（与 librosa 数值一致，误差 <1e-6）。
# 用法与官方一致：python dnsmos_local_mobile.py -t <wav目录> -o <csv>
# 模型相对路径依赖不变：DNSMOS/sig_bak_ovr.onnx 与 DNSMOS/model_v8.onnx，需在 cwd=根目录 下运行。
import argparse
import glob
import os
import sys

import csv
import numpy as np
import onnxruntime as ort
from tqdm import tqdm

# 嵌入式 Python（embeddable）不会自动把脚本所在目录加入 sys.path，这里显式注入，
# 保证独立运行（python dnsmos_local_mobile.py）时能 import 到同目录的 dsp_common。
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dsp_common import audio_melspec_np, read_mono, resample_to

SAMPLING_RATE = 16000
INPUT_LENGTH = 9.01


# ==================== 推理 ====================
class ComputeScore:
    def __init__(self, primary_model_path, p808_model_path):
        self.onnx_sess = ort.InferenceSession(primary_model_path)
        self.p808_onnx_sess = ort.InferenceSession(p808_model_path)

    def audio_melspec(self, audio, n_mels=120, frame_size=320, hop_length=160, sr=16000, to_db=True):
        mel_spec = audio_melspec_np(audio, n_mels, frame_size, hop_length, sr)
        return mel_spec

    def get_polyfit_val(self, sig, bak, ovr, is_personalized_MOS):
        if is_personalized_MOS:
            p_ovr = np.poly1d([-0.00533021,  0.005101  ,  1.18058466, -0.11236046])
            p_sig = np.poly1d([-0.01019296,  0.02751166,  1.19576786, -0.24348726])
            p_bak = np.poly1d([-0.04976499,  0.44276479, -0.1644611 ,  0.96883132])
        else:
            p_ovr = np.poly1d([-0.06766283,  1.11546468,  0.04602535])
            p_sig = np.poly1d([-0.08397278,  1.22083953,  0.0052439 ])
            p_bak = np.poly1d([-0.13166888,  1.60915514, -0.39604546])

        sig_poly = p_sig(sig)
        bak_poly = p_bak(bak)
        ovr_poly = p_ovr(ovr)

        return sig_poly, bak_poly, ovr_poly

    def __call__(self, fpath, sampling_rate, is_personalized_MOS):
        # 读取并混为单声道（多通道取均值），避免 ONNX 输入维度不匹配
        aud, input_fs = read_mono(fpath)
        fs = sampling_rate
        audio = resample_to(aud, input_fs, fs)
        if len(audio) == 0:
            raise ValueError(f"音频为空或解码失败，无法评估：{fpath}")
        actual_audio_len = len(audio)
        len_samples = int(INPUT_LENGTH * fs)
        if len(audio) < len_samples:
            # 有界补齐：平铺后截断（原 while 自我倍增写法在空音频时永不退出）
            audio = np.tile(audio, int(np.ceil(len_samples / len(audio))))[:len_samples]

        num_hops = int(np.floor(len(audio) / fs) - INPUT_LENGTH) + 1
        if num_hops <= 0:
            raise ValueError(
                f"音频过短（{len(audio) / fs:.2f}s < {INPUT_LENGTH}s），无法切出完整评估片段：{fpath}")
        hop_len_samples = fs
        predicted_mos_sig_seg_raw = []
        predicted_mos_bak_seg_raw = []
        predicted_mos_ovr_seg_raw = []
        predicted_mos_sig_seg = []
        predicted_mos_bak_seg = []
        predicted_mos_ovr_seg = []
        predicted_p808_mos = []

        for idx in range(num_hops):
            audio_seg = audio[int(idx * hop_len_samples): int((idx + INPUT_LENGTH) * hop_len_samples)]
            if len(audio_seg) < len_samples:
                continue

            input_features = np.array(audio_seg).astype('float32')[np.newaxis, :]
            p808_input_features = np.array(self.audio_melspec(audio=audio_seg[:-160])).astype('float32')[np.newaxis, :, :]
            oi = {'input_1': input_features}
            p808_oi = {'input_1': p808_input_features}
            p808_mos = self.p808_onnx_sess.run(None, p808_oi)[0][0][0]
            mos_sig_raw, mos_bak_raw, mos_ovr_raw = self.onnx_sess.run(None, oi)[0][0]
            mos_sig, mos_bak, mos_ovr = self.get_polyfit_val(mos_sig_raw, mos_bak_raw, mos_ovr_raw, is_personalized_MOS)
            predicted_mos_sig_seg_raw.append(mos_sig_raw)
            predicted_mos_bak_seg_raw.append(mos_bak_raw)
            predicted_mos_ovr_seg_raw.append(mos_ovr_raw)
            predicted_mos_sig_seg.append(mos_sig)
            predicted_mos_bak_seg.append(mos_bak)
            predicted_mos_ovr_seg.append(mos_ovr)
            predicted_p808_mos.append(p808_mos)

        clip_dict = {'filename': fpath, 'len_in_sec': actual_audio_len / fs, 'sr': fs}
        clip_dict['num_hops'] = num_hops
        clip_dict['OVRL_raw'] = np.mean(predicted_mos_ovr_seg_raw)
        clip_dict['SIG_raw'] = np.mean(predicted_mos_sig_seg_raw)
        clip_dict['BAK_raw'] = np.mean(predicted_mos_bak_seg_raw)
        clip_dict['OVRL'] = np.mean(predicted_mos_ovr_seg)
        clip_dict['SIG'] = np.mean(predicted_mos_sig_seg)
        clip_dict['BAK'] = np.mean(predicted_mos_bak_seg)
        clip_dict['P808_MOS'] = np.mean(predicted_p808_mos)
        return clip_dict


def main(args):
    if args.personalized_MOS:
        primary_model_path = os.path.join('pDNSMOS', 'sig_bak_ovr.onnx')
    else:
        primary_model_path = os.path.join('DNSMOS', 'sig_bak_ovr.onnx')
    p808_model_path = os.path.join('DNSMOS', 'model_v8.onnx')

    compute_score = ComputeScore(primary_model_path, p808_model_path)

    clips = []
    for root, dirs, files in os.walk(args.testset_dir):
        for f in files:
            if f.lower().endswith('.wav'):
                clips.append(os.path.join(root, f))
    clips = sorted(set(clips))

    rows = []
    for clip in tqdm(clips):
        try:
            data = compute_score(clip, SAMPLING_RATE, args.personalized_MOS)
            rows.append(data)
        except Exception as exc:
            print('%r generated an exception: %s' % (clip, exc))

    if args.csv_path:
        with open(args.csv_path, 'w', newline='') as f:
            if rows:
                fieldnames = list(rows[0].keys())
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(rows)
    else:
        for r in rows:
            print(r)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('-t', "--testset_dir", default='.',
                        help='Path to the dir containing audio clips in .wav to be evaluated')
    parser.add_argument('-o', "--csv_path", default=None, help='Dir to the csv that saves the results')
    parser.add_argument('-p', "--personalized_MOS", action='store_true',
                        help='Flag to indicate if personalized MOS score is needed or regular')

    args = parser.parse_args()
    main(args)
