/**
 * Discord Webhook — 完全無料。既存のトレカ系コミュニティに流すのが強い。
 * Webhookを作ってURLをSecretに入れるだけで動く。
 */
export const discord = {
  id: 'discord',
  label: 'Discord',
  costPerPost: 0,
  enabled: () => Boolean(process.env.DISCORD_WEBHOOK_URL),

  async post({ title, url, image, price, sourceLabel, label, emoji }) {
    const res = await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [
          {
            title: `${emoji} 【${label}】${title}`.slice(0, 250),
            url,
            color: 0xc2410c,
            fields: [
              { name: '価格', value: price ? `¥${Number(price).toLocaleString('ja-JP')}` : '未定', inline: true },
              { name: 'ショップ', value: sourceLabel || '-', inline: true },
            ],
            ...(image ? { thumbnail: { url: image } } : {}),
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Discord HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return 'ok';
  },
};
