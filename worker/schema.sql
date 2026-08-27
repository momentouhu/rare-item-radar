-- 監視中の商品スナップショット（差分検知の基準）
CREATE TABLE IF NOT EXISTS items (
  id            TEXT PRIMARY KEY,
  price         INTEGER,
  in_stock      INTEGER,
  title         TEXT,
  first_seen_at TEXT,
  last_seen_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_items_last_seen ON items(last_seen_at);

-- 検知したイベント（サイト生成とSNS配信のソース）
CREATE TABLE IF NOT EXISTS events (
  id           TEXT PRIMARY KEY,
  type         TEXT,
  watch_id     TEXT,
  watch_label  TEXT,
  label        TEXT,
  emoji        TEXT,
  title        TEXT,
  url          TEXT,
  image        TEXT,
  price        INTEGER,
  prev_price   INTEGER,
  source_label TEXT,
  detected_at  TEXT,
  posted       TEXT DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_events_detected ON events(detected_at DESC);
