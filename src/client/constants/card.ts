/**
 * Card dimension constants
 */

// Card aspect ratio (width:height)
export const CARD_ASPECT_RATIO = {
  WIDTH: 59,
  HEIGHT: 86,
} as const

// Responsive card sizes (in pixels)
export const CARD_SIZE = {
  // Large screen (md: >= 768px)
  MEDIUM: {
    HEIGHT: 96,
    WIDTH: 66, // Math.round((96 * 59) / 86)
  },
  // Small screen (sm: >= 640px)
  SMALL: {
    HEIGHT: 80,
    WIDTH: 55, // Math.round((80 * 59) / 86)
  },
  // Default/Mobile
  DEFAULT: {
    HEIGHT: 56,
    WIDTH: 40, // Math.round((56 * 59) / 86)
  },
} as const

// Helper function to calculate card width from height
export const calculateCardWidth = (height: number): number => {
  return Math.round((height * CARD_ASPECT_RATIO.WIDTH) / CARD_ASPECT_RATIO.HEIGHT)
}

// Helper function to calculate card height from width
export const calculateCardHeight = (width: number): number => {
  return Math.round((width * CARD_ASPECT_RATIO.HEIGHT) / CARD_ASPECT_RATIO.WIDTH)
}
