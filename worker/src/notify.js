/** Discord Webhook — 完全無料・スマホのプッシュ通知が即座に鳴る。速報の主力 */
export async function toDiscord(env, ev) {
  if (!env.DISCORD_WEBHOOK_URL) return false;
  const res = await fetch(env.DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [
        {
          title: `${ev.emoji} 【${ev.label}】${ev.title}`.slice(0, 250),
          url: ev.url,
          color: 0xc2410c,
          fields: [
            { name: '価格', value: ev.price ? `¥${ev.price.toLocaleString('ja-JP')}` : '未定', inline: true },
            { name: 'ショップ', value: ev.sourceLabel || '-', inline: true },
          ],
          ...(ev.image ? { thumbnail: { url: ev.image } } : {}),
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Discord ${res.status}`);
  return true;
}

/** Threads — 完全無料。250投稿/24h */
export async function toThreads(env, ev, text) {
  if (!env.THREADS_USER_ID || !env.THREADS_ACCESS_TOKEN) return false;
  const base = `https://graph.threads.net/v1.0/${env.THREADS_USER_ID}`;

  const create = new URLSearchParams({ access_token: env.THREADS_ACCESS_TOKEN, text, media_type: 'TEXT' });
  const c = await fetch(`${base}/threads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: create,
  });
  if (!c.ok) throw new Error(`Threads create ${c.status}`);
  const { id } = await c.json();

  const pub = await fetch(`${base}/threads_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ access_token: env.THREADS_ACCESS_TOKEN, creation_id: id }),
  });
  if (!pub.ok) throw new Error(`Threads publish ${pub.status}`);
  return true;
}

/** Bluesky — 完全無料。アプリパスワードのみで投稿できる */
export async function toBluesky(env, ev, text) {
  if (!env.BLUESKY_IDENTIFIER || !env.BLUESKY_APP_PASSWORD) return false;
  const pds = env.BLUESKY_PDS || 'https://bsky.social';

  const s = await fetch(`${pds}/xrpc/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: env.BLUESKY_IDENTIFIER, password: env.BLUESKY_APP_PASSWORD }),
  });
  if (!s.ok) throw new Error(`Bluesky login ${s.status}`);
  const session = await s.json();

  const res = await fetch(`${pds}/xrpc/com.atproto.repo.createRecord`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessJwt}` },
    body: JSON.stringify({
      repo: session.did,
      collection: 'app.bsky.feed.post',
      record: {
        $type: 'app.bsky.feed.post',
        text,
        createdAt: new Date().toISOString(),
        langs: ['ja'],
        facets: linkFacets(text),
        ...(ev.url
          ? {
              embed: {
                $type: 'app.bsky.embed.external',
                external: { uri: ev.url, title: (ev.title || '').slice(0, 100), description: '' },
              },
            }
          : {}),
      },
    }),
  });
  if (!res.ok) throw new Error(`Bluesky ${res.status}`);
  return true;
}

/** Blueskyはリンクを自動でリンク化しないので、UTF-8バイト位置で範囲指定する */
function linkFacets(text) {
  const enc = new TextEncoder();
  const out = [];
  for (const m of text.matchAll(/https?:\/\/[^\s]+/g)) {
    out.push({
      index: {
        byteStart: enc.encode(text.slice(0, m.index)).length,
        byteEnd: enc.encode(text.slice(0, m.index + m[0].length)).length,
      },
      features: [{ $type: 'app.bsky.richtext.facet#link', uri: m[0] }],
    });
  }
  return out;
}
