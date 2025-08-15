import { atom } from "jotai"
import type { GameState, GamePhase } from "@/shared/types/game"
import { createInitialGameState } from "../helpers/stateHelpers"

// Main game state atom
export const gameStateAtom = atom<GameState>(createInitialGameState())

// Current game phase atom with setter
export const currentPhaseAtom = atom<GamePhase, [GamePhase], void>(
  (get) => get(gameStateAtom).phase,
  (get, set, newPhase: GamePhase) => {
    const state = get(gameStateAtom)
    const newState = {
      ...state,
      phase: newPhase,
    }
    set(gameStateAtom, newState)
    // Note: addToHistory is moved to historyStack.ts to avoid circular dependency
    // It should be imported and called from the component or operation atom
  },
)