// 例句解析器单元测试
// 数据 fixture 来自有道词典 jsonapi_s 接口的真实返回结构（已实测抓取验证）
const {
  parseYoudaoResponse,
  cleanSentence,
  extractMeaning,
  extractExamples,
  pickRandomExample,
  normalizeHeadword,
  extractHeadword,
  findMatchingEntry,
} = require('../src/utils/exampleParser');

// 新版接口结构（2026 实测）：ec.word 为对象，return-phrase 为字符串；
// 例句在 blng_sents_part['sentence-pair']，sentence-eng 带 <b> 高亮
const YOUDao_NEW_FIXTURE = {
  ec: {
    word: {
      'return-phrase': 'abandon',
      trs: [
        {
          pos: 'v.',
          tran: '抛弃，遗弃；（因危险）离开，舍弃；中止，不再有；放弃（信念、信仰或看法）；陷入，沉湎于（某种情感）',
        },
        { pos: 'n.', tran: '放任，放纵' },
      ],
    },
  },
  blng_sents_part: {
    'sentence-pair': [
      {
        sentence: 'The captain gave the order to abandon ship.',
        'sentence-eng': 'The captain gave the order to <b>abandon</b> ship.',
        'sentence-translation': '船长下令弃船。',
      },
      {
        sentence: 'Snow forced many drivers to abandon their vehicles.',
        'sentence-eng': 'Snow forced many drivers to <b>abandon</b> their vehicles.',
        'sentence-translation': '大雪迫使许多驾驶者弃车步行。',
      },
      {
        sentence: 'Many want to abandon the multilateral trade talks in Geneva.',
        'sentence-eng': 'Many want to <b>abandon</b> the multilateral trade talks in Geneva.',
        'sentence-translation': '许多国家想要放弃在日内瓦的多边贸易会谈。',
      },
    ],
  },
};

// 旧版接口结构（兼容）：ec.word 为数组，return-phrase 为对象 {l:{i}}；
// trs 项含 tr[].l.i；例句在 sentence 下
const YOUDao_LEGACY_FIXTURE = {
  ec: {
    word: [
      {
        'return-phrase': { l: { i: 'abandon' } },
        trs: [
          { pos: 'vt.', tr: [{ l: { i: ['丢弃；放弃，抛弃'] } }] },
          { pos: 'n.', tr: [{ l: { i: ['放任；纵情'] } }] },
        ],
      },
    ],
  },
  blng_sents_part: {
    sentence: [
      {
        sentence: 'He abandoned his car.',
        'sentence-eng': 'He <b>abandoned</b> his car.',
        'sentence-translation': '他丢弃了汽车。',
      },
    ],
  },
};

// 真实 bug 复现：有道对无法精确匹配的词返回近似词词条
// aid -> 字母 x 的词条（return-phrase 为对象 {l:{i:'x'}}）
const YOUDao_FUZZY_AID = {
  ec: {
    word: [
      {
        'return-phrase': { l: { i: 'x' } },
        trs: [
          {
            tr: [
              {
                l: { i: ['n. 英语字母中的第二十四个字母；未知的人（数或影响等）；表示罗马数字十'] },
              },
            ],
          },
        ],
      },
    ],
  },
  blng_sents_part: {
    'sentence-pair': [
      {
        sentence: 'X denotes those not voting.',
        'sentence-eng': 'X denotes those not voting.',
        'sentence-translation': 'X表示那些没有投票的。',
      },
    ],
  },
};

// 真实 bug 复现：although -> tip-up 的词条
const YOUDao_FUZZY_ALTHOUGH = {
  ec: {
    word: [
      {
        'return-phrase': { l: { i: 'tip-up' } },
        trs: [
          { pos: 'adj.', tran: '（无人坐时）自动上翻的，自动收起的' },
        ],
      },
    ],
  },
  blng_sents_part: {
    'sentence-pair': [
      {
        sentence: 'The systematic arrangement of tip-up seat makes the hall look spacious.',
        'sentence-eng': 'The systematic arrangement of tip-up seat makes the hall look spacious.',
        'sentence-translation': '这些可折叠座椅的安排方式使得礼堂显得很宽敞。',
      },
    ],
  },
};

