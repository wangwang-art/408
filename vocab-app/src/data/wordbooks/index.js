// 词库索引文件：预加载所有词本的 JSON 数据
import cet4 from './cet4.json';
import cet6 from './cet6.json';
import ielts from './ielts.json';

export const WORD_BOOKS = {
  cet4,
  cet6,
  ielts,
};

export const getBookWords = (bookTag) => {
  return WORD_BOOKS[bookTag] || [];
};
