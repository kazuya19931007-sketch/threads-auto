/**
 * analyze.js — 投稿済みデータのインサイト取得 → AI分析 → analysis.json 保存
 */
const fs   = require('fs');
const path = require('path');

const THREADS_USER_ID  = process.env.THREADS_USER_ID;
const THREADS_TOKEN    = process.env.THREADS_ACCESS_TOKEN;
const ANTHROPIC_KEY    = process.env.ANTHROPIC_API_KEY;
const DATA_DIR         = path.join(__dirname, '../data');
const POSTS_FILE       = path.join(DATA_DIR, 'posts.json');
const ANALYSIS_FILE    = path.join(DATA_DIR, 'analysis.json');

async function fetchJ(url) {
  const res  = await fetch(url);
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error(text); }
}

async function getInsights(threadId) {
  const url = `https://graph.threads.net/v1.0/${threadId}/insights?metric=views,likes,replies,reposts,quotes&access_token=${THREADS_TOKEN}`;
  const d   = await fetchJ(url);
  const ins = {};
  (d.data || []).forEach(m => { ins[m.name] = m.values?.[0]?.value || 0; });
  return ins;
}

async function callClaude(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      'x-api-key':       ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages:   [{ role: 'user', content: prompt }],
    }),
  });
  const d = await res.json();
  if (!d.content) throw new Error(JSON.stringify(d));
  return d.content[0].text;
}

function parseJSON(text) {
  return JSON.parse(text.replace(/```json\n?|```\n?/g, '').trim());
}

async function main() {
  if (!THREADS_TOKEN || !THREADS_USER_ID || !ANTHROPIC_KEY) {
    console.error('環境変数が不足しています');
    process.exit(1);
  }

  const posts = JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8'));
  const posted = posts.filter(p => p.status === 'posted' && p.threadId);

  if (posted.length === 0) {
    console.log('分析対象の投稿がありません（投稿済みデータなし）');
    process.exit(0);
  }

  console.log(`インサイト取得中: ${posted.length}件...`);
  for (const p of posted) {
    try {
      p.insights = await getInsights(p.threadId);
      console.log(`  ${p.date} ${p.time} → views:${p.insights.views} likes:${p.insights.likes}`);
      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      console.warn(`  インサイト取得失敗 ${p.threadId}: ${e.message}`);
    }
  }

  fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
  console.log('インサイト保存完了');

  const dataForAI = posted.filter(p => p.insights).map(p => ({
    date:    p.date,
    time:    p.time,
    theme:   p.theme,
    content: p.content,
    views:   p.insights.views   || 0,
    likes:   p.insights.likes   || 0,
    replies: p.insights.replies || 0,
    reposts: p.insights.reposts || 0,
  }));

  console.log('AI分析を実行中...');
  const prompt = `以下はThreadsの投稿データです。分析してください。
${JSON.stringify(dataForAI, null, 2)}

JSONのみ回答（\`\`\`不要）:
{
  "summary": "200文字以内の全体サマリー",
  "topTheme": "最もエンゲージメントが高かったテーマ名",
  "bestTime": "最もエンゲージメントが高かった時間帯（例: 07:30）",
  "worstTime": "最もエンゲージメントが低かった時間帯",
  "improvements": ["改善提案1","改善提案2","改善提案3"],
  "nextWeekStrategy": "来週の投稿戦略（100文字以内）",
  "avgLikes": 数値,
  "avgViews": 数値
}`;

  const raw      = await callClaude(prompt);
  const analysis = parseJSON(raw);
  analysis.analyzedAt  = new Date().toISOString();
  analysis.postsCount  = dataForAI.length;

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(ANALYSIS_FILE, JSON.stringify(analysis, null, 2));

  console.log('分析完了:');
  console.log(`  最良テーマ: ${analysis.topTheme}`);
  console.log(`  最良時間帯: ${analysis.bestTime}`);
  console.log(`  サマリー: ${analysis.summary}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
