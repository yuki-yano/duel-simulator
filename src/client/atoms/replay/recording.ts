import { atom } from "jotai"
import { produce } from "immer"
import type { ReplayData } from "../types"
import type { GameOperation } from "../../../shared/types/game"
import { gameStateAtom } from "../core/gameState"
import { operationsAtom } from "../core/operations"
import { gameHistoryIndexAtom } from "../history/historyStack"

// Replay recording state atoms
export const replayRecordingAtom = atom<boolean>(false)
export const replayStartIndexAtom = atom<number | null>(null)
export const replayEndIndexAtom = atom<number | null>(null)
export const replayDataAtom = atom<ReplayData | null>(null)
export const replayOperationsAtom = atom<GameOperation[]>([])
export const replayStartTimestampAtom = atom<number | null>(null)

// Start replay recording
export const startReplayRecordingAtom = atom(null, (get, set) => {
  const _currentIndex = get(gameHistoryIndexAtom)
  const currentState = get(gameStateAtom)
  const currentOperations = get(operationsAtom)

  // Create deep copy of current state as snapshot
  const snapshot = produce(currentState, () => {})

  // Initialize replay data
  const replayData: ReplayData = {
    startSnapshot: snapshot,
    operations: [],
    startTime: Date.now(),
  }

  set(replayRecordingAtom, true)
  set(replayStartIndexAtom, currentOperations.length) // Store operation count at start
  set(replayEndIndexAtom, null)
  set(replayDataAtom, replayData)
  set(replayOperationsAtom, []) // Clear replay operations
  set(replayStartTimestampAtom, Date.now()) // Record start timestamp
})

// Stop replay recording
export const stopReplayRecordingAtom = atom(null, (get, set) => {
  const _currentIndex = get(gameHistoryIndexAtom)
  const replayData = get(replayDataAtom)

  if (replayData) {
    // Use replay-specific operations list instead of global operations
    const replayOperations = get(replayOperationsAtom)

    // Update replay data with operations and end time
    set(replayDataAtom, {
      ...replayData,
      operations: replayOperations,
      endTime: Date.now(),
    })
  }

  set(replayRecordingAtom, false)
  set(replayEndIndexAtom, _currentIndex)
  set(replayOperationsAtom, []) // Clear replay operations
  set(replayStartTimestampAtom, null) // Clear start timestamp
})