describe('normalizeHeadword / extractHeadword', () => {
  test('归一化：小写并去除连字符/空格', () => {
    expect(normalizeHeadword('X-ray')).toBe('xray');
    expect(normalizeHeadword('father-in-law')).toBe('fatherinlaw');
    expect(normalizeHeadword(' China ')).toBe('china');
    expect(normalizeHeadword('up-to-date')).toBe('uptodate');
  });

  test('extractHeadword 兼容字符串与对象两种格式', () => {
    expect(extractHeadword({ 'return-phrase': 'bear' })).toBe('bear');
    expect(extractHeadword({ 'return-phrase': { l: { i: 'x' } } })).toBe('x');
    expect(extractHeadword({ 'return-phrase': { i: 'tip' } })).toBe('tip');
    expect(extractHeadword({})).toBe('');
  });

  test('findMatchingEntry：大小写不敏感匹配', () => {
    expect(findMatchingEntry(YOUDao_NEW_FIXTURE, 'Abandon')).not.toBeNull();
    expect(findMatchingEntry(YOUDao_LEGACY_FIXTURE, 'abandon')).not.toBeNull();
    // 查询词与词条头不一致 -> 无匹配
    expect(findMatchingEntry(YOUDao_NEW_FIXTURE, 'aid')).toBeNull();
  });
});

describe('cleanSentence', () => {
  test('去除 <b> 高亮标签', () => {
    expect(cleanSentence('The captain gave the order to <b>abandon</b> ship.')).toBe(
      'The captain gave the order to abandon ship.'
    );
  });

  test('还原常用 HTML 实体并压缩空白', () => {
    expect(cleanSentence('  a&nbsp;&quot;b&quot;&#39;c&nbsp;&amp;&nbsp;d  ')).toBe(
      'a "b"\'c & d'
    );
  });

  test('空值返回空字符串', () => {
    expect(cleanSentence(null)).toBe('');
    expect(cleanSentence(undefined)).toBe('');
  });
});

describe('extractMeaning', () => {
  test('新版结构：pos + tran 拼接完整含义', () => {
    const meaning = extractMeaning(YOUDao_NEW_FIXTURE, 'abandon');
    expect(meaning).toContain('v. 抛弃，遗弃');
    expect(meaning).toContain('n. 放任，放纵');
    expect(meaning).toBe(
      'v. 抛弃，遗弃；（因危险）离开，舍弃；中止，不再有；放弃（信念、信仰或看法）；陷入，沉湎于（某种情感）；n. 放任，放纵'
    );
  });

  test('旧版结构：tr[].l.i 兼容解析（return-phrase 对象格式）', () => {
    expect(extractMeaning(YOUDao_LEGACY_FIXTURE, 'abandon')).toBe(
      'vt. 丢弃；放弃，抛弃；n. 放任；纵情'
    );
  });

  test('近似词响应：词条头不匹配时返回空字符串', () => {
    expect(extractMeaning(YOUDao_FUZZY_AID, 'aid')).toBe('');
    expect(extractMeaning(YOUDao_FUZZY_ALTHOUGH, 'although')).toBe('');
  });

  test('无有效释义时返回空字符串', () => {
    expect(extractMeaning({}, 'abandon')).toBe('');
  });
});

describe('extractExamples', () => {
  test('新版结构：清洗 <b> 标签，保留英中成对', () => {
    const examples = extractExamples(YOUDao_NEW_FIXTURE, 'abandon');
    expect(examples).toHaveLength(3);
    expect(examples[0]).toEqual({
      en: 'The captain gave the order to abandon ship.',
      zh: '船长下令弃船。',
    });
    expect(examples.every((e) => !e.en.includes('<b>'))).toBe(true);
  });

  test('旧版结构：sentence 列表兼容', () => {
    const examples = extractExamples(YOUDao_LEGACY_FIXTURE, 'abandon');
    expect(examples).toEqual([{ en: 'He abandoned his car.', zh: '他丢弃了汽车。' }]);
  });

  test('近似词响应：词条头不匹配时例句为空', () => {
    expect(extractExamples(YOUDao_FUZZY_AID, 'aid')).toEqual([]);
    expect(extractExamples(YOUDao_FUZZY_ALTHOUGH, 'although')).toEqual([]);
  });

  test('超过上限时截断（默认 CRAWLER.MAX_EXAMPLES = 5）', () => {
    const many = {
      ec: { word: { 'return-phrase': 'word', trs: [{ pos: 'n.', tran: '词' }] } },
      blng_sents_part: {
        'sentence-pair': Array.from({ length: 8 }, (_, i) => ({
          sentence: `Sentence number ${i}.`,
          'sentence-eng': `Sentence number ${i}.`,
          'sentence-translation': `例句 ${i}。`,
        })),
      },
    };
    expect(extractExamples(many, 'word')).toHaveLength(5);
  });

  test('重复例句去重', () => {
    const dup = {
      ec: { word: { 'return-phrase': 'word', trs: [{ pos: 'n.', tran: '词' }] } },
      blng_sents_part: {
        'sentence-pair': [
          { sentence: 'Same sentence.', 'sentence-eng': 'Same sentence.', 'sentence-translation': '同句。' },
          { sentence: 'Same sentence.', 'sentence-eng': 'Same sentence.', 'sentence-translation': '同句。' },
        ],
      },
    };
    expect(extractExamples(dup, 'word')).toHaveLength(1);
  });
});

