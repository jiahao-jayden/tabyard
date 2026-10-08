CREATE TABLE checkout (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  createdAt INTEGER NOT NULL
);

CREATE INDEX checkout_createdAt ON checkout (createdAt);
