/**
 * generate.js — Claude APIで1週間分(21投稿)を生成し data/posts.json に保存
 */
const fs   = require('fs');
const path = require('path');

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const DATA_DIR      = path.join(__dirname, '../data');
const POSTS_FILE    = path.join(DATA_DIR, 'posts.json');
const ANALYSIS_FILE = path.join(DATA_DIR, 'analysis.json');

async function callClaude(prompt, maxTokens = 3000) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const d = await res.json();
  if (!d.content) throw new Error(JSON.stringify(d));
  return d.content[0].text;
}

function parseJSON(text) {
  const clean = text.replace(/```json\n?|```\n?/g, '').trim();
  return JSON.parse(clean);
}

function getWeekDates() {
  // JSTで今日〜6日後の日付を返す
  const dates = [];
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  for (let i = 0; i < 7; i++) {
    const d = new Date(jst);
    d.setUTCDate(jst.getUTCDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

async function main() {
  if (!ANTHROPIC_KEY) {
    console.error('ANTHROPIC_API_KEY を設定してください');
    process.exit(1);
  }

  // 既存データ読み込み（投稿済みは保持）
  let existingPosts = [];
  if (fs.existsSync(POSTS_FILE)) {
    existingPosts = JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8'));
  }
  const postedPosts = existingPosts.filter(p => p.status === 'posted');

  // 先週の分析を読み込み
  let analysisCtx = '';
  if (fs.existsSync(ANALYSIS_FILE)) {
    const analysis = JSON.parse(fs.readFileSync(ANALYSIS_FILE, 'utf8'));
    analysisCtx = `
前週の分析結果:
- サマリー: ${analysis.summary}
- 最良テーマ: ${analysis.topTheme}
- 最良時間帯: ${analysis.bestTime}
- 改善点: ${(analysis.improvements || []).join(' / ')}
- 来週の戦略: ${analysis.nextWeekStrategy}
`;
  }

  const dates  = getWeekDates();
  const themes = ['格安SIM','格安SIM','格安SIM','電気代','電気代','共済','共済'];
  const times  = ['07:30','12:30','22:00'];

  const schedule = [];
  dates.forEach((date, di) => {
    times.forEach(t => {
      schedule.push({ date, time: t, theme: themes[di] });
    });
  });

  const prompt = `あなたは固定費削減サービスの敏腕SNSマーケターです。
小規模事業者・個人事業主をターゲットにした固定費削減サービス（格安SIM・電気代見直し・共済）のThreads投稿を21本作成してください。

【必須ルール】
- 各投稿は1行、50文字以内
- 適切な絵文字を1〜2個含める
- プロフィールを見たくなる引きのある内容
- 営業臭を出さず、共感・驚き・お得感を演出
- 同じ表現・文体の繰り返しを避ける

【スケジュール】
${schedule.map((s,i) => `${i+1}. ${s.date} ${s.time} [${s.theme}]`).join('\n')}
${analysisCtx}

【出力形式】JSONのみ回答（\`\`\`不要）
{"posts":[{"date":"YYYY-MM-DD","time":"HH:MM","theme":"テーマ","content":"投稿本文"},...]}
21件必ず含めること。`;

  console.log('Claude APIで投稿を生成中...');
  const raw  = await callClaude(prompt, 4000);
  const data = parseJSON(raw);

  const newPosts = data.posts.map((p, i) => ({
    id:          `p_${Date.now()}_${i}`,
    date:        p.date,
    time:        p.time,
    theme:       p.theme,
    content:     p.content,
    status:      'scheduled',
    threadId:    null,
    postedAt:    null,
    insights:    null,
  }));

  const allPosts = [...postedPosts, ...newPosts]
    .sort((a, b) => `${a.date}${a.time}` > `${b.date}${b.time}` ? 1 : -1);

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(POSTS_FILE, JSON.stringify(allPosts, null, 2));
  console.log(`生成完了: ${newPosts.length}件を posts.json に保存`);
  newPosts.forEach(p => console.log(`  ${p.date} ${p.time} [${p.theme}] ${p.content}`));
}

main().catch(e => { console.error(e.message); process.exit(1); });
