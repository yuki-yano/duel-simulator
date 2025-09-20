/**
 * Delay and timeout constants (in milliseconds)
 */
export const DELAYS = {
  // Initial wait times
  INITIAL_WAIT: 10, // CardAnimationOverlay initial wait

  // DOM update wait times
  INITIAL_DOM_WAIT: 50, // Initial DOM update wait (used in replay/history operations)
  DOM_UPDATE_SHORT: 50, // General DOM update wait (ActionButtons, animations) - same as INITIAL_DOM_WAIT
  DOM_UPDATE: 100, // Standard DOM update wait (undoRedo, screenshotUtils, ActionButtons)
  DOM_UPDATE_LONG: 150, // Longer DOM update wait (ActionButtons, ogpScreenshot)

  // UI feedback
  COPY_MESSAGE_DURATION: 2000, // Copy success message display duration

  // Touch/Mobile specific
  LONG_PRESS_DURATION: 600, // Long press detection for mobile context menu (currently unused in code)

  // Tooltip
  TOOLTIP_DELAY: 100, // TooltipProvider delay duration
} as const

/**
 * Helper function to get delay value
 */
export function getDelay(key: keyof typeof DELAYS): number {
  return DELAYS[key]
}
