// 生成 Expo Go 连接二维码
// 用法: node tools/gen-qr.js [exp://地址] [输出文件]
const QRCode = require('qrcode');

const url = process.argv[2] || 'exp://192.168.1.9:8081';
const out = process.argv[3] || 'qr-code.png';

QRCode.toFile(out, url, {
  width: 480,
  margin: 2,
  color: { dark: '#000000', light: '#FFFFFF' },
  errorCorrectionLevel: 'M',
})
  .then(() => console.log('QR written: ' + out + ' for ' + url))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
