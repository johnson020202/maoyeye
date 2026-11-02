/* 抽卡引擎：洗牌抽牌 + 历史栈，支持回看上一次与下一次
 * 浏览器里挂到 window.MaoDeck，Node 里可 require 做测试。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MaoDeck = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rnd) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  function createEngine(opts) {
    const total = opts.total;
    const storage = opts.storage || null;
    const rnd = opts.random || Math.random;
    const key = opts.key || 'maoyeye.v1';
    const historyLimit = opts.historyLimit || 20000;

    let state = { deck: [], history: [], pos: -1, lastId: -1 };

    function load() {
      if (!storage) return;
      try {
        const raw = storage.getItem(key);
        if (!raw) return;
        const s = JSON.parse(raw);
        if (!s || !Array.isArray(s.deck) || !Array.isArray(s.history)) return;
        state = {
          deck: s.deck.filter((n) => Number.isInteger(n) && n >= 0 && n < total),
          history: s.history.filter((n) => Number.isInteger(n) && n >= 0 && n < total),
          pos: typeof s.pos === 'number' ? s.pos : s.history.length - 1,
          lastId: typeof s.lastId === 'number' ? s.lastId : -1
        };
        if (state.pos >= state.history.length) state.pos = state.history.length - 1;
      } catch (e) {
        state = { deck: [], history: [], pos: -1, lastId: -1 };
      }
    }

    function save() {
      if (!storage) return;
      try {
        storage.setItem(key, JSON.stringify(state));
      } catch (e) {
        /* 存储满时忽略：本次会话内仍可正常抽卡 */
      }
    }

    function refill() {
      const all = [];
      for (let i = 0; i < total; i++) all.push(i);
      shuffle(all, rnd);
      // 新一轮的第一张不要和上一张相同
      if (all.length > 1 && all[0] === state.lastId) {
        const t = all[0];
        all[0] = all[1];
        all[1] = t;
      }
      state.deck = all;
    }

    function draw() {
      if (!state.deck.length) refill();
      const id = state.deck.pop();
      state.history.push(id);
      if (state.history.length > historyLimit) {
        const cut = state.history.length - historyLimit;
        state.history.splice(0, cut);
        state.pos -= cut;
      }
      state.pos = state.history.length - 1;
      state.lastId = id;
      save();
      return id;
    }

    function current() {
      return state.pos >= 0 ? state.history[state.pos] : -1;
    }

    function next() {
      if (state.pos < state.history.length - 1) {
        state.pos++;
        save();
        return current();
      }
      return draw();
    }

    function prev() {
      if (state.pos > 0) {
        state.pos--;
        save();
      }
      return current();
    }

    load();

    return {
      open: draw,
      next: next,
      prev: prev,
      current: current,
      canPrev: function () { return state.pos > 0; },
      pos: function () { return state.pos; },
      historyLength: function () { return state.history.length; },
      deckRemaining: function () { return state.deck.length; },
      total: total,
      _state: state
    };
  }

  return { createEngine: createEngine, shuffle: shuffle, mulberry32: mulberry32 };
});
