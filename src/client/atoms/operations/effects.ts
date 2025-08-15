import { atom } from "jotai"
import type { GameOperation, Position } from "../../../shared/types/game"
import { gameStateAtom } from "../core/gameState"
import { operationsAtom } from "../core/operations"
import { performUpdateCounter } from "../helpers/stateHelpers"
import { v4 as uuidv4 } from "uuid"

import { addToHistory } from "../history/historyStack"
import { replayRecordingAtom, replayOperationsAtom } from "../replay/recording"

export const updateCounterAtom = atom(null, (get, set, position: Position, counterValue: number) => {
  const state = get(gameStateAtom)
  const newState = performUpdateCounter(state, position, counterValue)

  if (newState !== state) {
    // Create operation BEFORE adding to history
    const operation: GameOperation = {
      id: uuidv4(),
      timestamp: Date.now(),
      type: "updateCounter",
      cardId: position.cardId,
      to: {
        player: position.zone.player,
        zoneType: position.zone.type,
        zoneIndex: position.zone.index,
      },
      player: position.zone.player,
      metadata: { counter: counterValue },
    }

    // Update operations BEFORE history
    set(operationsAtom, [...get(operationsAtom), operation])

    // Then update game state and add to history
    set(gameStateAtom, newState)
    addToHistory(get, set, newState)

    // Also record to replay operations if recording
    if (get(replayRecordingAtom)) {
      set(replayOperationsAtom, [...get(replayOperationsAtom), operation])
    }
  }
})

// Note: toggleCardHighlightAtom has been moved to rotation.ts
// as it's more related to card state changes like rotation and flip