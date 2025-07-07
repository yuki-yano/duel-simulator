import { sqliteTable, text, index } from "drizzle-orm/sqlite-core"

// Deck image metadata
export const deckImages = sqliteTable("deck_images", {
  hash: text("hash").primaryKey(),
  createdAt: text("created_at").notNull(),
})

// Game save states
export const savedStates = sqliteTable(
  "saved_states",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    stateJson: text("state_json").notNull(),
    deckImageHash: text("deck_image_hash")
      .notNull()
      .references(() => deckImages.hash),
    createdAt: text("created_at").notNull(),
  },
  (table) => {
    return {
      sessionIdIdx: index("idx_saved_states_session_id").on(table.sessionId),
      createdAtIdx: index("idx_saved_states_created_at").on(table.createdAt),
    }
  },
)
