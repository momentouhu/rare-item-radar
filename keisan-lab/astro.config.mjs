// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// GitHub Pages (project site) では https://<user>.github.io/<repo>/ 配下に配信されるため
// base を付ける。独自ドメインに移行したら SITE_URL と BASE_PATH を差し替えるだけでよい。
const SITE_URL = process.env.SITE_URL ?? 'https://momentouhu.github.io';
const BASE_PATH = process.env.BASE_PATH ?? '/keisan-lab';

export default defineConfig({
  site: SITE_URL,
  base: BASE_PATH,
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  integrations: [
    sitemap({
      changefreq: 'weekly',
      priority: 0.7,
    }),
  ],
});
