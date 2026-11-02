// 通过 GitHub Data API 推送整个项目（规避 git push 到 github.com:443 被重置的问题）
// 用法: GH_TOKEN=xxx node tools/push-api.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOKEN = process.env.GH_TOKEN;
if (!TOKEN) {
  console.error('缺少环境变量 GH_TOKEN');
  process.exit(1);
}

const OWNER = process.env.GH_OWNER || 'johnson020202';
const REPO = process.env.GH_REPO || 'maoyeye';
const BRANCH = process.env.GH_BRANCH || 'main';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://api.github.com';

const SKIP_DIRS = new Set(['.git', 'node_modules', 'build', '.gradle', '.idea', 'data', '.tmp-edge-profile', 'joblogs']);
const SKIP_FILES = new Set(['local.properties']);
const SKIP_PATTERNS = [/^joblog.*\.zip$/, /^shot.*\.png$/, /\.apk$/];

async function api(urlPath, method = 'GET', body) {
  const res = await fetch(API + urlPath, {
    method,
    headers: {
      Authorization: `token ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'maoyeye-push',
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (e) { /* ignore */ }
  if (!res.ok) {
    const err = new Error(`${method} ${urlPath} -> ${res.status}: ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

function walk(dir, base = '') {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      out.push(...walk(full, rel));
    } else {
      if (SKIP_FILES.has(name)) continue;
      out.push({ rel, full, size: st.size });
    }
  }
  return out;
}

async function pool(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const files = walk(ROOT);
console.log(`files: ${files.length}, total: ${(files.reduce((a, f) => a + f.size, 0) / 1048576).toFixed(2)} MB`);

console.log('creating blobs...');
const blobs = await pool(files, 6, async (f) => {
  const content = fs.readFileSync(f.full).toString('base64');
  const b = await api(`/repos/${OWNER}/${REPO}/git/blobs`, 'POST', { content, encoding: 'base64' });
  console.log(`  blob ${f.rel} (${(f.size / 1024).toFixed(0)} KB)`);
  return { path: f.rel, mode: '100644', type: 'blob', sha: b.sha };
});

console.log('creating tree...');
const tree = await api(`/repos/${OWNER}/${REPO}/git/trees`, 'POST', { tree: blobs });

let parent = null;
try {
  const ref = await api(`/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
  parent = ref.object.sha;
} catch (e) {
  if (e.status !== 404) throw e;
}

console.log('creating commit...');
const commit = await api(`/repos/${OWNER}/${REPO}/git/commits`, 'POST', {
  message: 'feat: 毛选语录 v1.0.0（18506 条，洗牌抽牌，左右滑动）',
  tree: tree.sha,
  parents: parent ? [parent] : []
});

if (parent) {
  console.log('updating ref...');
  await api(`/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, 'PATCH', { sha: commit.sha, force: true });
} else {
  console.log('creating ref...');
  await api(`/repos/${OWNER}/${REPO}/git/refs`, 'POST', {
    ref: `refs/heads/${BRANCH}`,
    sha: commit.sha
  });
}

console.log('pushed commit', commit.sha);
console.log(`https://github.com/${OWNER}/${REPO}/commit/${commit.sha}`);
