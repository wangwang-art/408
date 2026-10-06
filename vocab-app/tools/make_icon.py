"""生成 VocabApp 图标与启动图（纯标准库，无第三方依赖）
- assets/icon.png        1024x1024 圆角蓝底 + 白色字母 V（应用图标）
- assets/splash-icon.png 1024x1024 纯蓝底 + 白色字母 V（启动画面）
"""
import struct
import zlib

W = 1024
BLUE = (74, 144, 217)      # #4A90D9 主蓝
WHITE = (255, 255, 255)
BG = (245, 247, 250)


def make_png(width, height, pixel_fn, path):
    rows = []
    for y in range(height):
        row = bytearray([0])
        for x in range(width):
            r, g, b, a = pixel_fn(x, y)
            row += bytes((r, g, b, a))
        rows.append(bytes(row))
    raw = b"".join(rows)

    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", ihdr)
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


def rounded_rect(x, y, w, h, r):
    cx = min(max(x, r), w - r)
    cy = min(max(y, r), h - r)
    dx, dy = x - cx, y - cy
    return dx * dx + dy * dy <= r * r


def in_v(px, py):
    """字母 V 区域（归一化 0-1 坐标）"""
    t = (py - 0.26) / (0.68 - 0.26)
    if t < -0.02 or t > 1.02:
        return False
    left_x = 0.24 + (0.5 - 0.24) * t
    right_x = 1.0 - left_x
    return (abs(px - left_x) < 0.055 or abs(px - right_x) < 0.055) and 0.24 <= px <= 0.76


def icon_pixel(x, y):
    """圆角图标：浅灰蓝底 + 蓝色圆角方块 + 白 V"""
    nx, ny = x / W, y / W
    if in_v(nx, ny):
        return WHITE + (255,)
    if rounded_rect(nx, ny, 1.0, 1.0, 0.18):
        return BLUE + (255,)
    return BG + (255,)


def splash_pixel(x, y):
    """启动图：纯蓝底 + 白 V（居中稍大）"""
    nx, ny = x / W, y / W
    if in_v(nx, ny):
        return WHITE + (255,)
    return BLUE + (255,)


if __name__ == "__main__":
    import os
    os.makedirs("assets", exist_ok=True)
    make_png(W, W, icon_pixel, "assets/icon.png")
    make_png(W, W, splash_pixel, "assets/splash-icon.png")
    print("icon + splash written")
