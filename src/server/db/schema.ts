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
    id: text("id").primaryKey(), // 8文字のnanoid
    sessionId: text("session_id").notNull(),
    stateJson: text("state_json").notNull(), // ReplaySaveDataをJSON化（imageUrl削除済み）
    deckImageHash: text("deck_image_hash")
      .notNull()
      .references(() => deckImages.hash),

    // 新規追加フィールド
    title: text("title").notNull(), // リプレイタイトル
    description: text("description"), // 説明（NULL可）
    type: text("type").notNull(), // "replay" or "snapshot"
    version: text("version").notNull(), // データ形式バージョン
    deckConfig: text("deck_config").notNull(), // デッキ構成情報（JSON化）
    deckCardIds: text("deck_card_ids").notNull(), // デッキカードのIDマッピング（JSON化）

    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at"), // 将来の編集機能用
  },
  (table) => {
    return {
      sessionIdIdx: index("idx_saved_states_session_id").on(table.sessionId),
      createdAtIdx: index("idx_saved_states_created_at").on(table.createdAt),
    }
  },
)
