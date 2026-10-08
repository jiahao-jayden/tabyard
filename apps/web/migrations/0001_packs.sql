CREATE TABLE packs (
  code            TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  author          TEXT NOT NULL DEFAULT '',
  description     TEXT NOT NULL DEFAULT '',
  version         INTEGER NOT NULL DEFAULT 1,
  md5             TEXT NOT NULL,
  content         TEXT NOT NULL,
  group_count     INTEGER NOT NULL,
  pattern_count   INTEGER NOT NULL,
  edit_token_hash TEXT,
  official        INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE INDEX packs_updated_at ON packs (updated_at DESC);
