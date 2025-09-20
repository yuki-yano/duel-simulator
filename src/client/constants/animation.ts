export const ANIM = {
  EFFECT: { ANIMATION: 400, DURATION: 550 },
  HIGHLIGHT: { ANIMATION: 300, DURATION: 400 },
  TARGET: { ANIMATION: 300, DURATION: 400 },
  ROTATION: { ANIMATION: 300, DURATION: 400 },
  FLIP: { ANIMATION: 400, DURATION: 550 },
  MOVE: { ANIMATION: 700, DURATION: 850 },
} as const

// Replay-specific delay (moved from animation constants)
export const REPLAY_DELAY = 10 as const

/**
 * Default animation durations for various UI elements (in milliseconds)
 */
export const DEFAULT_ANIMATION_DURATION = {
  // Card animations
  CARD_OVERLAY: 300, // Default duration for CardAnimationOverlay
  CARD_TRANSITION: 200, // DraggableCard transition duration

  // UI transitions
  TRANSITION_FAST: 150, // Fast transitions
  TRANSITION_DEFAULT: 200, // Standard transitions (duration-200)
  TRANSITION_SLOW: 300, // Slower transitions (duration-300)

  // Animation midpoints
  HALF_DURATION_MULTIPLIER: 0.5, // Used for animation midpoints (D / 2)
  DOUBLE_DURATION_MULTIPLIER: 2, // Used for extended animations (ANIMATION * 2)
} as const