describe('parseYoudaoResponse', () => {
  test('新版真实结构：返回完整释义 + 双语例句', () => {
    const parsed = parseYoudaoResponse(YOUDao_NEW_FIXTURE, 'abandon');
    expect(parsed.meaning).toContain('v. 抛弃');
    expect(parsed.examples).toHaveLength(3);
  });

  test('核心回归：近似词响应被拒绝（aid 不再显示字母 x 的释义例句）', () => {
    expect(parseYoudaoResponse(YOUDao_FUZZY_AID, 'aid')).toBeNull();
  });

  test('核心回归：近似词响应被拒绝（although 不再显示 tip-up 的释义例句）', () => {
    expect(parseYoudaoResponse(YOUDao_FUZZY_ALTHOUGH, 'although')).toBeNull();
  });

  test('大小写变体：China 匹配 china 词条', () => {
    const chinaFixture = {
      ec: { word: { 'return-phrase': 'china', trs: [{ pos: 'n.', tran: '瓷器；中国' }] } },
    };
    const parsed = parseYoudaoResponse(chinaFixture, 'China');
    expect(parsed.meaning).toBe('n. 瓷器；中国');
  });

  test('带连字符词：X-ray 匹配 x-ray 词条', () => {
    const xrayFixture = {
      ec: { word: { 'return-phrase': 'x-ray', trs: [{ pos: 'n.', tran: 'X射线' }] } },
    };
    const parsed = parseYoudaoResponse(xrayFixture, 'X-ray');
    expect(parsed.meaning).toBe('n. X射线');
  });

  test('释义与例句都缺失时返回 null（视为抓取失败）', () => {
    expect(parseYoudaoResponse({}, 'abandon')).toBeNull();
    expect(parseYoudaoResponse(null, 'abandon')).toBeNull();
    expect(parseYoudaoResponse('not json', 'abandon')).toBeNull();
  });

  test('查询词为空时返回 null', () => {
    expect(parseYoudaoResponse(YOUDao_NEW_FIXTURE, '')).toBeNull();
    expect(parseYoudaoResponse(YOUDao_NEW_FIXTURE, undefined)).toBeNull();
  });

  test('只有释义没有例句也能解析成功', () => {
    const parsed = parseYoudaoResponse(
      {
        ec: { word: { 'return-phrase': 'word', trs: [{ pos: 'n.', tran: '放任，放纵' }] } },
      },
      'word'
    );
    expect(parsed.meaning).toBe('n. 放任，放纵');
    expect(parsed.examples).toEqual([]);
  });
});

describe('pickRandomExample', () => {
  test('随机返回列表中一条例句', () => {
    const examples = [
      { en: 'A.', zh: '甲。' },
      { en: 'B.', zh: '乙。' },
      { en: 'C.', zh: '丙。' },
    ];
    for (let i = 0; i < 20; i += 1) {
      const picked = pickRandomExample(examples);
      expect(examples).toContainEqual(picked);
    }
  });

  test('空列表返回 null', () => {
    expect(pickRandomExample([])).toBeNull();
    expect(pickRandomExample(null)).toBeNull();
    expect(pickRandomExample(undefined)).toBeNull();
  });
});
