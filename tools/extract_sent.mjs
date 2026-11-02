import fs from 'node:fs'; import path from 'node:path';
const SRC='MaoZeDongAnthology-master/src';
const files=fs.readdirSync(SRC).filter(f=>/^\d{3}-.+\.md$/.test(f)).sort();
const clean=s=>s.replace(/\u3000/g,' ').replace(/\s+/g,' ').trim();
const stripFoot=s=>s.replace(/[\u2460-\u2473\u2488-\u24B5\u24EA]/g,'').replace(/[\[(]\d{1,3}[\])]/g,'');
const seen=new Set(); const out=[];
for(const f of files){
  const m=f.match(/^(\d{3})-(.+)\.md$/); const idx=Number(m[1]); const title=m[2];
  const raw=fs.readFileSync(path.join(SRC,f),'utf8'); const lines=raw.split(/\r?\n/);
  let date='',note=''; let i=0;
  for(;i<lines.length;i++){const l=lines[i].trim(); if(!l)continue; if(l.startsWith('#'))continue;
    const dm=l.match(/^[（(]([^）)]{2,40})[)）]$/); if(dm){date=dm[1];i++;} break;}
  const nl=[]; for(;i<lines.length;i++){const l=lines[i].trim(); if(!l){if(nl.length)break;else continue;} if(l.startsWith('>'))nl.push(l.replace(/^>\s*/,'')); else break;}
  note=clean(stripFoot(nl.join(' ')));
  const body=lines.slice(i).join('\n');
  for(const line of body.split(/\r?\n/)){
    let l=line.trim(); if(!l||l.startsWith('#')||l.startsWith('>'))continue;
    if(/[〔\[][0-9０-９]{1,3}[〕\]]/.test(l))continue;           // 脚注行
    if(/^(注|〔注〕|注释)/.test(l))continue;
    l=clean(stripFoot(l)).replace(/^[·•\-—\s]+/,'');
    if(l.length<10)continue;
    if(/^[一二三四五六七八九十]{1,3}\s*[、.．]/.test(l))continue;
    for(let s of l.split(/(?<=[。！？…”])/)){
      s=s.replace(/^[“”‘’「」『』、，。；：\s]+/,'').replace(/\s+/g,'').trim();
      if(s.length<16||s.length>72)continue;
      if(!/[。！？…”]$/.test(s))continue;
      if(/^(注|此外|例如|又如|以上|如下|这就是|这就是说)/.test(s))continue;
      const zh=(s.match(/[\u4e00-\u9fff]/g)||[]).length;
      if(zh/s.length<0.72)continue;
      const key=s.replace(/[^\u4e00-\u9fff]/g,''); if(key.length<12)continue;
      if(seen.has(key))continue;
      // 质量分
      let sc=0; const commas=(s.match(/[，、；：]/g)||[]).length;
      if(s.length>=20&&s.length<=64)sc+=2;
      if(commas>=1&&commas<=5)sc+=1;
      if(/[“"].{4,40}[”"]/.test(s))sc+=1;
      if(/不是.{1,24}(而是|就是)/.test(s))sc+=1;
      if(/(必须|一定要|只有|只要|凡是|应当|应该|决不可|不能|不要)/.test(s))sc+=1;
      if(/(我们|同志|人民|群众|革命|工作|学习|实际|斗争|问题|办法|困难|胜利)/.test(s))sc+=1;
      if(/[！]/.test(s))sc+=1;
      if(/[，、]{2,}/.test(s))sc-=2;
      if(sc<2)continue;
      seen.add(key);
      out.push({quote:s,source:title,date,note,score:sc,idx});
    }
  }
}
const hist={}; for(const c of out)hist[c.score]=(hist[c.score]||0)+1;
console.log('sentence cards:',out.length,'sources:',new Set(out.map(x=>x.source)).size);
console.log('score histogram:',JSON.stringify(hist));
fs.writeFileSync('cards_sent.json',JSON.stringify(out));
