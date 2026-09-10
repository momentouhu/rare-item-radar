import fs from 'node:fs';
import { readJson } from './lib/store.js';
import { unhealthySources } from './lib/health.js';

const config = JSON.parse(fs.readFileSync('config/watch.json', 'utf8'));
const feed = readJson('feed.json', { updatedAt: null, events: [] });
const queue = readJson('queue.json', { items: [] });

const SOURCE_LABELS = { rakuten_ichiba: '楽天市場', rakuten_books: '楽天ブックス', yahoo_shopping: 'Yahoo!ショッピング', surugaya: '駿河屋', sevennet: 'セブンネット', tower: 'タワレコ', hobbysearch: 'ホビーサーチ' };
const sick = unhealthySources(SOURCE_LABELS);

const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const yen = (n) => (n ? `¥${Number(n).toLocaleString('ja-JP')}` : '価格未定');

const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const CSS = `
:root{--bg:#fbfaf8;--surface:#fff;--text:#1c1b19;--muted:#6b6862;--line:#e7e4de;--accent:#c2410c;--accent-soft:#fff1e9;--radius:14px}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#151412;--surface:#1e1d1a;--text:#f0eee9;--muted:#9c988f;--line:#302e2a;--accent:#fb923c;--accent-soft:#2a1a0f}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Noto Sans JP",sans-serif;line-height:1.65;-webkit-text-size-adjust:100%}
.wrap{max-width:720px;margin:0 auto;padding:20px 16px 64px}
header{padding:24px 0 20px;border-bottom:1px solid var(--line);margin-bottom:20px}
h1{font-size:1.5rem;margin:0 0 6px;letter-spacing:-.01em}
.tagline{color:var(--muted);font-size:.9rem;margin:0}
.updated{color:var(--muted);font-size:.78rem;margin-top:10px}
nav{display:flex;gap:8px;margin:16px 0 0;flex-wrap:wrap}
nav a{font-size:.82rem;padding:6px 12px;border:1px solid var(--line);border-radius:999px;text-decoration:none;color:var(--text);background:var(--surface)}
nav a[aria-current=page]{background:var(--accent);color:#fff;border-color:var(--accent)}
.card{display:flex;gap:12px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:12px;margin-bottom:12px}
.card img{width:84px;height:84px;object-fit:contain;border-radius:8px;background:#fff;flex-shrink:0}
.card-body{min-width:0;flex:1}
.badge{display:inline-block;font-size:.72rem;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--accent-soft);color:var(--accent);margin-bottom:6px}
.title{font-size:.9rem;font-weight:600;margin:0 0 6px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.title a{color:inherit;text-decoration:none}
.title a:hover{text-decoration:underline}
.meta{font-size:.8rem;color:var(--muted);display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.price{color:var(--accent);font-weight:700}
.warn{background:#fff7ed;border:1px solid #fdba74;color:#9a3412;border-radius:10px;padding:10px 12px;font-size:.8rem;margin-bottom:16px}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]) .warn{background:#2a1a0f;border-color:#7c2d12;color:#fdba74}}
.empty{text-align:center;color:var(--muted);padding:48px 16px;border:1px dashed var(--line);border-radius:var(--radius)}
footer{margin-top:40px;padding-top:20px;border-top:1px solid var(--line);font-size:.76rem;color:var(--muted)}
footer a{color:var(--muted)}
pre.post{white-space:pre-wrap;word-break:break-word;font-size:.82rem;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:10px;margin:8px 0 0;font-family:inherit}
.btns{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}
button,.btn{font:inherit;font-size:.82rem;padding:8px 14px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--text);cursor:pointer;text-decoration:none;display:inline-block}
.btn-primary{background:var(--accent);color:#fff;border-color:var(--accent)}
button:active{opacity:.7}
`;

function page(title, body, current) {
  return `<!doctype html>
<html lang="ja"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(config.site.tagline)}">
<style>${CSS}</style>
</head><body><div class="wrap">
<header>
  <h1>${esc(config.site.title)}</h1>
  <p class="tagline">${esc(config.site.tagline)}</p>
  <p class="updated">最終更新: ${fmtDate(feed.updatedAt) || '—'}</p>
  <nav>
    <a href="./"${current === 'index' ? ' aria-current="page"' : ''}>速報</a>
    <a href="./queue.html"${current === 'queue' ? ' aria-current="page"' : ''}>投稿キュー</a>
    <a href="./feed.json">JSON</a>
    <a href="./rss.xml">RSS</a>
  </nav>
</header>
${sick.length ? `<div class="warn">⚠ 取得できていないショップ: ${esc(sick.map((s) => `${s.label}（${s.lastError ? 'エラー: ' + s.lastError.slice(0, 40) : s.consecutiveEmpty + '回連続0件'}）`).join(' / '))}</div>` : ''}
${body}
<footer>
  <p>当サイトのリンクの一部はアフィリエイトリンクを含みます。価格・在庫は取得時点のもので、変動する場合があります。</p>
  <p>Generated by <a href="https://github.com/momentouhu/rare-item-radar">rare-item-radar</a></p>
</footer>
</div></body></html>`;
}

