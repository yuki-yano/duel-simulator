/**
 * Z-index layer constants for managing stacking order
 */
export const Z_INDEX = {
  // Base layers
  FIELD_ZONE: 10, // FieldZoneなどの基本ゾーン

  // Animation layers
  EFFECT_ACTIVATION: 9997,
  ROTATE_ANIMATION: 9998,
  HIGHLIGHT_ANIMATION: 9998,
  TARGET_SELECTION: 9998,
  NEGATE_ANIMATION: 9998,
  FLIP_ANIMATION: 9999,

  // Overlay layers
  CARD_ANIMATION_OVERLAY: 10000,
  CARD_CONTEXT_MENU: 10000,
  DRAGGABLE_CARD_PREVIEW: 99999,

  // Modal/Dialog layers
  MODAL_BACKDROP: 10001,
  MODAL_CONTENT: 10002,

  // Screenshot layer
  SCREENSHOT_OVERLAY: 19999,

  // Legacy modal z-index (for ZoneExpandModal, ExtraDeckExpandModal)
  LEGACY_MODAL: 40,

  // Alert dialog default
  ALERT_DIALOG: 50,
} as const

/**
 * Get z-index value for use in inline styles
 */
export function getZIndex(layer: keyof typeof Z_INDEX): number {
  return Z_INDEX[layer]
}

/**
 * Get z-index class for Tailwind CSS
 */
export function getZIndexClass(layer: keyof typeof Z_INDEX): string {
  return `z-[${Z_INDEX[layer]}]`
}
