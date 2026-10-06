#!/usr/bin/env python3
"""
将 ECDICT SQLite 数据库按考试标签拆分为 JSON 文件。

ECDICT 格式参考: https://github.com/skywind3000/ECDICT
ecdict.db 中的 word 表结构:
  id, word, sw, phonetic, definition, translation, pos, collins, oxford, tag, bnc, frq, exchange, detail, audio

tag 字段包含逗号分隔的标签，如 "cet4,cet6,ielts,gre"。
此脚本将筛选 tag 包含目标标签的条目，输出为 JSON 数组。
"""

import sqlite3
import json
import os
import sys

# --- 配置 ---
DB_PATH = 'ecdict.db'                  # ECDICT 数据库路径
OUTPUT_DIR = '../src/data/wordbooks/'  # 输出目录
TAGS = ['cet4', 'cet6', 'ielts', 'gre', 'toefl', 'kaoyan']

# 最大导出条数（每个标签）
MAX_WORDS_PER_TAG = 500


def main():
    if not os.path.exists(DB_PATH):
        print(f'错误: 数据库文件 "{DB_PATH}" 不存在。')
        print('请先从 https://github.com/skywind3000/ECDICT 下载 ecdict.db')
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    for tag in TAGS:
        print(f'处理标签: {tag} ...', end=' ')

        cursor.execute(
            "SELECT word, phonetic, definition, translation, pos, tag "
            "FROM stardict "
            "WHERE tag LIKE ? "
            "LIMIT ?",
            (f'%{tag}%', MAX_WORDS_PER_TAG)
        )

        rows = cursor.fetchall()
        words = []
        for row in rows:
            word, phonetic, definition, translation, pos, _ = row
            words.append({
                'word': word,
                'phonetic': phonetic or '',
                'meaning': translation or definition or '',
                'pos': pos or '',
                'example': '',
            })

        output_path = os.path.join(OUTPUT_DIR, f'{tag}.json')
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(words, f, ensure_ascii=False, indent=2)

        print(f'导出 {len(words)} 个单词 -> {output_path}')

    conn.close()
    print('完成!')


if __name__ == '__main__':
    main()
