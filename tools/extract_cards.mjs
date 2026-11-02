// 从毛选全文抽取高质量语录卡片：quote + 出处 + 官方背景注解（作为解读）
// 输出 cards.json，每行一条；后续可扩展人工撰写更多解读
import fs from 'node:fs'; import path from 'node:path';

const SRC = 'MaoZeDongAnthology-master/src';
const files = fs.readdirSync(SRC).filter(f => /^\d{3}-.+\.md$/.test(f)).sort();

const clean = s => s.replace(/\u3000/g, ' ').replace(/\s+/g, ' ').trim();
const stripFoot = s => s.replace(/[\u2460-\u2473\u2488-\u24B5\u24EA]/g, '').replace(/[\[(]\d{1,3}[\])]/g, '');

const cards = [];
let id = 0;

for (const f of files) {
  const m = f.match(/^(\d{3})-(.+)\.md$/);
  if (!m) continue;
  const idx = Number(m[1]);
  const title = m[2];
  const raw = fs.readFileSync(path.join(SRC, f), 'utf8');
  const lines = raw.split(/\r?\n/);

  let date = '', note = '';
  let i = 0;
  for (; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) continue;
    if (l.startsWith('#')) continue;
    const dm = l.match(/^[（(]([^）)]{2,40})[)）]$/);
    if (dm) { date = dm[1]; i++; }
    break;
  }
  // 收集 > 注释块（官方背景注解）
  const noteLines = [];
  for (; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) { if (noteLines.length) break; else continue; }
    if (l.startsWith('>')) noteLines.push(l.replace(/^>\s*/, ''));
    else break;
  }
  note = clean(stripFoot(noteLines.join(' ')));

  // 正文段落
  const body = lines.slice(i).join('\n');
  const paras = body.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#') && !l.startsWith('>') && l.replace(/[\s（）()、。，．.;：:“”‘’—…\-0-9]/g, '').length > 6);

  for (const pRaw of paras) {
    const p = clean(stripFoot(pRaw));
    if (p.length < 18 || p.length > 120) continue;
    if (!/[。！？…"]$/.test(p)) continue;
    if (/^[一二三四五六七八九十]{1,3}\s*[、.．]/.test(p)) continue;
    if (/^[①-⑳]|\(\d{1,2}\)/.test(pRaw)) continue;

    // 评分筛选
    let score = 0;
    const zh = p.match(/[\u4e00-\u9fff]/g);
    if (!zh) continue;
    if (zh.length / p.length < 0.72) continue;
    const commas = (p.match(/[，、；：]/g) || []).length;
    if (p.length >= 22 && p.length <= 110) score += 3;
    else if (p.length <= 130) score += 1;
    if (commas >= 1 && commas <= 6) score += 2;
    if (/[“"].{6,50}[”"]/.test(p)) score += 2;
    if (/不是.{1,25}(而是|就是)/.test(p)) score += 2;
    if (/(必须|一定要|只有|只要|凡是|从来|往往|究竟)/.test(p)) score += 1;
    if (/[！]/.test(p)) score += 1;
    if (/(我们|同志们|革命|敌人|人民|世界|中国|斗争|学习|工作|群众|实际)/.test(p)) score += 1;
    if (/(的{2,}|是是)/.test(p)) score -= 3;
    if (p.length > 140) score -= 2;

    if (score < 4) continue;

    const key = p.replace(/[^\u4e00-\u9fff]/g, '');
    if (cards.some(c => c.quote === p)) continue;

    cards.push({
      id: ++id,
      quote: p,
      source: title,
      date,
      note,
      score
    });
  }
}

// 去重并排序
const uniq = new Map();
for (const c of cards) {
  const k = c.quote.replace(/[^\u4e00-\u9fff]/g, '');
  if (!uniq.has(k)) uniq.set(k, c);
}
const final = Array.from(uniq.values()).sort((a, b) => b.score - a.score);

console.log(`articles: ${files.length}, quotes: ${final.length}`);
console.log('sample top:');
for (const c of final.slice(0, 12)) {
  console.log(` [${c.score}] (${c.source}) ${c.quote.slice(0, 60)}`);
}

fs.writeFileSync('cards.json', JSON.stringify(final, null, 2));
console.log('written: cards.json');