// ---- 速報ページ ----
const eventCards = feed.events
  .slice(0, 100)
  .map(
    (ev) => `<article class="card">
  ${ev.item.image ? `<img src="${esc(ev.item.image)}" alt="" loading="lazy">` : ''}
  <div class="card-body">
    <span class="badge">${esc(ev.emoji)} ${esc(ev.label)}</span>
    <p class="title"><a href="${esc(ev.item.url)}" target="_blank" rel="nofollow sponsored noopener">${esc(ev.item.title)}</a></p>
    <div class="meta">
      <span class="price">${esc(yen(ev.item.price))}</span>
      <span>${esc(ev.item.sourceLabel)}</span>
      <span>${esc(fmtDate(ev.detectedAt))}</span>
    </div>
  </div>
</article>`
  )
  .join('\n');

fs.writeFileSync(
  'docs/index.html',
  page(
    config.site.title,
    eventCards || `<p class="empty">まだ検知イベントがありません。<br>クロールが2回以上走ると差分が出ます。</p>`,
    'index'
  )
);

// ---- 投稿キューページ（スマホからコピペ投稿する用） ----
const pending = queue.items.filter((q) => !q.posted?.x);
const CHANNEL_NAMES = { threads: 'Threads', bluesky: 'Bluesky', discord: 'Discord', x: 'X', worker: '自動配信済' };
const sentTo = (q) => {
  const done = Object.keys(q.posted || {}).map((k) => CHANNEL_NAMES[k] || k);
  return done.length ? `<span>配信済: ${esc(done.join(', '))}</span>` : '';
};

const queueCards = pending
  .map((q, i) => {
    const text = q.textWithLink;
    const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    return `<article class="card" style="flex-direction:column">
  <div style="display:flex;gap:12px;width:100%">
    ${q.image ? `<img src="${esc(q.image)}" alt="" loading="lazy">` : ''}
    <div class="card-body">
      <span class="badge">${esc(q.emoji)} ${esc(q.label)}</span>
      <p class="title">${esc(q.title)}</p>
      <div class="meta"><span class="price">${esc(yen(q.price))}</span><span>${esc(q.sourceLabel)}</span>${sentTo(q)}</div>
    </div>
  </div>
  <pre class="post" id="p${i}">${esc(text)}</pre>
  <div class="btns">
    <button type="button" data-copy="p${i}">コピー</button>
    <a class="btn btn-primary" href="${esc(intent)}" target="_blank" rel="noopener">Xで開く</a>
  </div>
</article>`;
  })
  .join('\n');

const queueBody = `
<p style="font-size:.85rem;color:var(--muted);margin:0 0 16px">
「Xで開く」を押すと本文が入った状態で投稿画面が開きます。X APIを使わないのでコストは0円です。
</p>
${queueCards || `<p class="empty">未投稿のキューはありません。</p>`}
<script>
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-copy]');
  if (!btn) return;
  const el = document.getElementById(btn.dataset.copy);
  try {
    await navigator.clipboard.writeText(el.textContent);
    const old = btn.textContent;
    btn.textContent = 'コピーしました';
    setTimeout(() => { btn.textContent = old; }, 1500);
  } catch { alert('コピーできませんでした'); }
});
</script>`;

fs.writeFileSync('docs/queue.html', page(`投稿キュー | ${config.site.title}`, queueBody, 'queue'));

// ---- JSON / RSS ----
fs.writeFileSync('docs/feed.json', JSON.stringify(feed, null, 2));

const base = config.site.baseUrl || '';
const rssItems = feed.events
  .slice(0, 50)
  .map(
    (ev) => `  <item>
    <title>${esc(`${ev.emoji}【${ev.label}】${ev.item.title}`)}</title>
    <link>${esc(ev.item.url)}</link>
    <guid isPermaLink="false">${esc(ev.item.id)}:${esc(ev.type)}</guid>
    <pubDate>${new Date(ev.detectedAt).toUTCString()}</pubDate>
    <description>${esc(`${yen(ev.item.price)} / ${ev.item.sourceLabel}`)}</description>
  </item>`
  )
  .join('\n');

fs.writeFileSync(
  'docs/rss.xml',
  `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>${esc(config.site.title)}</title>
  <link>${esc(base)}</link>
  <description>${esc(config.site.tagline)}</description>
  <lastBuildDate>${new Date(feed.updatedAt || Date.now()).toUTCString()}</lastBuildDate>
${rssItems}
</channel></rss>`
);

console.log(`■ サイト生成: ${feed.events.length}件の速報 / ${pending.length}件の投稿キュー`);
