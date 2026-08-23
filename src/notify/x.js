import crypto from 'node:crypto';

/**
 * X (Twitter) — 2026年2月から従量課金。無料枠は新規向けに廃止。
 * URL付き投稿は $0.20/件 と極端に高いため、必ず予算上限で守る。
 */
export const x = {
  id: 'x',
  label: 'X',
  metered: true,
  priceLink: Number(process.env.X_PRICE_LINK_POST ?? 0.2),
  pricePlain: Number(process.env.X_PRICE_PLAIN_POST ?? 0.015),
  enabled: () =>
    Boolean(
      process.env.X_API_KEY &&
        process.env.X_API_SECRET &&
        process.env.X_ACCESS_TOKEN &&
        process.env.X_ACCESS_SECRET
    ),

  async post({ text }) {
    const url = 'https://api.twitter.com/2/tweets';
    const oauth = {
      oauth_consumer_key: process.env.X_API_KEY,
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: process.env.X_ACCESS_TOKEN,
      oauth_version: '1.0',
    };

    // JSONボディは署名対象に含めない
    const paramString = Object.keys(oauth)
      .sort()
      .map((k) => `${pct(k)}=${pct(oauth[k])}`)
      .join('&');
    const base = ['POST', pct(url), pct(paramString)].join('&');
    const signingKey = `${pct(process.env.X_API_SECRET)}&${pct(process.env.X_ACCESS_SECRET)}`;
    oauth.oauth_signature = crypto.createHmac('sha1', signingKey).update(base).digest('base64');

    const header =
      'OAuth ' +
      Object.keys(oauth)
        .sort()
        .map((k) => `${pct(k)}="${pct(oauth[k])}"`)
        .join(', ');

    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: header, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`X HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return (await res.json()).data?.id;
  },
};

function pct(s) {
  return encodeURIComponent(s).replace(/[!*'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}
