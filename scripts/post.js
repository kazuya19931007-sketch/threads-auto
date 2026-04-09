/**
 * post.js — 指定スロットの投稿をThreadsへ送信
 * 使い方: node scripts/post.js <slot>
 *   slot: morning | noon | night
 */
const fs = require('fs');
const path = require('path');

const SLOT_MAP = {
  morning: '07:30',
  noon:    '12:30',
  night:   '22:00',
};

const THREADS_USER_ID  = process.env.THREADS_USER_ID;
const THREADS_TOKEN    = process.env.THREADS_ACCESS_TOKEN;
const DATA_FILE        = path.join(__dirname, '../data/posts.json');

async function fetchJ(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error(text); }
}

async function createContainer(text) {
  const url = `https://graph.threads.net/v1.0/${THREADS_USER_ID}/threads`;
  const body = { media_type: 'TEXT', text, access_token: THREADS_TOKEN };
  const d = await fetchJ(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!d.id) throw new Error('container error: ' + JSON.stringify(d));
  return d.id;
}

async function publishContainer(containerId) {
  await new Promise(r => setTimeout(r, 2000));
  const url = `https://graph.threads.net/v1.0/${THREADS_USER_ID}/threads_publish`;
  const body = { creation_id: containerId, access_token: THREADS_TOKEN };
  const d = await fetchJ(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!d.id) throw new Error('publish error: ' + JSON.stringify(d));
  return d.id;
}

function todayJST() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

async function main() {
  const slot = process.argv[2];
  const time = SLOT_MAP[slot];
  if (!time) {
    console.error('スロット指定が必要: morning | noon | night');
    process.exit(1);
  }

  if (!THREADS_USER_ID || !THREADS_TOKEN) {
    console.error('THREADS_USER_ID と THREADS_ACCESS_TOKEN を設定してください');
    process.exit(1);
  }

  const today = todayJST();
  const posts = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

  const target = posts.find(p =>
    p.date === today && p.time === time && p.status === 'scheduled'
  );

  if (!target) {
    console.log(`[${today} ${time}] 投稿対象なし（既投稿 or 未生成）`);
    process.exit(0);
  }

  console.log(`投稿開始: [${today} ${time}] ${target.content}`);

  const containerId = await createContainer(target.content);
  const threadId    = await publishContainer(containerId);

  target.status   = 'posted';
  target.threadId = threadId;
  target.postedAt = new Date().toISOString();

  fs.writeFileSync(DATA_FILE, JSON.stringify(posts, null, 2));
  console.log(`投稿完了 threadId=${threadId}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
