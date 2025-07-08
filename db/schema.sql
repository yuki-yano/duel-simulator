-- Deck image metadata
CREATE TABLE IF NOT EXISTS deck_images (
  hash TEXT PRIMARY KEY,
  aspect_ratio_type TEXT NOT NULL, -- 'TYPE_1', 'TYPE_2', 'TYPE_3'
  main_deck_count INTEGER NOT NULL,
  extra_deck_count INTEGER NOT NULL,
  source_width INTEGER NOT NULL,
  source_height INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

-- Game save states
CREATE TABLE IF NOT EXISTS saved_states (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  state_json TEXT NOT NULL,
  deck_image_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (deck_image_hash) REFERENCES deck_images(hash)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_saved_states_session_id ON saved_states(session_id);
CREATE INDEX IF NOT EXISTS idx_saved_states_created_at ON saved_states(created_at);
CREATE INDEX IF NOT EXISTS idx_deck_images_created_at ON deck_images(created_at);