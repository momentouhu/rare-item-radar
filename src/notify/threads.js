import { sleep } from '../lib/http.js';

const API = 'https://graph.threads.net/v1.0';

/**
 * Threads (Meta) — 完全無料。1プロフィールあたり 250投稿/24h。
 * リンク付き投稿も追加料金なし。X APIの代替として第一候補。
 */
export const threads = {
  id: 'threads',
  label: 'Threads',
  costPerPost: 0,
  enabled: () => Boolean(process.env.THREADS_USER_ID && process.env.THREADS_ACCESS_TOKEN),

  async post({ text, image }) {
    const userId = process.env.THREADS_USER_ID;
    const token = process.env.THREADS_ACCESS_TOKEN;

    // 1) コンテナ作成
    const createParams = new URLSearchParams({ access_token: token, text });
    if (image) {
      createParams.set('media_type', 'IMAGE');
      createParams.set('image_url', image);
    } else {
      createParams.set('media_type', 'TEXT');
    }

    const created = await call(`${API}/${userId}/threads`, createParams);

    // 画像つきはMeta側の処理待ちが要る
    if (image) await sleep(5000);

    // 2) 公開
    const published = await call(
      `${API}/${userId}/threads_publish`,
      new URLSearchParams({ access_token: token, creation_id: created.id })
    );
    return published.id;
  },
};

async function call(url, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Threads HTTP ${res.status}: ${body.slice(0, 300)}`);
  return JSON.parse(body);
}
