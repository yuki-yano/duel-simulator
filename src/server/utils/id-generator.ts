import { customAlphabet } from "nanoid"

// Generate UUID v4
export function generateUUID(): string {
  return crypto.randomUUID()
}

// Generate 8-character ID for replays (avoiding confusing characters)
const nanoid = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz", 8)
export function generateReplayId(): string {
  return nanoid()
}
