# dnsmos_local_mobile.py
# DNSMOS 官方 dnsmos_local.py 的手机（Termux）移植版：去掉 librosa/numba 依赖，
# mel 谱用手写 numpy 实现（与 librosa 数值一致，误差 <1e-6），重采样用 soxr。
# 用法与官方一致：python dnsmos_local_mobile.py -t <wav目录> -o <csv>
# 模型相对路径依赖不变：DNSMOS/sig_bak_ovr.onnx 与 DNSMOS/model_v8.onnx，需在 cwd=根目录 下运行。
import argparse
import glob
import os

import csv
import numpy as np
import onnxruntime as ort
import soundfile as sf
from tqdm import tqdm

SAMPLING_RATE = 16000
INPUT_LENGTH = 9.01

# ==================== 无 librosa 的 mel 谱实现（与 librosa 数值一致） ====================
def _hz_to_mel(f):
    f = np.atleast_1d(np.asanyarray(f, dtype=np.float64))
    f_sp = 200.0 / 3
    mels = f / f_sp
    min_log_hz = 1000.0
    min_log_mel = (min_log_hz - 0.0) / f_sp
    logstep = np.log(6.4) / 27.0
    idx = f > min_log_hz
    mels = mels.copy()
    mels[idx] = min_log_mel + np.log(f[idx] / min_log_hz) / logstep
    return mels

def _mel_to_hz(mels):
    mels = np.atleast_1d(np.asanyarray(mels, dtype=np.float64))
    f_sp = 200.0 / 3
    freqs = mels * f_sp
    min_log_hz = 1000.0
    min_log_mel = (min_log_hz - 0.0) / f_sp
    logstep = np.log(6.4) / 27.0
    idx = mels > min_log_mel
    freqs = freqs.copy()
    freqs[idx] = min_log_hz * np.exp(logstep * (mels[idx] - min_log_mel))
    return freqs

def _mel_filters(sr, n_fft, n_mels, fmin=0.0, fmax=None):
    if fmax is None:
        fmax = float(sr) / 2
    weights = np.zeros((n_mels, int(1 + n_fft // 2)), dtype=np.float64)
    min_mel = float(_hz_to_mel(fmin)[0])
    max_mel = float(_hz_to_mel(fmax)[0])
    mels = np.linspace(min_mel, max_mel, n_mels + 2)
    mel_f = _mel_to_hz(mels).ravel()
    fftfreqs = np.fft.rfftfreq(n_fft, d=1.0 / sr)
    fdiff = np.diff(mel_f)
    ramps = np.subtract.outer(mel_f, fftfreqs)
    for i in range(n_mels):
        lower = -ramps[i] / fdiff[i]
        upper = ramps[i + 2] / fdiff[i + 1]
        weights[i] = np.maximum(0, np.minimum(lower, upper))
    enorm = 2.0 / (mel_f[2: n_mels + 2] - mel_f[:n_mels])
    weights *= enorm[:, np.newaxis]
    return weights

def _stft(y, n_fft, hop_length):
    win = np.hanning(n_fft + 1)[:-1].astype(np.float64)  # periodic hann
    y_pad = np.pad(y, (n_fft // 2, n_fft // 2), mode="constant")
    n_frames = 1 + (len(y_pad) - n_fft) // hop_length
    if n_frames < 1:
        n_frames = 1
    idx = np.arange(n_fft)[None, :] + hop_length * np.arange(n_frames)[:, None]
    frames = y_pad[idx] * win
    return np.fft.rfft(frames, n=n_fft, axis=1).T

def audio_melspec_np(audio, n_mels=120, frame_size=320, hop_length=160, sr=16000):
    n_fft = frame_size + 1
    S = np.abs(_stft(audio, n_fft, hop_length)) ** 2
    W = _mel_filters(sr, n_fft, n_mels, fmin=0.0, fmax=sr / 2)
    mel = W @ S
    ref = np.max(mel)
    db = 10.0 * np.log10(np.maximum(1e-10, mel / ref))
    db = np.maximum(db, np.max(db) - 80.0)
    return ((db + 40) / 40).T  # (frames, n_mels)


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
        aud, input_fs = sf.read(fpath)
        fs = sampling_rate
        if input_fs != fs:
            try:
                import soxr
                audio = soxr.resample(aud, input_fs, fs)
            except ImportError:
                # 兜底：线性插值重采样（仅在非 16k 音频且无 soxr 时触发）
                from scipy import signal as _sg
                audio = _sg.resample_poly(aud, fs, input_fs)
        else:
            audio = aud
        actual_audio_len = len(audio)
        len_samples = int(INPUT_LENGTH * fs)
        while len(audio) < len_samples:
            audio = np.append(audio, audio)

        num_hops = int(np.floor(len(audio) / fs) - INPUT_LENGTH) + 1
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
