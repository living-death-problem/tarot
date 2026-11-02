/* ============================================================
   基础配置：主题 / 牌阵 / 花色 / 数字 / 主题透镜
   ============================================================ */
(function () {
  'use strict';

  const topics = [
    {
      id: 'general', name: '综合运势', glyph: '✦',
      desc: '整体能量与近期走向',
      prompts: ['我最近的整体状态如何？', '接下来一个月我需要注意什么？'],
      placeholder: '例如：最近的整体状态如何？我需要注意什么？',
      closing: '牌面呈现的是倾向，不是判决。把它当作整理思路的线索，下一步仍然由你决定。'
    },
    {
      id: 'love', name: '爱情婚姻', glyph: '♡',
      desc: '恋爱、婚姻与亲密关系',
      prompts: ['我和 TA 的关系会如何发展？', '我该如何面对现在的感情状况？'],
      placeholder: '例如：我和 TA 的关系接下来会如何发展？',
      closing: '感情里没有标准答案。牌面只描述此刻的引力与阻力，怎么选、怎么谈，仍在你们手里。'
    },
    {
      id: 'wealth', name: '财运金钱', glyph: '◈',
      desc: '收入、投资与金钱流动',
      prompts: ['近期的财运趋势如何？', '这笔钱现在适合投出去吗？'],
      placeholder: '例如：近期的财运趋势如何？有没有要留意的风险？',
      closing: '财务决定尽量落在数字上。牌面可以提醒风险与节奏，但不能替代你自己的核算。'
    },
    {
      id: 'career', name: '事业工作', glyph: '⚔',
      desc: '职业发展、机遇与阻碍',
      prompts: ['我该不该换一份工作？', '当前的项目会顺利吗？'],
      placeholder: '例如：我该不该换一份工作？现在适合动吗？',
      closing: '把牌面当成一面镜子，先确认自己真正想要的位置，再考虑怎么走过去。'
    },
    {
      id: 'study', name: '学业考试', glyph: '✎',
      desc: '学习状态、考试与成长',
      prompts: ['这次考试我能发挥好吗？', '我适合往哪个方向深造？'],
      placeholder: '例如：这次考试我能发挥好吗？该重点补哪一块？',
      closing: '学习状态可以调整。先睡好、把目标拆小，再谈效率与结果。'
    },
    {
      id: 'future', name: '未来流向', glyph: '☾',
      desc: '接下来的趋势与转折',
      prompts: ['未来半年会发生什么？', '我在等的事情会有结果吗？'],
      placeholder: '例如：未来半年，我该把重心放在哪里？',
      closing: '未来不是写好的剧本。你此刻做的每一个小选择，都会改写它的走向。'
    },
    {
      id: 'health', name: '身心状态', glyph: '✚',
      desc: '身体、情绪与能量平衡',
      prompts: ['我最近的身心状态如何？', '我需要在哪些方面照顾自己？'],
      placeholder: '例如：我最近的身心状态如何？需要在哪些方面照顾自己？',
      closing: '身体的问题优先交给医生。塔罗只能提醒你留意节奏，不能作为诊断依据。'
    }
  ];

  const suits = {
    wands: {
      key: 'wands', cn: '权杖', en: 'Wands', element: '火', color: '#a95f36',
      blurb: '行动、热情与意志',
      svg: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 40 32 17"/><circle cx="34.5" cy="14.5" r="2.2"/><path d="M30 12.5c1.2-2.6 4.2-4 6.8-3.2"/><path d="M37 21.5c2.7.4 4.6 2.8 4.6 5.4"/><path d="M11 42l-1-3.4 3.4-1"/></svg>'
    },
    cups: {
      key: 'cups', cn: '圣杯', en: 'Cups', element: '水', color: '#47708f',
      blurb: '情感、关系与直觉',
      svg: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 10h22v7a11 11 0 0 1-22 0z"/><path d="M24 28v8"/><path d="M17 41h14"/><path d="M19.5 41c0-2.7 2-4.6 4.5-4.6s4.5 1.9 4.5 4.6"/><path d="M17 15h-3"/><path d="M31 15h3"/></svg>'
    },
    swords: {
      key: 'swords', cn: '宝剑', en: 'Swords', element: '风', color: '#59616f',
      blurb: '思维、沟通与冲突',
      svg: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M24 5v24"/><path d="M18 11l6-6 6 6"/><path d="M16 28h16"/><path d="M24 30v9"/><circle cx="24" cy="41.5" r="2"/></svg>'
    },
    pentacles: {
      key: 'pentacles', cn: '星币', en: 'Pentacles', element: '土', color: '#647a44',
      blurb: '物质、身体与积累',
      svg: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="24" r="16"/><path d="m24 10.5 3.7 11.4h12L29.8 29l3.7 11.4L24 33.3l-9.5 7.1L18.2 29 8.3 21.9h12z"/></svg>'
    }
  };

  const ranks = {
    1: {
      num: 'A', cn: '首牌', en: 'Ace',
      stage: '首牌是种子与机会，一切刚刚开始',
      action: '先迈出最小的一步，不要等条件齐全',
      actionRev: '先把“想做”落到一个具体动作上'
    },
    2: {
      num: 'II', cn: '二', en: 'Two',
      stage: '二号是选择与平衡，需要决定方向',
      action: '先做取舍，别让两边都占着',
      actionRev: '先停止摇摆，给一个选项设截止时间'
    },
    3: {
      num: 'III', cn: '三', en: 'Three',
      stage: '三号是初步的成果与协作，事情开始有回应',
      action: '先找人协作或验证一次',
      actionRev: '先确认合作方是否真的同频'
    },
    4: {
      num: 'IV', cn: '四', en: 'Four',
      stage: '四号是稳定与停顿，也可能因守成而停滞',
      action: '先稳住节奏，别用硬撑换进度',
      actionRev: '先允许自己停一下，别把休息当失败'
    },
    5: {
      num: 'V', cn: '五', en: 'Five',
      stage: '五号是冲突与失衡，摩擦带来调整的契机',
      action: '先把最明显的冲突摆到桌面上',
      actionRev: '先退出无意义的争执，保存力气'
    },
    6: {
      num: 'VI', cn: '六', en: 'Six',
      stage: '六号是流动与和解，能量重新顺畅',
      action: '先接住已经出现的善意或资源',
      actionRev: '先别急着和解，把条件谈清楚'
    },
    7: {
      num: 'VII', cn: '七', en: 'Seven',
      stage: '七号是评估与坚持，需要判断值不值得',
      action: '先评估投入产出，再决定是否加码',
      actionRev: '先停止加码，复盘已有投入'
    },
    8: {
      num: 'VIII', cn: '八', en: 'Eight',
      stage: '八号是加速与专注，投入会放大结果',
      action: '先集中在一件事上，别同时开太多线',
      actionRev: '先减少任务，把注意力拉回来'
    },
    9: {
      num: 'IX', cn: '九', en: 'Nine',
      stage: '九号接近临界，丰盛与疲惫并存',
      action: '先收尾，别再开新坑',
      actionRev: '先承认已经透支，安排真正的休息'
    },
    10: {
      num: 'X', cn: '十', en: 'Ten',
      stage: '十号是满溢与收尾，一个循环走到尽头',
      action: '先卸下一部分责任，别全扛',
      actionRev: '先放下不属于你的责任'
    },
    11: {
      num: 'P', cn: '侍从', en: 'Page',
      stage: '侍从是学习与消息，带着好奇试探',
      action: '先学清楚规则，再动手',
      actionRev: '先别急着证明自己，把基础补齐'
    },
    12: {
      num: 'N', cn: '骑士', en: 'Knight',
      stage: '骑士是行动与推进，速度带来变化',
      action: '先确认方向，再加速',
      actionRev: '先刹车，确认方向再动'
    },
    13: {
      num: 'Q', cn: '王后', en: 'Queen',
      stage: '王后是成熟与内在掌握，懂得照顾与拿捏',
      action: '先照顾好自己的状态，再照顾别人',
      actionRev: '先划清边界，别把别人的情绪全接住'
    },
    14: {
      num: 'K', cn: '国王', en: 'King',
      stage: '国王是掌控与责任，需要拍板与承担',
      action: '先拍板，并承担这个决定',
      actionRev: '先放下“必须赢”的执念'
    }
  };

  const lenses = {
    general: {
      wands: '火元素主导行动、热情与意志，事情的推进速度取决于你愿意投入多少',
      cups: '水元素主导情感、关系与直觉，答案往往藏在感受里',
      swords: '风元素主导思维、沟通与判断，关键在信息是否清晰',
      pentacles: '土元素主导现实、物质与身体，进展看得见摸得着'
    },
    love: {
      wands: '火元素让感情充满热度与主动，吸引力来得直接，也需要持续添柴',
      cups: '水元素直接对应爱与亲密，是感情牌阵里最核心的能量',
      swords: '风元素让感情的关键落在沟通与理解上，说清楚比猜更重要',
      pentacles: '土元素让感情落在承诺、日常与共同生活上'
    },
    wealth: {
      wands: '火元素对应开拓与主动出击，财运多来自项目推进与行动变现',
      cups: '水元素提醒金钱与情绪相连，别让心情决定账单',
      swords: '风元素要求用理性核对数字与条款，别被话术带走',
      pentacles: '土元素是财运最直接的对应，储蓄、资产与稳定收入'
    },
    career: {
      wands: '火元素是事业里的野心与执行力，适合开疆拓土而非守成',
      cups: '水元素让职场重心落在人际、协作与感受上',
      swords: '风元素对应策略、谈判与专业判断，脑力是主要资本',
      pentacles: '土元素对应扎实的积累、技能与长期职位'
    },
    study: {
      wands: '火元素带来学习热情与冲刺力，但要防止三分钟热度',
      cups: '水元素影响兴趣与心态，状态好比方法更重要',
      swords: '风元素是学习与考试的直接对应，重视理解与表达',
      pentacles: '土元素让学习靠日复一日的积累，慢但牢'
    },
    future: {
      wands: '火元素指向行动带来的新局，未来由你主动推动',
      cups: '水元素让未来走向跟着情感与关系起伏',
      swords: '风元素让未来取决于一个决定或一次沟通',
      pentacles: '土元素让未来呈缓慢而稳定的成形'
    },
    health: {
      wands: '火元素对应精力、体温与代谢，过量则容易透支上火',
      cups: '水元素对应情绪、睡眠与内在平衡，需要温柔照料',
      swords: '风元素对应呼吸、神经与思虑，过度用脑会消耗身体',
      pentacles: '土元素对应身体、饮食与作息，规律就是药'
    }
  };

  const advice = {
    general: '把注意力放回你能控制的部分',
    love: '先诚实面对自己的需要，再谈对方',
    wealth: '先看清现金流，再谈机会',
    career: '先确认方向，再投入力气',
    study: '先拆小目标，再谈坚持',
    future: '先做好眼前一步，未来才会回应你',
    health: '先照顾睡眠与饮食，其他再说'
  };

  const closing = {
    general: '牌面呈现的是倾向，不是判决。把它当作整理思路的线索，下一步仍然由你决定。',
    love: '感情里没有标准答案。牌面只描述此刻的引力与阻力，怎么选、怎么谈，仍在你们手里。',
    wealth: '财务决定尽量落在数字上。牌面可以提醒风险与节奏，但不能替代你自己的核算。',
    career: '把牌面当成一面镜子，先确认自己真正想要的位置，再考虑怎么走过去。',
    study: '学习状态可以调整。先睡好、把目标拆小，再谈效率与结果。',
    future: '未来不是写好的剧本。你此刻做的每一个小选择，都会改写它的走向。',
    health: '身体的问题优先交给医生。塔罗只能提醒你留意节奏，不能作为诊断依据。'
  };

  const spreads = [
    {
      id: 'single', name: '单张指引', count: 1, layout: 'single',
      desc: '一张牌，回答此刻最需要看见的事。适合快速确认状态。',
      positions: [{ name: '指引', prompt: '此刻最需要看见的' }]
    },
    {
      id: 'three', name: '时间之流', count: 3, layout: 'three',
      desc: '过去、现在、未来，看见事情的来路与去向。',
      positions: [
        { name: '过去', prompt: '事情的来路与根基' },
        { name: '现在', prompt: '当下的状态与关键' },
        { name: '未来', prompt: '接下来的走向' }
      ]
    },
    {
      id: 'love-tri', name: '心动三角', count: 3, layout: 'three',
      desc: '你、对方与关系走向。适合感情里看不清位置的时候。',
      positions: [
        { name: '你的心', prompt: '你在这段关系里的真实状态' },
        { name: 'TA 的心', prompt: '对方的状态与态度' },
        { name: '关系走向', prompt: '你们之间的趋势' }
      ]
    },
    {
      id: 'elements', name: '四元素罗盘', count: 4, layout: 'elements',
      desc: '行动、情感、思维、现实，四个维度检视同一件事。',
      positions: [
        { name: '火 · 行动', prompt: '动力、意志与可做的事' },
        { name: '水 · 情感', prompt: '感受、关系与内在需求' },
        { name: '风 · 思维', prompt: '想法、信息与沟通' },
        { name: '土 · 现实', prompt: '资源、身体与落地条件' }
      ]
    },
    {
      id: 'choice', name: '二选一', count: 5, layout: 'choice',
      desc: '现状加上两个选择的发展与结果，用来比较，而不是替你做决定。',
      positions: [
        { name: '现状', prompt: '你现在的真实处境' },
        { name: '选择 A · 发展', prompt: '选 A 之后的过程' },
        { name: '选择 A · 结果', prompt: '选 A 的倾向性结果' },
        { name: '选择 B · 发展', prompt: '选 B 之后的过程' },
        { name: '选择 B · 结果', prompt: '选 B 的倾向性结果' }
      ]
    },
    {
      id: 'relation', name: '关系之桥', count: 6, layout: 'relation',
      desc: '你、对方、关系现状、阻碍、建议与走向，适合认真谈一段关系。',
      positions: [
        { name: '你', prompt: '你在这段关系里的状态' },
        { name: '对方', prompt: '对方的状态与态度' },
        { name: '关系现状', prompt: '你们之间正在发生什么' },
        { name: '阻碍', prompt: '卡住关系的东西' },
        { name: '建议', prompt: '可以尝试的方向' },
        { name: '走向', prompt: '关系接下来的趋势' }
      ]
    },
    {
      id: 'celtic', name: '凯尔特十字', count: 10, layout: 'celtic',
      desc: '最完整的经典牌阵，从十个层面拆解一个问题。适合重要决定。',
      positions: [
        { name: '现状', prompt: '核心状态' },
        { name: '挑战', prompt: '横在面前的阻力或助力' },
        { name: '根基', prompt: '潜意识与深层原因' },
        { name: '过去', prompt: '刚刚过去的影响' },
        { name: '目标', prompt: '意识层面的追求' },
        { name: '近期', prompt: '不久后的发展' },
        { name: '自我', prompt: '你的态度与位置' },
        { name: '环境', prompt: '他人与环境的影响' },
        { name: '希望与恐惧', prompt: '你期待或害怕的事' },
        { name: '结果', prompt: '走向与落点' }
      ]
    },
    {
      id: 'free', name: '自由抽牌', count: 3, layout: 'free',
      desc: '自己决定抽 1–78 张，按抽牌顺序解读，不预设牌位。',
      positions: Array.from({ length: 78 }, (_, i) => ({
        name: '第 ' + (i + 1) + ' 张',
        prompt: '按顺序解读的第 ' + (i + 1) + ' 张'
      }))
    }
  ];

  window.TAROT_CORE = { topics, suits, ranks, lenses, advice, closing, spreads };
})();
