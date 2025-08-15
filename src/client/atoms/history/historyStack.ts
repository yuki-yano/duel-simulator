import { atom } from "jotai"
import type { Getter, Setter } from "../types"
import type { HistoryEntry } from "../types"
import { gameStateAtom } from "../core/gameState"
import { operationsAtom } from "../core/operations"
import { createInitialGameState } from "../helpers/stateHelpers"
import { HISTORY_LIMIT } from "../constants"
import { GameState } from "@/shared/types/game"

export const gameHistoryAtom = atom<HistoryEntry[]>([
  {
    gameState: createInitialGameState(),
    operationCount: 0,
    operations: [],
  },
])

export const gameHistoryIndexAtom = atom<number>(0)

export const addToHistory = (get: Getter, set: Setter, newState: GameState) => {
  const history = get(gameHistoryAtom)
  const currentIndex = get(gameHistoryIndexAtom)
  const operations = get(operationsAtom)

  // Create new history entry
  const newEntry: HistoryEntry = {
    gameState: newState,
    operationCount: operations.length,
    operations: [...operations], // Store a copy of operations
  }

  // Remove future history if we're in the middle of the history
  const newHistory = [...history.slice(0, currentIndex + 1), newEntry]

  // Limit history size to prevent memory issues
  const limitedHistory = newHistory.slice(-HISTORY_LIMIT)

  set(gameHistoryAtom, limitedHistory)
  set(gameHistoryIndexAtom, limitedHistory.length - 1)
}

// Set game state with history atom
export const setGameStateWithHistoryAtom = atom(null, (get, set, newState: GameState) => {
  set(gameStateAtom, newState)
  addToHistory(get, set, newState)
})

// Reset history with new initial state
export const resetHistoryAtom = atom(null, (get, set, newState: GameState) => {
  set(gameStateAtom, newState)
  set(gameHistoryAtom, [
    {
      gameState: newState,
      operationCount: 0,
      operations: [],
    },
  ])
  set(gameHistoryIndexAtom, 0)
  set(operationsAtom, []) // Clear operations as well
})
