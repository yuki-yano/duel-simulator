import { atom } from "jotai"
import type { GameOperation, Position } from "../../../shared/types/game"
import { gameStateAtom } from "../core/gameState"
import { operationsAtom } from "../core/operations"
import { selectedCardAtom } from "../ui/selection"
import { performCardMove } from "../helpers/stateHelpers"
import { v4 as uuidv4 } from "uuid"

import { addToHistory } from "../history/historyStack"
import { replayRecordingAtom, replayOperationsAtom } from "../replay/recording"

export const moveCardAtom = atom(
  null,
  (
    get,
    set,
    from: Position,
    to: Position,
    options?: {
      shiftKey?: boolean
      defenseMode?: boolean
      faceDownMode?: boolean
      stackPosition?: "top" | "bottom"
      preventSameZoneReorder?: boolean
    },
  ) => {
    const state = get(gameStateAtom)
    const newState = performCardMove(state, from, to, options)

    // Always record operations and update state, even for same-zone moves
    // This ensures undo/redo and replay work correctly
    const stateChanged = JSON.stringify(state) !== JSON.stringify(newState)

    if (stateChanged) {
      // Record operation with new structure BEFORE adding to history
      const operation: GameOperation = {
        id: uuidv4(),
        timestamp: Date.now(),
        type: "move",
        cardId: from.cardId,
        from: {
          player: from.zone.player,
          zoneType: from.zone.type,
          zoneIndex: from.zone.index,
        },
        to: {
          player: to.zone.player,
          zoneType: to.zone.type,
          zoneIndex: to.zone.index,
          insertPosition: to.zone.index, // Use the zone index as insert position
        },
        player: from.zone.player,
        metadata: options,
      }

      // Update operations BEFORE history
      set(operationsAtom, [...get(operationsAtom), operation])

      // Then update game state and add to history
      set(gameStateAtom, newState)
      addToHistory(get, set, newState)

      // Also record to replay operations if recording
      if (get(replayRecordingAtom)) {
        const currentReplayOps = get(replayOperationsAtom)
        set(replayOperationsAtom, [...currentReplayOps, operation])
      }

      // Clear selected card after move to prevent UI issues
      set(selectedCardAtom, null)
    }
  },
)
