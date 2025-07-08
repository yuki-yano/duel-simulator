import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"

// Deck image metadata
export const deckImages = sqliteTable(
  "deck_images",
  {
    hash: text("hash").primaryKey(),
    aspectRatioType: text("aspect_ratio_type").notNull(), // 'TYPE_1', 'TYPE_2', 'TYPE_3'
    mainDeckCount: integer("main_deck_count").notNull(),
    extraDeckCount: integer("extra_deck_count").notNull(),
    sourceWidth: integer("source_width").notNull(),
    sourceHeight: integer("source_height").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => {
    return {
      createdAtIdx: index("idx_deck_images_created_at").on(table.createdAt),
    }
  },
)

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
