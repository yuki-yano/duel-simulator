-- 001_initial_schema.sql
-- Create initial schema
-- This file is for history tracking, actual initialization uses schema.sql

-- Deck image metadata
CREATE TABLE IF NOT EXISTS deck_images (
  hash TEXT PRIMARY KEY,
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