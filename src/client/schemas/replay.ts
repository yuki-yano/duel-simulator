import { z } from "zod"

// Card schema
const CardSchema = z.object({
  id: z.string(),
  name: z.string(),
  imageUrl: z.string(),
  rotation: z.number().default(0),
  faceDown: z.boolean().optional(),
  highlighted: z.boolean().optional(),
})

// PlayerBoard schema
const PlayerBoardSchema = z.object({
  monsterZones: z.array(z.array(CardSchema)),
  spellTrapZones: z.array(z.array(CardSchema)),
  fieldZone: z.nullable(CardSchema),
  graveyard: z.array(CardSchema),
  banished: z.array(CardSchema),
  extraDeck: z.array(CardSchema),
  deck: z.array(CardSchema),
  hand: z.array(CardSchema),
  extraMonsterZones: z.array(z.array(CardSchema)),
  lifePoints: z.number(),
})

// GameState schema
const GameStateSchema = z.object({
  players: z.object({
    self: PlayerBoardSchema,
    opponent: PlayerBoardSchema,
  }),
  turn: z.number(),
  phase: z.enum(["draw", "standby", "main1", "battle", "main2", "end"]),
  currentPlayer: z.enum(["self", "opponent"]),
})

// OperationZone schema
const OperationZoneSchema = z.object({
  player: z.enum(["self", "opponent"]),
  zoneType: z.string(),
  zoneIndex: z.number().optional(),
  insertPosition: z.union([z.number(), z.literal("last")]).optional(),
})

// GameOperation schema
const GameOperationSchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  type: z.enum(["move", "rotate", "draw", "activate", "shuffle", "changePosition", "toggleHighlight"]),
  cardId: z.string().optional(),
  from: OperationZoneSchema.optional(),
  to: OperationZoneSchema.optional(),
  player: z.enum(["self", "opponent"]),
  metadata: z.any().optional(),
})

// DeckCardIdsMapping schema - supports both old and new formats
export const DeckCardIdsMappingSchema = z.union([
  // New format (array of objects)
  z.object({
    mainDeck: z.array(
      z.object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
        id: z.string(),
      }),
    ),
    extraDeck: z.array(
      z.object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
        id: z.string(),
      }),
    ),
  }),
  // Old format (index -> cardId mapping)
  z.object({
    mainDeck: z.record(z.string(), z.string()),
    extraDeck: z.record(z.string(), z.string()),
  }),
])

// DeckSection schema
const DeckSectionSchema = z.object({
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
  version: z.string(),
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

// Type exports
export type ValidatedReplaySaveData = z.infer<typeof ReplaySaveDataSchema>
export type ValidatedSavedStateResponse = z.infer<typeof SavedStateResponseSchema>
