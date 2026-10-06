#!/usr/bin/env python3
"""
TTS 服务：为背单词应用提供英语单词发音（基于 edge-tts，使用微软 Edge 在线语音）。

端点:
    GET /tts?word=hello&voice=en-US-JennyNeural
    -> 返回 audio/mpeg 二进制流

用法:
    pip install edge-tts fastapi uvicorn
    python tools/tts_server.py           # 监听 0.0.0.0:8000
    python tools/tts_server.py --port 9000

说明:
    - 服务无状态，App 端负责本地缓存音频文件。
    - 内置简单内存缓存（word+voice），重复请求直接返回，减少在线合成压力。
"""

import argparse
import asyncio
import io
import time

import edge_tts
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

app = FastAPI(title="Vocab TTS Server", version="1.0.0")

# 允许跨域（Web 调试 / 后续 Web 端使用）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 内存缓存: { (word, voice): (timestamp, bytes) }，最多缓存 2048 条
CACHE_MAX = 2048
CACHE_TTL = 3600 * 24  # 24 小时
_cache = {}


def _cache_get(key):
    item = _cache.get(key)
    if not item:
        return None
    ts, data = item
    if time.time() - ts > CACHE_TTL:
        _cache.pop(key, None)
        return None
    return data


def _cache_put(key, data):
    if len(_cache) >= CACHE_MAX:
        # 简单清理：删除最早的 10%
        for k in list(_cache.keys())[: CACHE_MAX // 10]:
            _cache.pop(k, None)
    _cache[key] = (time.time(), data)


async def _synthesize(word: str, voice: str) -> bytes:
    """调用 edge-tts 合成语音，返回 mp3 字节"""
    communicate = edge_tts.Communicate(word, voice)
    buffer = io.BytesIO()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            buffer.write(chunk["data"])
    return buffer.getvalue()


@app.get("/")
async def root():
    return {"service": "vocab-tts", "status": "ok", "cache_size": len(_cache)}


@app.get("/tts")
async def tts(
    word: str = Query(..., min_length=1, description="要朗读的单词/文本"),
    voice: str = Query("en-US-JennyNeural", description="Edge 语音名称"),
):
    if not word.strip():
        raise HTTPException(status_code=400, detail="word 不能为空")

    key = (word, voice)
    data = _cache_get(key)

    if data is None:
        try:
            data = await asyncio.wait_for(_synthesize(word, voice), timeout=20)
        except asyncio.TimeoutError:
            raise HTTPException(status_code=504, detail="语音合成超时")
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"合成失败: {e}")
        if not data:
            raise HTTPException(status_code=500, detail="合成结果为空")
        _cache_put(key, data)

    return StreamingResponse(
        iter([data]),
        media_type="audio/mpeg",
        headers={"Content-Length": str(len(data)), "Cache-Control": "public, max-age=86400"},
    )


@app.get("/voices")
async def list_voices():
    """列出可用语音（调试用）"""
    voices = await edge_tts.list_voices()
    return [v["ShortName"] for v in voices if v["Locale"].startswith("en")][:20]


def main():
    parser = argparse.ArgumentParser(description="Vocab TTS Server (edge-tts)")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    import uvicorn

    print(f"TTS server listening on http://{args.host}:{args.port}")
    print("测试: curl 'http://localhost:8000/tts?word=abandon' -o a.mp3")
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
