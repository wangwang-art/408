# dsp_common.py
# audioqc 公共 DSP 模块：STFT / mel 谱 / 音频读取与重采样
# 由 dnsmos_local_mobile.py 与 app_ai_quality_flask.py 共同引用，避免双实现漂移。
# mel 谱为手写 numpy 实现（与 librosa 数值一致，误差 <1e-6）；
# 重采样优先 soxr，缺依赖时兜底 scipy。
import numpy as np
import soundfile as sf


# ==================== STFT（periodic hann） ====================
def stft(y, n_fft, hop_length):
    win = np.hanning(n_fft + 1)[:-1].astype(np.float64)  # periodic hann
    y_pad = np.pad(y, (n_fft // 2, n_fft // 2), mode="constant")
    n_frames = 1 + (len(y_pad) - n_fft) // hop_length
    if n_frames < 1:
        n_frames = 1
    idx = np.arange(n_fft)[None, :] + hop_length * np.arange(n_frames)[:, None]
    frames = y_pad[idx] * win
    return np.fft.rfft(frames, n=n_fft, axis=1).T


# ==================== 无 librosa 的 mel 谱实现（与 librosa 数值一致） ====================
def hz_to_mel(f):
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

def mel_to_hz(mels):
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

def mel_filters(sr, n_fft, n_mels, fmin=0.0, fmax=None):
    if fmax is None:
        fmax = float(sr) / 2
    weights = np.zeros((n_mels, int(1 + n_fft // 2)), dtype=np.float64)
    min_mel = float(hz_to_mel(fmin)[0])
    max_mel = float(hz_to_mel(fmax)[0])
    mels = np.linspace(min_mel, max_mel, n_mels + 2)
    mel_f = mel_to_hz(mels).ravel()
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

def audio_melspec_np(audio, n_mels=120, frame_size=320, hop_length=160, sr=16000):
    n_fft = frame_size + 1
    S = np.abs(stft(audio, n_fft, hop_length)) ** 2
    W = mel_filters(sr, n_fft, n_mels, fmin=0.0, fmax=sr / 2)
    mel = W @ S
    ref = np.max(mel)
    db = 10.0 * np.log10(np.maximum(1e-10, mel / ref))
    db = np.maximum(db, np.max(db) - 80.0)
    return ((db + 40) / 40).T  # (frames, n_mels)


# ==================== 音频读取与重采样 ====================
def read_mono(path, dtype=None):
    """读取音频并混为单声道（多通道取均值），返回 (audio, sr)。"""
    y, sr = sf.read(path, dtype=dtype, always_2d=True)
    return np.mean(y, axis=1), sr

def resample_to(audio, input_fs, target_fs):
    """重采样到目标采样率；采样率相同则原样返回。soxr 优先，缺依赖时兜底 scipy。"""
    if input_fs == target_fs:
        return audio
    try:
        import soxr
        return soxr.resample(audio, input_fs, target_fs)
    except ImportError:
        from scipy import signal as _sg
        return _sg.resample_poly(audio, target_fs, input_fs)
