/**
 * Application limits and constraints
 */

// File size limits
export const FILE_SIZE_LIMITS = {
  MAX_IMAGE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_BLOB_SIZE: 10 * 1024 * 1024, // 10MB for blob storage
} as const

// UI constraints
export const UI_CONSTRAINTS = {
  MAX_DEBUG_IMAGE_HEIGHT: 400, // Maximum height for debug images (px)
  MIN_DECK_ZONE_HEIGHT_BASE: 80, // Base minimum height for deck zone
  MIN_DECK_ZONE_HEIGHT_OFFSET: 60, // Offset for deck zone height calculation
  DECK_ZONE_CARD_SPACING: 3, // Spacing between cards in deck zone
} as const

// Opacity values for various states
export const OPACITY_VALUES = {
  ACTIVATE_ANIMATING: 0.25,
  DRAGGING: 0.5,
  TOUCHING: 0.5,
  EFFECT_SHADOW_LIGHT: 0.5,
  EFFECT_SHADOW_MEDIUM: 0.6,
  EFFECT_SHADOW_DARK: 0.8,
  DISABLED: 0.5,
  SEMI_TRANSPARENT: 0.7,
  ICON_SUBTLE: 0.6,
} as const

// Replay settings
export const REPLAY_SETTINGS = {
  DEFAULT_START_DELAY: 0.5, // Default delay before replay starts (seconds)
} as const
