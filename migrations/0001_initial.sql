-- One authenticated account represents one shared family ledger.
-- All money values are signed 64-bit integer kopeks; API validation keeps them
-- within JavaScript's safe integer range.

CREATE TABLE settings (
  user_id TEXT PRIMARY KEY,
  opening_balance_kopeks INTEGER NOT NULL CHECK (opening_balance_kopeks >= 0),
  started_at TEXT NOT NULL,
  time_zone TEXT NOT NULL DEFAULT 'Europe/Moscow',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE categories (
  user_id TEXT NOT NULL,
  id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id) REFERENCES settings(user_id) ON DELETE RESTRICT
);

CREATE TABLE goals (
  user_id TEXT NOT NULL,
  id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  target_kopeks INTEGER NOT NULL CHECK (target_kopeks > 0),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id) REFERENCES settings(user_id) ON DELETE RESTRICT
);

CREATE TABLE transactions (
  user_id TEXT NOT NULL,
  id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
  amount_kopeks INTEGER NOT NULL CHECK (amount_kopeks > 0),
  category_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  author TEXT CHECK (author IN ('self', 'wife')),
  note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 500),
  goal_id TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  deleted_at TEXT,
  PRIMARY KEY (user_id, id),
  CHECK (goal_id IS NULL OR type = 'expense'),
  FOREIGN KEY (user_id) REFERENCES settings(user_id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id, category_id) REFERENCES categories(user_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id, goal_id) REFERENCES goals(user_id, id) ON DELETE RESTRICT
);

-- Positive values reserve money for a goal; negative values release it.
-- Spending from a goal is recorded on its expense transaction, not here.
CREATE TABLE goal_moves (
  user_id TEXT NOT NULL,
  id TEXT NOT NULL,
  goal_id TEXT NOT NULL,
  amount_kopeks INTEGER NOT NULL CHECK (amount_kopeks <> 0),
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id) REFERENCES settings(user_id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id, goal_id) REFERENCES goals(user_id, id) ON DELETE RESTRICT
);

-- A mutation ID is unique within a user ledger and stores the result returned
-- to that device so retries cannot apply the same change twice.
CREATE TABLE mutations (
  user_id TEXT NOT NULL,
  id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id) REFERENCES settings(user_id) ON DELETE RESTRICT
);

-- Global sequence makes change order unambiguous. Clients request rows for
-- their authenticated user_id after their last observed sequence number.
CREATE TABLE change_log (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('settings', 'category', 'transaction', 'goal', 'goal_move')),
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('upsert', 'delete')),
  entity_json TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES settings(user_id) ON DELETE RESTRICT
);

CREATE INDEX idx_categories_active ON categories(user_id, type, sort_order) WHERE archived_at IS NULL;
CREATE INDEX idx_goals_active ON goals(user_id) WHERE archived_at IS NULL;
CREATE INDEX idx_transactions_month ON transactions(user_id, type, occurred_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_recent ON transactions(user_id, occurred_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_goal ON transactions(user_id, goal_id) WHERE goal_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_goal_moves_goal ON goal_moves(user_id, goal_id, occurred_at);
CREATE INDEX idx_mutations_created ON mutations(user_id, created_at);
CREATE INDEX idx_change_log_user_seq ON change_log(user_id, seq);
