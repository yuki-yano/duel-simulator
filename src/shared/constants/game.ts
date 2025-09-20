/**
 * Game-related constants
 */

// Zone limits
export const ZONE_LIMITS = {
  MONSTER_ZONE: 5,
  SPELL_TRAP_ZONE: 5,
  EXTRA_MONSTER_ZONE: 2,
  FIELD_ZONE: 1, // Single card only
} as const

// Initial game values
export const INITIAL_GAME_VALUES = {
  LIFE_POINTS: 8000,
} as const

// Zone types that support position indexing
export const POSITION_INDEXED_ZONES = [
  "monsterZone",
  "spellTrapZone",
  "extraMonsterZone",
] as const

// Zone types that are array-based (order only)
export const ARRAY_BASED_ZONES = [
  "hand",
  "deck",
  "graveyard",
  "banished",
  "extraDeck",
  "freeZone",
  "sideFreeZone",
] as const
