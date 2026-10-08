# AudioQC 智能音频质检

基于规则质检 + DNSMOS 本地无参考音质评估（MOS）的音频质量检测工具，提供 Gradio 与 Flask 两种 Web 界面，可对上传的音频进行规则项检测（直流偏移、削波、响度、静音、高频缺失）并输出 DNSMOS 语音/背景/整体听感评分与处理建议。

## 功能

- **规则质检**：直流偏移、削波/爆音、音量过低/过高、静音占比、高频缺失/发闷，逐项给出实测值与处理建议。
- **AI 音质评估**：DNSMOS 本地推理（无参考），输出 SIG（语音清晰/失真）、BAK（背景噪声）、OVRL（整体听感 MOS）与 P808_MOS 参考值，MOS 1~5 分并映射为优秀/良好/一般/较差。
- **可视化**：波形图 + 频谱图（PIL 绘制，不依赖 matplotlib）。
- **轻量依赖**：mel 谱 / STFT 用纯 numpy 实现，重采样优先 soxr，无需 librosa / numba，便于手机（Termux）与嵌入式 Python 环境运行。

## 依赖

见 `requirements.txt`：numpy、scipy、onnxruntime、soundfile、soxr、gradio、flask、Pillow、tqdm。

安装依赖：

```bash
pip install -r requirements.txt
```

## 启动方式

便携版（推荐，Windows 10/11）：直接双击本目录下 `一键启动.bat`（Gradio 版，端口 7860）或 `启动Flask版.bat`（Flask 版，端口 5000），脚本使用包内 runtime 中的嵌入式 Python 运行，无需预装 Python。

手动运行（需已配置 Python 环境并安装依赖）：

```bash
python app_ai_quality_mobile.py   # Gradio 版，浏览器打开 http://127.0.0.1:7860
python app_ai_quality_flask.py    # Flask 版，浏览器打开 http://127.0.0.1:5000
```

端口被占用时运行 `释放端口.bat`（强制结束占用 7860 / 5000 的进程），或直接运行命令行版批量评估：

```bash
python dnsmos_local_mobile.py -t <wav目录> -o <结果csv>
```

## 目录结构

```
audioqc/
├── app_ai_quality_mobile.py   # Gradio 版主程序（默认入口，端口 7860）
├── app_ai_quality_flask.py    # Flask 版主程序（端口 5000）
├── dnsmos_local_mobile.py     # DNSMOS 本地推理模块（命令行批量评估入口）
├── DNSMOS/
│   ├── sig_bak_ovr.onnx       # DNSMOS 主模型（SIG/BAK/OVRL）
│   └── model_v8.onnx          # P808 参考模型
├── 一键启动.bat               # 便携启动（Gradio 版）
├── 启动Flask版.bat            # 便携启动（Flask 版）
├── 释放端口.bat               # 释放 7860 / 5000 端口
├── 使用说明.txt               # 便携版使用说明
└── requirements.txt           # Python 依赖清单
```

> 说明：完整便携分发包内置嵌入式 Python 运行时（`runtime/`，约 477MB），体积过大不纳入本仓库，由 `.gitignore` 排除；如需零安装分发请自行附带 runtime 目录。
