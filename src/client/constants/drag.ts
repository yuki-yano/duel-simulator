import { DELAYS } from "@/client/constants/delays"

export const LONG_PRESS_DURATION_MS = DELAYS.LONG_PRESS_DURATION
export const TOUCH_MOVE_THRESHOLD = 5
export const DOUBLE_CLICK_THRESHOLD_MS = 300

// Create empty image once to avoid re-creating on every drag
export const EMPTY_DRAG_IMAGE = new Image()
EMPTY_DRAG_IMAGE.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs="
