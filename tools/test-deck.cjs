// 抽卡引擎回归测试：验证 12000 次连续抽取不重复、历史回看、跨会话持久化
const fs = require('fs');
const path = require('path');
const MaoDeck = require(path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'deck.js'));

function memStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _map: m
  };
}

let failures = 0;
function check(name, cond, extra) {
  if (cond) {
    console.log('  PASS', name);
  } else {
    failures++;
    console.log('  FAIL', name, extra === undefined ? '' : extra);
  }
}

const TOTAL = 18506;
const rnd = MaoDeck.mulberry32(20261102);
const store = memStorage();
const e = MaoDeck.createEngine({ total: TOTAL, storage: store, random: rnd });

console.log('1. 连续抽取 12000 次不重复');
const seen = new Set();
let dup = 0;
for (let i = 0; i < 12000; i++) {
  const id = e.open();
  if (seen.has(id)) dup++;
  seen.add(id);
}
check('12000 次无重复', dup === 0, 'dup=' + dup);
check('历史长度 12000', e.historyLength() === 12000, e.historyLength());
check('牌堆剩余 = total-12000', e.deckRemaining() === TOTAL - 12000, e.deckRemaining());

console.log('2. 右滑回看上一条 / 左滑前进');
const lastId = e.current();
const prevId = e.prev();
check('prev 返回不同的上一条', prevId !== lastId && prevId >= 0);
const backId = e.next();
check('next 回到刚看的那条', backId === lastId, backId + ' vs ' + lastId);

console.log('3. 历史边界');
while (e.canPrev()) e.prev();
const firstId = e.current();
const again = e.prev();
check('最早一条再右滑保持不变', again === firstId);
const afterNext = e.next();
check('左滑可回到后一条', afterNext === e._state.history[1]);

console.log('4. 跨会话持久化');
const e2 = MaoDeck.createEngine({ total: TOTAL, storage: store, random: MaoDeck.mulberry32(7) });
const newId = e2.open();
check('新会话抽出新的牌', !seen.has(newId), newId);
check('新会话继承历史', e2.historyLength() === 12001, e2.historyLength());

console.log('5. 牌堆抽空后重新洗牌，且不与上一张重复');
const small = MaoDeck.createEngine({ total: 12, storage: memStorage(), random: MaoDeck.mulberry32(3) });
const ids = [];
for (let i = 0; i < 26; i++) ids.push(small.open());
const cycles = [];
for (let i = 0; i < 12; i++) cycles.push(ids[i]);
check('第一轮 12 张互不相同', new Set(cycles).size === 12);
const secondCycle = ids.slice(12, 24);
check('第二轮 12 张互不相同', new Set(secondCycle).size === 12);
check('换轮处不重复', ids[11] !== ids[12], ids[11] + ' / ' + ids[12]);

console.log(failures === 0 ? '\nALL TESTS PASSED' : '\n' + failures + ' TEST(S) FAILED');
process.exit(failures === 0 ? 0 : 1);
