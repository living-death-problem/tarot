/* ============================================================
   星轨塔罗 · 交互逻辑
   ============================================================ */
(function () {
  'use strict';

  const CORE = window.TAROT_CORE;
  const topics = CORE.topics;
  const spreads = CORE.spreads;
  const suits = CORE.suits;
  const ranks = CORE.ranks;
  const lenses = CORE.lenses;

  const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
    'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'];
  const ELEM_CN = { fire: '火', water: '水', air: '风', earth: '土' };
  const OUTCOME = {
    single: [0], three: [2], 'love-tri': [2], elements: [3],
    choice: [2, 4], relation: [5], celtic: [9]
  };
  const COUNT_SPREAD = {
    1: 'single', 3: 'three', 4: 'elements', 5: 'choice', 6: 'relation', 10: 'celtic'
  };
  const ELEMENT_TEXT = {
    火: '行动与热情是主要动力。主动出手、把想法落地，比继续等待更有效。',
    水: '情绪与关系是主线。先处理感受与沟通，事情才推得动。',
    风: '信息与判断是关键。把事实核对清楚、把话说清楚，比情绪化反应有用。',
    土: '现实与积累是重点。钱、时间、身体都要算清楚，慢一点反而稳。'
  };

  const PREFS_KEY = 'astral-tarot-prefs-v1';
  const HISTORY_KEY = 'astral-tarot-history-v1';
  const DAILY_KEY = 'astral-tarot-daily-v1';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));
  const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

  /* ---------- 卡牌标准化 ---------- */
  const cards = window.TAROT_MAJOR.concat(window.TAROT_MINOR).map((c) => {
    if (c.arcana !== 'minor') return c;
    const s = suits[c.suit];
    const r = ranks[c.rank];
    return Object.assign({}, c, {
      name: s.cn + (c.rank === 1 ? '首牌' : r.cn),
      en: r.en + ' of ' + s.en,
      num: c.rank
    });
  });
  const byId = new Map(cards.map((c) => [c.id, c]));
  const topicMap = new Map(topics.map((t) => [t.id, t]));
  const spreadMap = new Map(spreads.map((s) => [s.id, s]));

  /* ---------- 状态 ---------- */
  const state = {
    view: 'reading',
    topic: 'general',
    spreadId: 'three',
    question: '',
    allowRev: true,
    onlyMajor: false,
    // 本次解读锁定
    readTopic: 'general',
    readSpreadId: 'three',
    freeCount: 3,
    readFreeCount: 3,
    deck: [],
    fan: [],
    picked: [],
    draw: [],
    revealed: [],
    phase: 'idle',
    saved: false,
    recordId: null,
    readingOpen: false,
    daily: { card: null, rev: false, flipped: false },
    modal: { cardId: null, rev: false, topic: 'general' },
    lib: { tab: 'all', q: '' },
    resizeTimer: null
  };

  let toastTimer = null;

  /* ---------- 小工具 ---------- */
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-show'), 2400);
  }

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function fmtDate(d) {
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function readTopic() { return topicMap.get(state.readTopic) || topics[0]; }

  function maxFree() { return state.onlyMajor ? 22 : 78; }

  function clampFree(n, max) {
    const value = Number(n);
    const upper = max || maxFree();
    if (!Number.isFinite(value)) return 3;
    return Math.max(1, Math.min(upper, Math.round(value)));
  }

  function readSpread() {
    if (state.readSpreadId === 'free') {
      const def = spreadMap.get('free');
      const count = Math.max(1, Math.min(state.readFreeCount || 3, def.positions.length));
      return Object.assign({}, def, { count: count, positions: def.positions.slice(0, count) });
    }
    return spreadMap.get(state.readSpreadId) || spreads[1];
  }

  function hasSummary(spread) {
    return spread.id !== 'free';
  }

  function syncFreeUI() {
    const row = $('#free-count');
    if (!row) return;
    const isFree = state.spreadId === 'free';
    row.hidden = !isFree;
    const max = Math.max(maxFree(), state.phase === 'done' ? (state.readFreeCount || 0) : 0);
    state.freeCount = clampFree(state.freeCount, max);
    const input = $('#free-count-input');
    if (input) {
      input.max = String(max);
      input.value = String(state.freeCount);
    }
    const note = $('#free-count-note');
    if (note) {
      const mapped = COUNT_SPREAD[state.freeCount];
      note.textContent = mapped
        ? state.freeCount + ' 张 → ' + spreadMap.get(mapped).name
        : state.freeCount + ' 张 → 自由抽牌 · 仅逐张解读';
    }
  }

  /* ---------- 偏好 ---------- */
  function loadPrefs() {
    try {
      const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
      if (typeof p.allowRev === 'boolean') state.allowRev = p.allowRev;
      if (typeof p.onlyMajor === 'boolean') state.onlyMajor = p.onlyMajor;
      if (p.topic && topicMap.has(p.topic)) state.topic = p.topic;
      if (p.spreadId && spreadMap.has(p.spreadId)) state.spreadId = p.spreadId;
      if (p.freeCount != null) state.freeCount = clampFree(p.freeCount);
    } catch (e) { /* 忽略损坏的偏好 */ }
    state.freeCount = clampFree(state.freeCount);
    state.readTopic = state.topic;
    state.readSpreadId = state.spreadId;
    state.readFreeCount = state.freeCount;
    $('#allow-rev').checked = state.allowRev;
    $('#only-major').checked = state.onlyMajor;
  }

  function savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({
        allowRev: state.allowRev,
        onlyMajor: state.onlyMajor,
        topic: state.topic,
        spreadId: state.spreadId,
        freeCount: state.freeCount
      }));
    } catch (e) { /* 忽略 */ }
  }

  /* ---------- 主题 / 牌阵 / 提示 ---------- */
  function renderTopics() {
    $('#topic-grid').innerHTML = topics.map((t) =>
      '<button class="topic' + (t.id === state.topic ? ' is-active' : '') + '" type="button" data-topic="' + t.id + '" aria-pressed="' + (t.id === state.topic) + '">' +
        '<span class="t-glyph">' + t.glyph + '</span>' +
        '<strong>' + esc(t.name) + '</strong>' +
        '<small>' + esc(t.desc) + '</small>' +
      '</button>'
    ).join('');
  }

  function renderSpreads() {
    $('#spread-grid').innerHTML = spreads.map((s) => {
      const badge = s.id === 'free'
        ? (state.onlyMajor ? '1–22 张' : '1–78 张')
        : s.count + ' 张';
      return '<button class="spread' + (s.id === state.spreadId ? ' is-active' : '') + '" type="button" data-spread="' + s.id + '" aria-pressed="' + (s.id === state.spreadId) + '">' +
        '<span class="spread-top"><strong>' + esc(s.name) + '</strong><span class="count">' + badge + '</span></span>' +
        '<p>' + esc(s.desc) + '</p>' +
      '</button>';
    }).join('');
  }

  function renderPrompts() {
    const t = topicMap.get(state.topic) || topics[0];
    $('#question').placeholder = t.placeholder;
    $('#prompts').innerHTML = t.prompts.map((q) =>
      '<button class="prompt" type="button" data-q="' + esc(q) + '">' + esc(q) + '</button>'
    ).join('');
  }

  function updateDeckNote() {
    $('#deck-note').textContent = (state.onlyMajor ? '22' : '78') + ' 张 · 洗牌后不放回';
  }

  /* ---------- 视图 ---------- */
  function switchView(view) {
    state.view = view;
    $$('.view').forEach((v) => { v.hidden = v.id !== 'view-' + view; });
    $$('.nav-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.view === view));
    if (view === 'library') renderLibrary();
    if (view === 'history') renderHistory();
    if (view === 'reading' && state.phase === 'picking') {
      setTimeout(buildFanRows, 60);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setReadingHead(title, meta) {
    $('#reading-title').textContent = title;
    $('#reading-meta').textContent = meta;
  }

  /* ---------- 开始抽牌 ---------- */
  function startDraw() {
    if (state.phase === 'shuffling') return;
    closeHelp();
    if (state.spreadId === 'free') {
      state.freeCount = clampFree($('#free-count-input').value);
    }
    state.readTopic = state.topic;
    state.readSpreadId = state.spreadId;
    state.question = $('#question').value.trim();
    state.deck = shuffle(state.onlyMajor ? window.TAROT_MAJOR.slice() : cards.slice());
    state.fan = state.deck.slice();
    if (state.readSpreadId === 'free') {
      const requested = clampFree(state.freeCount, state.deck.length);
      state.freeCount = requested;
      state.readFreeCount = requested;
      state.readSpreadId = COUNT_SPREAD[requested] || 'free';
    }
    syncFreeUI();
    state.picked = [];
    state.draw = [];
    state.revealed = [];
    state.saved = false;
    state.recordId = null;
    state.phase = 'shuffling';
    state.readingOpen = true;

    const spread = readSpread();
    const topic = readTopic();

    $('#reading').hidden = false;
    $('#summary').hidden = true;
    $('#summary').innerHTML = '';
    $('#details').innerHTML = '';
    $('#pick-tray').hidden = true;
    $('#reading-question').textContent = state.question ? '「' + state.question + '」' : '';
    setReadingHead('正在洗牌', topic.name + ' · ' + spread.name);
    $('#flip-hint').textContent = '正在打乱牌组…';
    $('#reveal-all').hidden = true;

    const board = $('#board');
    board.className = 'board board--fan';
    board.innerHTML = '<div class="shuffle-stack">' + [0, 1, 2, 3, 4].map((i) =>
      '<div class="shuffle-card card-back" style="--i:' + i + '"></div>'
    ).join('') + '</div>';

    const btn = $('#draw-btn');
    btn.disabled = true;
    btn.querySelector('span').textContent = '洗牌中…';

    $('#reading').scrollIntoView({ behavior: 'smooth', block: 'start' });

    setTimeout(() => {
      btn.disabled = false;
      btn.querySelector('span').textContent = '洗牌并抽牌';
      renderFan();
    }, 760);
  }

  function renderFan() {
    state.phase = 'picking';
    state.picked = [];
    const spread = readSpread();

    const board = $('#board');
    board.className = 'board board--fan';
    board.innerHTML = '<div class="fan-deck" id="fan-deck"></div>';

    $('#pick-tray').hidden = false;
    renderPickTray();
    setReadingHead(spread.name, (topicMap.get(state.readTopic) || topics[0]).name +
      ' · 从 ' + state.fan.length + ' 张中选出 ' + spread.count + ' 张');
    $('#reveal-all').hidden = true;
    updatePickHint();
    buildFanRows();
  }

  function fanConfig() {
    const narrow = window.matchMedia('(max-width: 720px)').matches;
    if (window.TAROT_IPAD) {
      return narrow
        ? { cardW: 46, perRowMax: 13, angle: 26 }
        : { cardW: 64, perRowMax: 20, angle: 32 };
    }
    return narrow
      ? { cardW: 46, perRowMax: 13, angle: 26 }
      : { cardW: 64, perRowMax: 26, angle: 34 };
  }

  function buildFanRows() {
    const deckEl = $('#fan-deck');
    if (!deckEl) return;
    const cfg = fanConfig();
    const rowCount = Math.max(1, Math.ceil(state.fan.length / cfg.perRowMax));
    const perRow = Math.ceil(state.fan.length / rowCount);
    let html = '';
    let idx = 0;
    for (let r = 0; r < rowCount; r++) {
      html += '<div class="fan-row">';
      for (let c = 0; c < perRow && idx < state.fan.length; c++, idx++) {
        html += '<button class="fan-card' +
          (state.picked.indexOf(idx) >= 0 ? ' is-picked' : '') +
          '" type="button" data-i="' + idx + '" aria-label="选择第 ' + (idx + 1) + ' 张牌">' +
          '<span class="fan-face card-back" aria-hidden="true"></span>' +
        '</button>';
      }
      html += '</div>';
    }
    deckEl.innerHTML = html;
    positionFanRows();
  }

  function positionFanRows() {
    const cfg = fanConfig();
    $$('#fan-deck .fan-row').forEach((row) => {
      const cards = $$('.fan-card', row);
      const n = cards.length;
      const W = row.clientWidth || 900;
      const spreadW = Math.max(0, W - cfg.cardW - 10);
      cards.forEach((el, i) => {
        const t = n > 1 ? (i / (n - 1)) * 2 - 1 : 0;
        el.style.setProperty('--x', (t * spreadW / 2).toFixed(1) + 'px');
        el.style.setProperty('--y', (Math.abs(t) * Math.abs(t) * 8).toFixed(1) + 'px');
        el.style.setProperty('--r', (t * cfg.angle).toFixed(1) + 'deg');
        el.style.setProperty('--z', String(i + 1));
      });
    });
  }

  function renderPickTray() {
    const spread = readSpread();
    const tray = $('#pick-tray');
    if (spread.count > 12) {
      tray.innerHTML = '<span class="pick-many">已选 ' + state.picked.length + ' / ' + spread.count + ' 张</span>';
      return;
    }
    tray.innerHTML = Array.from({ length: spread.count }, (_, i) =>
      i < state.picked.length
        ? '<span class="pick-slot card-back" title="已选第 ' + (i + 1) + ' 张"></span>'
        : '<span class="pick-slot is-empty" aria-hidden="true"></span>'
    ).join('');
  }

  function updatePickHint() {
    const spread = readSpread();
    const n = state.picked.length;
    const hint = $('#flip-hint');
    if (n < spread.count) {
      hint.innerHTML = '已洗好 ' + state.fan.length + ' 张 · 点选 ' + spread.count + ' 张 · 已选 <span>' + n + '</span>/' + spread.count +
        '<button class="link-btn" type="button" data-action="auto-pick">随机替我选</button>';
    } else {
      hint.textContent = '已选 ' + spread.count + ' 张 · 正在摊牌…';
    }
  }

  function pickFanCard(i) {
    if (state.phase !== 'picking') return;
    if (state.picked.indexOf(i) >= 0) return;
    const spread = readSpread();
    if (state.picked.length >= spread.count) return;

    state.picked.push(i);
    const el = $('#board .fan-card[data-i="' + i + '"]');
    if (el) el.classList.add('is-picked');
    renderPickTray();
    updatePickHint();

    if (state.picked.length >= spread.count) {
      state.phase = 'dealing';
      setTimeout(finishPicking, 460);
    }
  }

  function autoPick() {
    if (state.phase !== 'picking') return;
    const spread = readSpread();
    const rest = state.fan.map((_, i) => i).filter((i) => state.picked.indexOf(i) < 0);
    const pool = shuffle(rest);
    const need = spread.count - state.picked.length;
    for (let k = 0; k < need; k++) {
      const idx = pool[k];
      state.picked.push(idx);
      const el = $('#board .fan-card[data-i="' + idx + '"]');
      if (el) el.classList.add('is-picked');
    }
    state.phase = 'dealing';
    renderPickTray();
    updatePickHint();
    setTimeout(finishPicking, 520);
  }

  function finishPicking() {
    if (state.phase !== 'dealing') return;
    const spread = readSpread();
    const topic = readTopic();
    state.draw = state.picked.map((deckIndex, pos) => ({
      cardId: state.fan[deckIndex].id,
      rev: state.allowRev && Math.random() < 0.35,
      pos: pos
    }));
    state.revealed = state.draw.map(() => false);
    state.phase = 'flipping';
    state.saved = false;
    $('#pick-tray').hidden = true;
    renderBoard();
    setReadingHead(spread.name, topic.name + ' · ' + spread.count + ' 张牌');
    updateFlipHint();
    syncTools();
    $('#summary').hidden = true;
    $('#summary').innerHTML = '';
    $('#details').innerHTML = '';
  }

  /* ---------- 牌面 ---------- */
  function cardFrameHTML(card) {
    if (card.arcana === 'major') {
      return '<span class="card-frame">' +
        '<span class="f-num">' + ROMAN[card.num] + '</span>' +
        '<span class="f-sigil"><span class="f-glyph">' + card.glyph + '</span></span>' +
        '<span class="f-meta"><span class="f-name">' + esc(card.name) + '</span><span class="f-en">' + esc(card.en) + '</span></span>' +
      '</span>';
    }
    const s = suits[card.suit];
    const r = ranks[card.rank];
    return '<span class="card-frame">' +
      '<span class="f-num">' + r.num + '</span>' +
      '<span class="f-sigil"><span class="f-suit" style="--sc:' + s.color + '">' + s.svg + '</span></span>' +
      '<span class="f-meta"><span class="f-name">' + esc(card.name) + '</span><span class="f-en">' + esc(card.en) + '</span></span>' +
    '</span>';
  }

  function renderBoard() {
    const spread = readSpread();
    const board = $('#board');
    board.className = 'board board--' + spread.layout;
    if (spread.layout === 'free') {
      const count = spread.count;
      const mobile = window.matchMedia('(max-width: 720px)').matches;
      let cols;
      if (mobile) {
        cols = count <= 2 ? count : (window.innerWidth < 430 ? 3 : 4);
      } else if (count <= 4) {
        cols = count;
      } else if (count <= 6) {
        cols = 3;
      } else if (count <= 8) {
        cols = 4;
      } else if (count <= 12) {
        cols = 6;
      } else {
        cols = 8;
      }
      board.style.gridTemplateColumns = 'repeat(' + cols + ', minmax(0, 1fr))';
      board.classList.toggle('is-dense', count > 12);
    } else {
      board.style.gridTemplateColumns = '';
      board.classList.remove('is-dense');
    }
    board.innerHTML = state.draw.map((item, i) => {
      const card = byId.get(item.cardId);
      if (!card) return '';
      const flipped = !!state.revealed[i];
      const pos = spread.positions[i] || { name: '第 ' + (i + 1) + ' 张' };
      return '<div class="slot' + (flipped ? ' is-revealed' : '') + '" data-i="' + i + '" style="--d:' + i + '">' +
        '<button class="card' + (flipped ? ' is-flipped' : '') + (item.rev ? ' is-reversed' : '') + '" type="button" data-i="' + i + '" aria-label="' + (flipped ? '' : '翻开') + '第 ' + (i + 1) + ' 张牌：' + esc(pos.name) + '">' +
          '<span class="card-inner">' +
            '<span class="card-face card-back"></span>' +
            '<span class="card-face card-front">' + cardFrameHTML(card) + '</span>' +
          '</span>' +
        '</button>' +
        '<span class="slot-label"><span class="slot-idx">' + (i + 1) + '</span>' + esc(pos.name) +
          (item.rev ? '<span class="rev-tag">逆位</span>' : '') +
        '</span>' +
      '</div>';
    }).join('');
  }

  function flipCard(i) {
    if (state.phase !== 'flipping' && state.phase !== 'done') return;
    if (!state.draw[i] || state.revealed[i]) return;
    state.revealed[i] = true;
    const slot = $('#board .slot[data-i="' + i + '"]');
    if (slot) {
      slot.classList.add('is-revealed');
      const c = slot.querySelector('.card');
      if (c) c.classList.add('is-flipped');
    }
    renderDetails();
    updateFlipHint();

    if (state.revealed.every(Boolean)) {
      state.phase = 'done';
      finishReading();
    }
  }

  function revealAll() {
    if (!state.draw.length) return;
    const pending = state.draw.map((_, i) => i).filter((i) => !state.revealed[i]);
    const step = pending.length > 20 ? 35 : 110;
    pending.forEach((i, k) => {
      setTimeout(() => flipCard(i), k * step);
    });
  }

  function updateFlipHint() {
    if (!state.draw.length) return;
    const total = state.draw.length;
    const done = state.revealed.filter(Boolean).length;
    if (done >= total) {
      $('#flip-hint').textContent = '全部翻开 · ' +
        (readSpread().id === 'free' ? '逐张解读已生成' : '解读已生成');
      return;
    }
    $('#flip-hint').innerHTML = '轻触牌背翻开 · 已翻开 <span>' + done + '</span>/' + total;
  }

  function syncTools() {
    const all = state.draw.length > 0 && state.revealed.every(Boolean);
    $('#reveal-all').hidden = !(state.draw.length > 0 && !all);
  }

  /* ---------- 解读 ---------- */
  function minorTopic(card, topicId, rev) {
    const lens = lenses[topicId][card.suit];
    const stage = ranks[card.rank].stage;
    const ori = rev ? '逆位表示这股能量受阻、过度或向内收。' : '正位表示这股能量正在顺畅表达。';
    const kws = (rev ? card.kwRev : card.kw).slice(0, 3).join('、');
    const meaning = rev ? card.rev : card.up;
    return lens + '。' + stage + '。' + ori + '关键词「' + kws + '」：' + meaning +
      (/[。！？!?]$/.test(meaning) ? '' : '。');
  }

  function topicReading(card, topicId, rev) {
    if (card.arcana === 'major') {
      const t = card.topics && card.topics[topicId];
      if (t) return rev ? t.r : t.u;
      return rev ? card.rev : card.up;
    }
    return minorTopic(card, topicId, rev);
  }

  function detailHTML(i) {
    const item = state.draw[i];
    const card = byId.get(item.cardId);
    const spread = readSpread();
    const topic = readTopic();
    const pos = spread.positions[i] || { name: '第 ' + (i + 1) + ' 张' };
    const kws = item.rev ? card.kwRev : card.kw;
    const text = topicReading(card, state.readTopic, item.rev);
    return '<article class="detail" data-detail="' + i + '">' +
      '<div class="detail-head">' +
        '<span class="pos-badge">' + (i + 1) + '</span>' +
        '<h3>' + esc(pos.name) + '</h3>' +
        '<span class="orient' + (item.rev ? ' rev' : '') + '">' + (item.rev ? '逆位' : '正位') + '</span>' +
      '</div>' +
      '<div><span class="detail-card-name">' + esc(card.name) + '</span><span class="detail-card-en">' + esc(card.en) + '</span></div>' +
      '<div class="kw-row">' + kws.map((k) => '<span>' + esc(k) + '</span>').join('') + '</div>' +
      (card.arcana === 'minor' ? '' : '<p>' + esc(item.rev ? card.rev : card.up) + '</p>') +
      '<div class="topic-note"><h4>在「' + esc(topic.name) + '」里</h4><p>' + esc(text) + '</p></div>' +
    '</article>';
  }

  function renderDetails() {
    const wrap = $('#details');
    state.revealed.forEach((ok, i) => {
      if (!ok) return;
      if (wrap.querySelector('[data-detail="' + i + '"]')) return;
      const holder = document.createElement('div');
      holder.innerHTML = detailHTML(i);
      const node = holder.firstElementChild;
      if (!node) return;
      node.classList.add('is-new');
      node.addEventListener('animationend', () => node.classList.remove('is-new'), { once: true });
      const next = Array.prototype.find.call(wrap.children, (el) => Number(el.dataset.detail) > i);
      if (next) {
        wrap.insertBefore(node, next);
      } else {
        wrap.appendChild(node);
      }
    });
  }

  function shortMeaning(text, max) {
    if (!text) return '';
    const first = String(text).split(/[。！？!?]/)[0].trim();
    const s = first || String(text).trim();
    return s.length > max ? s.slice(0, max) + '…' : s;
  }

  function buildSummary() {
    const spread = readSpread();
    const topic = readTopic();
    const items = state.draw.map((d) => ({ card: byId.get(d.cardId), rev: d.rev }));
    const n = items.length;
    const majorCount = items.filter((x) => x.card.arcana === 'major').length;
    const revCount = items.filter((x) => x.rev).length;
    const elementCount = { 火: 0, 水: 0, 风: 0, 土: 0 };
    items.forEach((x) => {
      const el = x.card.arcana === 'major' ? ELEM_CN[x.card.element] : suits[x.card.suit].element;
      if (elementCount[el] != null) elementCount[el]++;
    });
    const ordered = Object.keys(elementCount)
      .map((k) => [k, elementCount[k]])
      .sort((a, b) => b[1] - a[1]);
    const topCount = ordered[0][1];
    const dominant = ordered.filter((x) => x[1] === topCount).map((x) => x[0]);

    const outIdx = OUTCOME[spread.id] || [n - 1];
    const outcomes = outIdx.map((i) => ({ i: i, item: items[i] })).filter((o) => o.item);
    const primary = outcomes[0] || { i: n - 1, item: items[n - 1] };
    const pCard = primary.item.card;
    const pRev = primary.item.rev;
    const pPos = (spread.positions[primary.i] || { name: '结果' }).name;
    const pFull = pRev ? pCard.rev : pCard.up;
    const pShort = shortMeaning(pFull, 72);
    const pTopic = pCard.arcana === 'major'
      ? shortMeaning(topicReading(pCard, topic.id, pRev), 82)
      : '';

    const focusMap = {
      single: 0, three: 1, 'love-tri': 0, elements: 3, choice: 0, relation: 3, celtic: 1
    };
    let focusIdx = focusMap[spread.id] != null ? focusMap[spread.id] : 0;
    if (spread.id === 'elements') {
      const revCandidates = items
        .map((x, i) => (x.rev ? i : -1))
        .filter((i) => i >= 0 && outIdx.indexOf(i) < 0);
      focusIdx = revCandidates.length ? revCandidates[0] : 0;
    }
    if (!items[focusIdx]) focusIdx = primary.i;
    const fItem = items[focusIdx];
    const fCard = fItem.card;
    const fRev = fItem.rev;
    const fPos = (spread.positions[focusIdx] || { name: '关键位置' }).name;
    const fShort = shortMeaning(fRev ? fCard.rev : fCard.up, 70);

    const keyMap = {
      single: [0], three: [0, 1, 2], 'love-tri': [0, 1, 2],
      elements: [0, 1, 2, 3], choice: [0, 1, 2, 3, 4],
      relation: [0, 1, 3, 4, 5], celtic: [0, 1, 4, 9]
    };
    const keyIdx = (keyMap[spread.id] || [0]).filter((i) => items[i]);
    const posHTML = keyIdx.map((i) => {
      const it = items[i];
      const card = it.card;
      const pos = (spread.positions[i] || { name: '第 ' + (i + 1) + ' 张' }).name;
      return '<div class="summary-pos">' +
        '<div class="sp-top"><span class="sp-name">' + esc(pos) + '</span>' +
        '<span class="sp-orient' + (it.rev ? ' rev' : '') + '">' + (it.rev ? '逆位' : '正位') + '</span></div>' +
        '<strong>' + esc(card.name) + '</strong>' +
        '<p>' + esc(shortMeaning(it.rev ? card.rev : card.up, 52)) + '</p>' +
      '</div>';
    }).join('');

    const revItems = items.map((x, i) => ({ i: i, x: x })).filter((y) => y.x.rev);
    const revLine = revItems.length
      ? '落在「' + revItems.map((y) => (spread.positions[y.i] || { name: '第 ' + (y.i + 1) + ' 张' }).name).join('、') + '」：' +
        revItems.slice(0, 3).map((y) => y.x.card.name + '——' + shortMeaning(y.x.card.rev, 36)).join('；') + '。'
      : '没有逆位牌，能量整体外放，适合把话说明、把事推进。';

    const structureLine = '大阿卡纳 ' + majorCount + '/' + n + '；元素 ' +
      ['火', '水', '风', '土'].map((e) => e + elementCount[e]).join('、') + '。';

    let core;
    if (spread.id === 'choice') {
      core = '两个结果位：' + outcomes.map((o) => {
        const card = o.item.card;
        const pos = (spread.positions[o.i] || { name: '结果' }).name;
        return '「' + pos + '」是 ' + card.name + (o.item.rev ? '（逆位）' : '') +
          '——' + shortMeaning(o.item.rev ? card.rev : card.up, 48);
      }).join('；') + '。';
    } else {
      core = '「' + esc(pPos) + '」落在 ' + esc(pCard.name) + (pRev ? '（逆位）' : '') + '：' + esc(pFull) +
        (pTopic ? ' 放到「' + esc(topic.name) + '」里，' + esc(pTopic) + '。' : '');
    }

    let synthesis = '';
    if (spread.id !== 'choice' && spread.id !== 'single') {
      synthesis = '把「' + fPos + '」和「' + pPos + '」放在一起看：' +
        fCard.name + (fRev ? '（逆位）' : '') + '说的是「' + fShort + '」，而 ' +
        pCard.name + (pRev ? '（逆位）' : '') + '说的是「' + pShort + '」。' +
        (fRev
          ? '卡点更像在「' + fPos + '」，不是结果本身；先把这一层理顺。'
          : '两端并不矛盾，重点是把「' + fPos + '」的状态带到「' + pPos + '」去。');
    }

    const actions = [];
    if (focusIdx !== primary.i) {
      actions.push({ label: '先处理「' + fPos + '」', text: fShort });
    }
    if (spread.id === 'choice') {
      actions.push({
        label: '选择',
        text: '比较两个结果位的代价，选你更愿意承担的那个，而不是看起来更好的那个'
      });
    } else {
      actions.push({ label: '结果位「' + pPos + '」', text: pShort });
    }
    if (spread.id === 'relation' && items[4]) {
      const adv = items[4];
      actions.push({
        label: '「' + (spread.positions[4] || { name: '建议' }).name + '」',
        text: shortMeaning(adv.rev ? adv.card.rev : adv.card.up, 56)
      });
    }

    const chips = [];
    items.forEach((x) => {
      (x.rev ? x.card.kwRev : x.card.kw).forEach((k) => {
        if (chips.indexOf(k) < 0) chips.push(k);
      });
    });

    const bars = ['火', '水', '风', '土'].map((el) => {
      const c = elementCount[el];
      const pct = n ? Math.round((c / n) * 100) : 0;
      return '<div class="el-row"><span class="el-name">' + el + '</span>' +
        '<div class="el-track"><div class="el-fill" style="width:' + pct + '%"></div></div>' +
        '<span class="el-count">' + c + '</span></div>';
    }).join('');

    const questionNote = state.question
      ? '你问的是「' + esc(state.question) + '」。'
      : '这次按「' + esc(topic.name) + '」的角度看。';

    return '<div class="summary-head"><h2>整体解读</h2><span>' + esc(topic.name) + ' · ' + esc(spread.name) + '</span></div>' +
      '<div class="summary-core">' +
        '<p class="summary-kicker">核心回答</p>' +
        '<p class="summary-answer">' + core + '</p>' +
        '<p class="summary-core-note">' + questionNote + '</p>' +
      '</div>' +
      '<div class="summary-section">' +
        '<h3>牌面在说什么</h3>' +
        '<div class="summary-pos-grid">' + posHTML + '</div>' +
      '</div>' +
      (synthesis
        ? '<div class="summary-section"><h3>把牌连起来看</h3><p class="summary-synthesis">' + esc(synthesis) + '</p></div>'
        : '') +
      '<div class="summary-section">' +
        '<h3>关键点</h3>' +
        '<ul class="summary-key-list">' +
          '<li><strong>' + esc(fPos) + '</strong>：' + esc(fCard.name) + (fRev ? '（逆位）' : '') + '——' + esc(fShort) + '。</li>' +
          '<li><strong>逆位</strong>：' + esc(revLine) + '</li>' +
          '<li><strong>结构</strong>：' + esc(structureLine) + '</li>' +
        '</ul>' +
      '</div>' +
      '<div class="summary-section summary-actions">' +
        '<h3>下一步</h3>' +
        '<ul>' + actions.map((a) => '<li><strong>' + esc(a.label) + '：</strong>' + esc(a.text) + '。</li>').join('') + '</ul>' +
      '</div>' +
      '<div class="summary-structure">' +
        '<h3>牌面结构</h3>' +
        '<div class="summary-stats">' +
          '<div class="stat"><b>' + majorCount + '/' + n + '</b><span>大阿卡纳</span></div>' +
          '<div class="stat"><b>' + revCount + '</b><span>逆位牌</span></div>' +
          '<div class="stat"><b>' + (dominant.join('/') || '—') + '</b><span>主导元素</span></div>' +
          '<div class="stat"><b>' + spread.count + '</b><span>牌阵张数</span></div>' +
        '</div>' +
        '<p class="summary-legend">大阿卡纳 = 22 张主牌 · 小阿卡纳 = 56 张日常牌 · 逆位 = 能量受阻或向内 · 元素 = 火/水/风/土的倾向</p>' +
        bars +
      '</div>' +
      '<div class="summary-chips"><span class="chips-title">关键词</span>' +
        chips.slice(0, 10).map((k) => '<span class="chip">' + esc(k) + '</span>').join('') +
      '</div>' +
      '<p class="disclaimer">塔罗呈现的是当下能量的倾向，不是注定的结果，也不替代医疗、法律与投资建议。' +
      '如果这件事牵涉身体或重大财务决定，请同时咨询专业人士。选择权始终在你手里。</p>';
  }

  function renderSummary() {
    const el = $('#summary');
    el.innerHTML = buildSummary();
    el.hidden = false;
  }

  function finishReading() {
    const spread = readSpread();
    if (hasSummary(spread)) {
      renderSummary();
    } else {
      const el = $('#summary');
      el.hidden = true;
      el.innerHTML = '';
    }
    syncTools();
    updateFlipHint();
    const saved = saveReading();
    const label = spread.id === 'free' ? '逐张解读' : '解读';
    toast(saved ? label + '已生成，已存入记录' : label + '已生成，但记录未能保存');
  }

  /* ---------- 记录 ---------- */
  function loadHistory() {
    try {
      const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      return Array.isArray(raw) ? raw.filter((r) => r && Array.isArray(r.cards)) : [];
    } catch (e) {
      return [];
    }
  }

  function saveReading() {
    if (!state.draw.length) return false;
    if (state.saved) return true;
    const rec = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      ts: Date.now(),
      topic: state.readTopic,
      spreadId: state.readSpreadId,
      question: state.question,
      cards: state.draw.map((d) => ({ id: d.cardId, rev: d.rev }))
    };
    try {
      const list = loadHistory();
      list.unshift(rec);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 60)));
      state.saved = true;
      state.recordId = rec.id;
      renderHistory();
      refreshHistoryCount();
      return true;
    } catch (e) {
      return false;
    }
  }

  function refreshHistoryCount() {
    const n = loadHistory().length;
    const el = $('#history-count');
    el.textContent = String(n);
    el.hidden = n === 0;
  }

  function renderHistory() {
    const list = loadHistory();
    const wrap = $('#history-list');
    const empty = $('#history-empty');
    const clear = $('#clear-history');
    refreshHistoryCount();

    if (!list.length) {
      wrap.innerHTML = '';
      empty.hidden = false;
      clear.hidden = true;
      return;
    }
    empty.hidden = true;
    clear.hidden = false;

    wrap.innerHTML = list.map((rec) => {
      const spread = spreadMap.get(rec.spreadId) || { name: '牌阵' };
      const topic = topicMap.get(rec.topic) || { name: '综合' };
      const d = new Date(rec.ts);
      const cardsHtml = rec.cards.map((c) => {
        const card = byId.get(c.id);
        if (!card) return '';
        return '<span class="' + (c.rev ? 'rev' : '') + '">' + esc(card.name) + (c.rev ? ' 逆' : '') + '</span>';
      }).join('');
      const q = rec.question ? esc(rec.question) : '未填写具体问题';
      return '<article class="rec" data-id="' + rec.id + '">' +
        '<div class="rec-main">' +
          '<div class="rec-top"><span class="rec-topic">' + esc(topic.name) + '</span><span>' + esc(spread.name) + '</span><time>' + fmtDate(d) + '</time></div>' +
          '<h3>' + q + '</h3>' +
          '<div class="rec-cards">' + cardsHtml + '</div>' +
        '</div>' +
        '<div class="rec-actions">' +
          '<button class="btn btn-ghost" type="button" data-action="view-record" data-id="' + rec.id + '">查看</button>' +
          '<button class="btn btn-ghost btn-danger" type="button" data-action="del-record" data-id="' + rec.id + '">删除</button>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  function deleteRecord(id) {
    try {
      const list = loadHistory().filter((r) => r.id !== id);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
      renderHistory();
      toast('已删除这条记录');
    } catch (e) {
      toast('删除失败，浏览器存储不可用');
    }
  }

  function clearHistory() {
    if (!loadHistory().length) return;
    if (!window.confirm('清空全部占卜记录？此操作不可恢复。')) return;
    try {
      localStorage.removeItem(HISTORY_KEY);
      renderHistory();
      toast('记录已清空');
    } catch (e) {
      toast('清空失败，浏览器存储不可用');
    }
  }

  function viewRecord(id) {
    const rec = loadHistory().filter((r) => r.id === id)[0];
    if (!rec) return;
    const spread = spreadMap.get(rec.spreadId) || spreads[1];
    const topic = topicMap.get(rec.topic) || topics[0];
    const draw = rec.cards.map((c, i) => ({ cardId: c.id, rev: !!c.rev, pos: i })).filter((d) => byId.has(d.cardId));
    if (!draw.length) { toast('这条记录没有可读取的牌'); return; }

    state.readTopic = topic.id;
    state.readSpreadId = spread.id;
    state.topic = topic.id;
    state.spreadId = spread.id;
    state.question = rec.question || '';
    state.draw = draw;
    state.revealed = draw.map(() => true);
    state.phase = 'done';
    state.saved = true;
    state.recordId = rec.id;
    state.readingOpen = true;
    if (spread.id === 'free') {
      state.freeCount = draw.length;
      state.readFreeCount = draw.length;
    }

    $('#question').value = state.question;
    $('#reading-question').textContent = state.question ? '「' + state.question + '」' : '';
    $('#details').innerHTML = '';
    $('#summary').innerHTML = '';
    $('#summary').hidden = true;
    $('#reading').hidden = false;

    const actualSpread = readSpread();
    renderTopics();
    renderSpreads();
    renderPrompts();
    syncFreeUI();
    renderBoard();
    renderDetails();
    if (hasSummary(actualSpread)) {
      renderSummary();
    } else {
      $('#summary').hidden = true;
    }
    setReadingHead(actualSpread.name, topic.name + ' · ' + actualSpread.count + ' 张牌');
    updateFlipHint();
    syncTools();
    switchView('reading');
    setTimeout(() => $('#reading').scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }

  /* ---------- 牌库 ---------- */
  function miniHTML(card) {
    const icon = card.arcana === 'major'
      ? '<span class="m-glyph">' + card.glyph + '</span>'
      : '<span class="m-icon" style="--sc:' + suits[card.suit].color + '">' + suits[card.suit].svg + '</span>';
    const num = card.arcana === 'major' ? ROMAN[card.num] : ranks[card.rank].num;
    return '<button class="mini" type="button" data-card="' + card.id + '" aria-label="查看 ' + esc(card.name) + ' 的牌义">' +
      '<span class="m-num">' + num + '</span>' +
      icon +
      '<span class="m-meta"><span class="m-name">' + esc(card.name) + '</span><span class="m-en">' + esc(card.en) + '</span></span>' +
    '</button>';
  }

  function renderLibrary() {
    const q = state.lib.q.trim().toLowerCase();
    let list = cards;
    if (state.lib.tab === 'major') list = cards.filter((c) => c.arcana === 'major');
    else if (state.lib.tab !== 'all') list = cards.filter((c) => c.suit === state.lib.tab);
    if (q) {
      list = list.filter((c) => {
        const hay = (c.name + ' ' + c.en + ' ' + c.kw.join(' ') + ' ' + c.kwRev.join(' ')).toLowerCase();
        return hay.indexOf(q) >= 0;
      });
    }
    $('#lib-grid').innerHTML = list.map(miniHTML).join('');
    $('#lib-empty').hidden = list.length > 0;
  }

  /* ---------- 牌义弹窗 ---------- */
  function openCardModal(id, rev) {
    if (!byId.has(id)) return;
    state.modal.cardId = id;
    state.modal.rev = !!rev;
    state.modal.topic = state.topic;
    renderModal();
    $('#modal').hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    $('#modal').hidden = true;
    document.body.style.overflow = '';
  }

  function renderModal() {
    const card = byId.get(state.modal.cardId);
    if (!card) return;
    const rev = state.modal.rev;
    const topicId = topicMap.has(state.modal.topic) ? state.modal.topic : 'general';
    const kws = rev ? card.kwRev : card.kw;
    const text = topicReading(card, topicId, rev);
    const meaning = rev ? card.rev : card.up;
    const meta = card.arcana === 'major'
      ? '大阿卡纳 · ' + ELEM_CN[card.element] + '元素'
      : suits[card.suit].cn + ' · ' + suits[card.suit].element + '元素 · 小阿卡纳';

    $('#modal-body').innerHTML =
      '<div class="modal-card-col">' +
        '<div class="card is-flipped' + (rev ? ' is-reversed' : '') + '" role="img" aria-label="' + esc(card.name) + '">' +
          '<span class="card-inner">' +
            '<span class="card-face card-back"></span>' +
            '<span class="card-face card-front">' + cardFrameHTML(card) + '</span>' +
          '</span>' +
        '</div>' +
        '<div class="modal-card-meta">' +
          '<div class="m-name">' + esc(card.name) + '</div>' +
          '<div class="m-en">' + esc(card.en) + '</div>' +
          '<div class="m-tags">' + esc(meta) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-info">' +
        '<h2 id="modal-title">' + esc(card.name) + '</h2>' +
        '<p class="modal-sub">' + esc(card.en.toUpperCase()) + ' · ' + (rev ? '逆位' : '正位') + '</p>' +
        '<div class="seg">' +
          '<button type="button" data-modal-orient="0" class="' + (rev ? '' : 'is-active') + '">正位</button>' +
          '<button type="button" data-modal-orient="1" class="' + (rev ? 'is-active' : '') + '">逆位</button>' +
        '</div>' +
        '<div class="modal-kw">' + kws.map((k) => '<span>' + esc(k) + '</span>').join('') + '</div>' +
        (card.arcana === 'minor' ? '' : '<p class="modal-text">' + esc(meaning) + '</p>') +
        '<div class="modal-topic-head"><h3>在主题中的意味</h3><span>切换主题查看</span></div>' +
        '<div class="modal-topics">' + topics.map((t) =>
          '<button type="button" data-modal-topic="' + t.id + '" class="' + (t.id === topicId ? 'is-active' : '') + '">' + esc(t.name) + '</button>'
        ).join('') + '</div>' +
        '<div class="modal-topic-text">' + esc(text) + '</div>' +
      '</div>';
  }

  /* ---------- 今日之牌 ---------- */
  function renderDaily() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const today = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(DAILY_KEY) || 'null');
    } catch (e) { /* 本地存储不可用时退回随机 */ }

    let card = null;
    let rev = false;
    if (saved && saved.date === today && byId.has(saved.cardId)) {
      card = byId.get(saved.cardId);
      rev = !!saved.rev;
    } else {
      card = cards[Math.floor(Math.random() * cards.length)];
      rev = Math.random() < 0.3;
      try {
        localStorage.setItem(DAILY_KEY, JSON.stringify({ date: today, cardId: card.id, rev: rev }));
      } catch (e) { /* 忽略 */ }
    }
    state.daily = { card: card, rev: rev, flipped: false };

    $('#daily-date').textContent = (now.getMonth() + 1) + '月' + now.getDate() + '日 · 周' + '日一二三四五六'[now.getDay()];
    $('#daily-stage').innerHTML =
      '<button class="card card--daily' + (rev ? ' is-reversed' : '') + '" type="button" id="daily-card" aria-label="翻开今日之牌">' +
        '<span class="card-inner">' +
          '<span class="card-face card-back"></span>' +
          '<span class="card-face card-front">' + cardFrameHTML(card) + '</span>' +
        '</span>' +
      '</button>';
    $('#daily-info').innerHTML = '<p class="daily-hint">轻触牌背，看看今天的提示。</p>';
    $('#daily-detail').hidden = true;
  }

  function revealDaily() {
    if (state.daily.flipped) return;
    state.daily.flipped = true;
    const card = state.daily.card;
    const rev = state.daily.rev;
    const btn = $('#daily-card');
    if (btn) btn.classList.add('is-flipped');
    const kws = rev ? card.kwRev : card.kw;
    const text = topicReading(card, 'general', rev);
    $('#daily-info').innerHTML = '<div class="daily-reveal">' +
      '<h3>' + esc(card.name) + ' <small>' + (rev ? '逆位' : '正位') + '</small></h3>' +
      '<p class="daily-kw">' + kws.map(esc).join(' · ') + '</p>' +
      '<p>' + esc(text) + '</p>' +
    '</div>';
    const detail = $('#daily-detail');
    detail.hidden = false;
    detail.dataset.card = card.id;
    detail.dataset.rev = rev ? '1' : '0';
  }

  /* ---------- 星空 ---------- */
  function initStars() {
    const canvas = $('#stars');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let stars = [];
    let w = 0, h = 0, raf = null;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(190, (w * h) / 9000));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.3 + 0.35,
        p: Math.random() * Math.PI * 2,
        s: Math.random() * 0.0016 + 0.0004
      }));
      draw(0);
    }

    function draw(t) {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const a = reduce ? 0.45 : 0.28 + 0.55 * (0.5 + 0.5 * Math.sin(s.p + t * s.s));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(222, 227, 242, ' + (a * 0.6).toFixed(3) + ')';
        ctx.fill();
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    }

    let rt = null;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        if (raf) cancelAnimationFrame(raf);
        resize();
      }, 160);
    });
    resize();
  }

  /* ---------- 术语说明 ---------- */
  function closeHelp() {
    $$('.help-box').forEach((b) => { b.hidden = true; });
    $$('.help-btn[data-help]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  }

  function toggleHelp(btn) {
    const key = btn.dataset.help;
    const box = document.getElementById('help-' + key);
    if (!box) return;
    const open = !box.hidden;
    closeHelp();
    if (!open) {
      box.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      setTimeout(() => box.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 30);
    }
  }

  /* ---------- 事件 ---------- */
  function bindEvents() {
    document.addEventListener('click', (e) => {
      const helpBtn = e.target.closest('[data-help]');
      if (helpBtn) { toggleHelp(helpBtn); return; }
      const viewBtn = e.target.closest('[data-view]');
      if (viewBtn) {
        switchView(viewBtn.dataset.view);
        return;
      }
      const auto = e.target.closest('[data-action="auto-pick"]');
      if (auto) { autoPick(); return; }
    });

    $('#topic-grid').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-topic]');
      if (!btn) return;
      state.topic = btn.dataset.topic;
      savePrefs();
      renderTopics();
      renderPrompts();
    });

    $('#spread-grid').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-spread]');
      if (!btn) return;
      state.spreadId = btn.dataset.spread;
      renderSpreads();
      syncFreeUI();
      savePrefs();
    });

    $('#free-count').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-free-step]');
      if (!btn) return;
      state.freeCount = clampFree(state.freeCount + Number(btn.dataset.freeStep));
      syncFreeUI();
      savePrefs();
    });

    $('#free-count-input').addEventListener('input', (e) => {
      const v = Number(e.target.value);
      if (Number.isFinite(v) && v >= 1 && v <= maxFree()) {
        state.freeCount = Math.round(v);
      }
    });

    $('#free-count-input').addEventListener('change', (e) => {
      state.freeCount = clampFree(e.target.value);
      syncFreeUI();
      savePrefs();
    });

    $('#prompts').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-q]');
      if (!btn) return;
      const input = $('#question');
      input.value = btn.dataset.q;
      input.focus();
    });

    $('#draw-btn').addEventListener('click', startDraw);
    $('#allow-rev').addEventListener('change', (e) => {
      state.allowRev = e.target.checked;
      savePrefs();
    });
    $('#only-major').addEventListener('change', (e) => {
      state.onlyMajor = e.target.checked;
      state.freeCount = clampFree(state.freeCount);
      renderSpreads();
      syncFreeUI();
      updateDeckNote();
      savePrefs();
    });

    $('#board').addEventListener('click', (e) => {
      const fan = e.target.closest('.fan-card');
      if (fan && state.phase === 'picking') {
        pickFanCard(Number(fan.dataset.i));
        return;
      }
      const cardEl = e.target.closest('.card');
      if (!cardEl) return;
      const slot = cardEl.closest('.slot');
      if (slot) flipCard(Number(slot.dataset.i));
    });

    $('#reveal-all').addEventListener('click', revealAll);
    $('#redraw').addEventListener('click', startDraw);
    $('#edit-setup').addEventListener('click', () => {
      $('#setup').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    $('#lib-tabs').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tab]');
      if (!btn) return;
      state.lib.tab = btn.dataset.tab;
      $$('#lib-tabs .tab').forEach((b) => b.classList.toggle('is-active', b === btn));
      renderLibrary();
    });

    let searchTimer = null;
    $('#lib-search').addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      const v = e.target.value;
      searchTimer = setTimeout(() => {
        state.lib.q = v;
        renderLibrary();
      }, 120);
    });

    $('#lib-grid').addEventListener('click', (e) => {
      const tile = e.target.closest('[data-card]');
      if (tile) openCardModal(tile.dataset.card, false);
    });

    $('#history-list').addEventListener('click', (e) => {
      const del = e.target.closest('[data-action="del-record"]');
      if (del) { deleteRecord(del.dataset.id); return; }
      const view = e.target.closest('[data-action="view-record"]');
      if (view) { viewRecord(view.dataset.id); return; }
    });

    $('#clear-history').addEventListener('click', clearHistory);

    $('#modal-close').addEventListener('click', closeModal);
    $('#modal').addEventListener('click', (e) => {
      if (e.target.dataset.close === 'modal') closeModal();
    });
    $('#modal-body').addEventListener('click', (e) => {
      const o = e.target.closest('[data-modal-orient]');
      if (o) {
        state.modal.rev = o.dataset.modalOrient === '1';
        renderModal();
        return;
      }
      const t = e.target.closest('[data-modal-topic]');
      if (t) {
        state.modal.topic = t.dataset.modalTopic;
        renderModal();
      }
    });

    $('#daily-stage').addEventListener('click', (e) => {
      if (e.target.closest('#daily-card')) revealDaily();
    });
    $('#daily-detail').addEventListener('click', (e) => {
      const btn = e.target.closest('#daily-detail');
      if (!btn) return;
      openCardModal(btn.dataset.card, btn.dataset.rev === '1');
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!$('#modal').hidden) {
        closeModal();
      } else {
        closeHelp();
      }
    });

    window.addEventListener('resize', () => {
      clearTimeout(state.resizeTimer);
      state.resizeTimer = setTimeout(() => {
        if (state.phase === 'picking') buildFanRows();
      }, 180);
    });
  }

  /* ---------- 启动 ---------- */
  function init() {
    loadPrefs();
    renderTopics();
    renderPrompts();
    renderSpreads();
    syncFreeUI();
    updateDeckNote();
    renderDaily();
    renderLibrary();
    renderHistory();
    initStars();
    bindEvents();
  }

  init();
})();
