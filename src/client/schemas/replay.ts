import { z } from "zod"

// Card schema
export const CardSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  imageUrl: z.string().optional(), // サーバー側で削除されるためオプショナル
  position: z.enum(["attack", "defense", "facedown", "spell", "set"]),
  rotation: z.number().default(0),
  faceDown: z.boolean().optional(),
  highlighted: z.boolean().optional(),
  counter: z.number().optional(),
  // Optional fields from Card interface
  attack: z.number().optional(),
  defense: z.number().optional(),
  level: z.number().optional(),
  type: z.string().optional(),
  description: z.string().optional(),
})

// PlayerBoard schema
export const PlayerBoardSchema = z.object({
  monsterZones: z.array(z.array(CardSchema)),
  spellTrapZones: z.array(z.array(CardSchema)),
  fieldZone: z.nullable(CardSchema),
  graveyard: z.array(CardSchema),
  banished: z.array(CardSchema),
  extraDeck: z.array(CardSchema),
  deck: z.array(CardSchema),
  hand: z.array(CardSchema),
  extraMonsterZones: z.array(z.array(CardSchema)),
  // フリーゾーン機能（2025年7月追加）
  // 古いリプレイデータとの互換性のためオプショナル
  freeZone: z.array(CardSchema).optional(), // フィールド下のフリーゾーン
  sideFreeZone: z.array(CardSchema).optional(), // 左側のフリーゾーン（1024px以上）
  sideDeck: z.array(CardSchema).optional(),
  lifePoints: z.number(),
})

// GameState schema
export const GameStateSchema = z.object({
  players: z.object({
    self: PlayerBoardSchema,
    opponent: PlayerBoardSchema,
  }),
  turn: z.number(),
  phase: z.enum(["draw", "standby", "main1", "battle", "main2", "end"]),
  currentPlayer: z.enum(["self", "opponent"]),
})

// OperationZone schema
export const OperationZoneSchema = z.object({
  player: z.enum(["self", "opponent"]),
  zoneType: z.enum([
    "monsterZone",
    "spellTrapZone",
    "fieldZone",
    "graveyard",
    "banished",
    "extraDeck",
    "deck",
    "hand",
    "extraMonsterZone",
    "freeZone",
    "sideFreeZone",
    "sideDeck",
  ]),
  zoneIndex: z.number().optional(),
  insertPosition: z.union([z.number(), z.literal("last")]).optional(),
})

// GameOperation schema
export const GameOperationSchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  type: z.enum([
    "move",
    "summon",
    "set",
    "attack",
    "activate",
    "target",
    "negate",
    "draw",
    "shuffle",
    "rotate",
    "changePosition",
    "toggleHighlight",
    "updateCounter",
  ]),
  cardId: z.string(),
  from: OperationZoneSchema.optional(),
  to: OperationZoneSchema.optional(),
  player: z.enum(["self", "opponent"]),
  metadata: z
    .union([
      z.object({ angle: z.number() }), // rotate操作時
      z.object({ flip: z.boolean() }), // changePosition操作時
      z.object({ counter: z.number() }), // updateCounter操作時
      z.record(z.string(), z.unknown()), // その他の任意のメタデータ
    ])
    .optional(),
})

// DeckCardIdsMapping schema - only supports old format (index -> cardId mapping)
export const DeckCardIdsMappingSchema = z.object({
  mainDeck: z.record(z.string(), z.string()),
  extraDeck: z.record(z.string(), z.string()),
  sideDeck: z.record(z.string(), z.string()).optional(), // Optional for backward compatibility
})

// DeckSection schema
export const DeckSectionSchema = z.object({
  label: z.string(),
  count: z.number(),
  yPosition: z.number(),
  rows: z.number(),
})

// DeckConfiguration schema - actual structure from DeckImageProcessor
export const DeckConfigurationSchema = z.object({
  mainDeck: DeckSectionSchema.nullable(),
  extraDeck: DeckSectionSchema.nullable(),
  sideDeck: DeckSectionSchema.nullable(),
  cardWidth: z.number(),
  cardHeight: z.number(),
  cardGap: z.number(),
  leftMargin: z.number(),
})

// ReplaySaveData schema - flexible to support different formats
export const ReplaySaveDataSchema = z.object({
  version: z.literal("1.0"),
  type: z.literal("replay"),
  data: z.object({
    initialState: GameStateSchema,
    operations: z.array(GameOperationSchema),
    deckImageHash: z.string(),
    deckCardIds: DeckCardIdsMappingSchema.optional(), // May be stored separately
  }),
  metadata: z.object({
    title: z.string(),
    description: z.string().optional(),
    createdAt: z.number(),
    duration: z.number(),
    operationCount: z.number(),
  }),
})

// Saved state response schema
export const SavedStateResponseSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  stateJson: z.string(),
  deckImageHash: z.string(),
  createdAt: z.string(),
  title: z.string(),
  description: z.string().optional(),
  type: z.string(),
  version: z.string(),
  deckConfig: z.string(),
  deckCardIds: z.string(),
})

// SavedState schema
export const SavedStateSchema = z.object({
  id: z.string(),
  type: z.enum(["snapshot", "replay"]),
  initialState: GameStateSchema,
  operations: z.array(GameOperationSchema),
  metadata: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    createdAt: z.number(),
    originalStartIndex: z.number().optional(),
    originalEndIndex: z.number().optional(),
    deckImageHash: z.string().optional(),
  }),
})

// Type exports
export type Card = z.infer<typeof CardSchema>
export type PlayerBoard = z.infer<typeof PlayerBoardSchema>
export type GameState = z.infer<typeof GameStateSchema>
export type GameOperation = z.infer<typeof GameOperationSchema>
export type DeckCardIdsMapping = z.infer<typeof DeckCardIdsMappingSchema>
export type DeckSection = z.infer<typeof DeckSectionSchema>
export type DeckConfiguration = z.infer<typeof DeckConfigurationSchema>
export type ReplaySaveData = z.infer<typeof ReplaySaveDataSchema>
export type SavedState = z.infer<typeof SavedStateSchema>
export type SavedStateResponse = z.infer<typeof SavedStateResponseSchema>
