const PDS = process.env.BLUESKY_PDS || 'https://bsky.social';

/**
 * Bluesky (AT Protocol) — 完全無料・APIキー不要（アプリパスワードのみ）。
 * 上限は 5,000ポイント/時（1投稿=3pt）= 実質 1,666投稿/時。事実上あたらない。
 */
export const bluesky = {
  id: 'bluesky',
  label: 'Bluesky',
  costPerPost: 0,
  enabled: () => Boolean(process.env.BLUESKY_IDENTIFIER && process.env.BLUESKY_APP_PASSWORD),

  async post({ text, url, title, image }) {
    const session = await login();

    const record = {
      $type: 'app.bsky.feed.post',
      text,
      createdAt: new Date().toISOString(),
      langs: ['ja'],
      facets: linkFacets(text),
    };

    if (url) {
      record.embed = {
        $type: 'app.bsky.embed.external',
        external: {
          uri: url,
          title: (title || '').slice(0, 100),
          description: '',
          ...(await maybeThumb(session, image)),
        },
      };
    }

    const res = await fetch(`${PDS}/xrpc/com.atproto.repo.createRecord`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessJwt}` },
      body: JSON.stringify({ repo: session.did, collection: 'app.bsky.feed.post', record }),
    });
    if (!res.ok) throw new Error(`Bluesky HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return (await res.json()).uri;
  },
};

async function login() {
  const res = await fetch(`${PDS}/xrpc/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: process.env.BLUESKY_IDENTIFIER,
      password: process.env.BLUESKY_APP_PASSWORD,
    }),
  });
  if (!res.ok) throw new Error(`Bluesky login HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/** Blueskyはリンクを自動でリンク化しないので、UTF-8バイト位置で範囲を指定する */
function linkFacets(text) {
  const facets = [];
  const enc = new TextEncoder();
  const re = /https?:\/\/[^\s]+/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    facets.push({
      index: {
        byteStart: enc.encode(text.slice(0, m.index)).length,
        byteEnd: enc.encode(text.slice(0, m.index + m[0].length)).length,
      },
      features: [{ $type: 'app.bsky.richtext.facet#link', uri: m[0] }],
    });
  }
  return facets;
}

/** サムネはblobとしてアップロードが必要。失敗しても投稿自体は通す */
async function maybeThumb(session, imageUrl) {
  if (!imageUrl) return {};
  try {
    const img = await fetch(imageUrl);
    if (!img.ok) return {};
    const buf = Buffer.from(await img.arrayBuffer());
    if (buf.length > 976_000) return {}; // Blueskyのblob上限
    const res = await fetch(`${PDS}/xrpc/com.atproto.repo.uploadBlob`, {
      method: 'POST',
      headers: {
        'Content-Type': img.headers.get('content-type') || 'image/jpeg',
        Authorization: `Bearer ${session.accessJwt}`,
      },
      body: buf,
    });
    if (!res.ok) return {};
    return { thumb: (await res.json()).blob };
  } catch {
    return {};
  }
}
