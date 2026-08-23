import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = 'data';

export function readJson(name, fallback) {
  const p = path.join(DATA_DIR, name);
  if (!fs.existsSync(p)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}

export function writeJson(name, value) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, name), JSON.stringify(value, null, 2) + '\n');
}

/** seen.json が無限に育たないように、更新の無いものを落とす */
export function pruneSeen(seen, maxAgeDays = 45) {
  const cutoff = Date.now() - maxAgeDays * 86400_000;
  const out = {};
  for (const [id, rec] of Object.entries(seen)) {
    if (new Date(rec.lastSeenAt).getTime() >= cutoff) out[id] = rec;
  }
  return out;
}
