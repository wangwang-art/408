// 批量下载单词美式发音（有道词典，标准美音）
// 用法: node tools/download-audio.js
const fs = require('fs');
const path = require('path');
const https = require('https');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'audio');
const BOOKS = ['cet4', 'cet6', 'ielts'];

// 收集全部单词（去重）
const words = new Set();
for (const b of BOOKS) {
  const data = require(path.join(__dirname, '..', 'src', 'data', 'wordbooks', `${b}.json`));
  const list = Array.isArray(data) ? data : data.words;
  for (const w of list) words.add(w.word.toLowerCase());
}

const wordList = [...words];
console.log(`共 ${wordList.length} 个单词`);

fs.mkdirSync(OUT_DIR, { recursive: true });

let done = 0;
let failed = [];

function download(word) {
  return new Promise((resolve) => {
    const file = path.join(OUT_DIR, `${word}.mp3`);
    if (fs.existsSync(file) && fs.statSync(file).size > 500) {
      done++;
      resolve();
      return;
    }
    const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=2`;
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode !== 200) {
        failed.push(word);
        resolve();
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (buf.length > 500) {
          fs.writeFileSync(file, buf);
          done++;
        } else {
          failed.push(word);
        }
        resolve();
      });
    });
    req.on('error', () => { failed.push(word); resolve(); });
    req.setTimeout(10000, () => req.destroy());
  });
}

(async () => {
  // 并发 5
  for (let i = 0; i < wordList.length; i += 5) {
    await Promise.all(wordList.slice(i, i + 5).map(download));
    process.stdout.write(`\r进度: ${done}/${wordList.length}`);
  }
  console.log('');
  if (failed.length) {
    console.log('失败:', failed.join(', '));
    // 失败单词写入清单，可重试
    fs.writeFileSync(path.join(OUT_DIR, '..', 'audio-failed.txt'), failed.join('\n'));
  }
  // 输出大小统计
  const files = fs.readdirSync(OUT_DIR);
  let total = 0;
  for (const f of files) total += fs.statSync(path.join(OUT_DIR, f)).size;
  console.log(`完成 ${files.length} 个文件, 总大小 ${(total / 1024 / 1024).toFixed(2)} MB`);
})();
