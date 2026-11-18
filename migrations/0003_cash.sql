-- Cash accounting (FT-21): every operation belongs to the card or to the shared
-- cash wallet, and transfers move money between the two.

ALTER TABLE transactions ADD COLUMN account TEXT NOT NULL DEFAULT 'card' CHECK (account IN ('card', 'cash'));

-- NULL until the family has entered how much cash it had when cash accounting started.
ALTER TABLE settings ADD COLUMN opening_cash_kopeks INTEGER CHECK (opening_cash_kopeks IS NULL OR opening_cash_kopeks >= 0);

-- A transfer takes money from from_account and puts it into the other account.
CREATE TABLE transfers (
  user_id TEXT NOT NULL,
  id TEXT NOT NULL,
  from_account TEXT NOT NULL CHECK (from_account IN ('card', 'cash')),
  amount_kopeks INTEGER NOT NULL CHECK (amount_kopeks > 0),
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  author TEXT CHECK (author IN ('self', 'wife')),
  note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 500),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  deleted_at TEXT,
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id) REFERENCES settings(user_id) ON DELETE RESTRICT
);

CREATE INDEX idx_transfers_recent ON transfers(user_id, occurred_at DESC) WHERE deleted_at IS NULL;

-- SQLite cannot change a CHECK constraint in place, so the change log is rebuilt
-- with the same sequence numbers to accept the new entity type.
CREATE TABLE change_log_next (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('settings', 'category', 'transaction', 'goal', 'goal_move', 'transfer')),
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('upsert', 'delete')),
  entity_json TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES settings(user_id) ON DELETE RESTRICT
);

INSERT INTO change_log_next (seq, user_id, entity_type, entity_id, action, entity_json, changed_at)
  SELECT seq, user_id, entity_type, entity_id, action, entity_json, changed_at FROM change_log ORDER BY seq;

DROP TABLE change_log;
ALTER TABLE change_log_next RENAME TO change_log;
CREATE INDEX idx_change_log_user_seq ON change_log(user_id, seq);
