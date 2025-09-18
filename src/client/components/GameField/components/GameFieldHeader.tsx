import { ReplayControls } from "../ReplayControls"
import { ActionButtons } from "../ActionButtons"

import type { GameFieldController } from "../hooks/useGameFieldController"

type GameFieldHeaderProps = {
  controller: GameFieldController
}

export function GameFieldHeader({ controller }: GameFieldHeaderProps) {
  const {
    isReplayMode,
    hasEverPlayedInReplayMode,
    isRecording,
    isDeckLoaded,
    replayData,
    replayStartIndex,
    operations,
    startRecording,
    stopRecording,
    setShowRecordingConfirmDialog,
    isPlaying,
    isPaused,
    currentReplayIndex,
    playReplay,
    togglePause,
    stopReplay,
    replaySpeed,
    setReplaySpeed,
    replayStartDelay,
    setReplayStartDelay,
    setShowSaveReplayDialog,
    canUndo,
    canRedo,
    undoDescription,
    redoDescription,
    undo,
    redo,
    initialStateAfterDeckLoad,
    setShowResetConfirmDialog,
    mobileDefenseMode,
    setMobileDefenseMode,
    mobileFaceDownMode,
    setMobileFaceDownMode,
    mobileStackBottom,
    setMobileStackBottom,
    isTouchDevice,
  } = controller

  const shouldShowReplayControls = !isReplayMode || hasEverPlayedInReplayMode

  return (
    <>
      {shouldShowReplayControls && (
        <ReplayControls
          isRecording={isRecording}
          isDeckLoaded={isDeckLoaded}
          replayData={replayData}
          replayStartIndex={replayStartIndex}
          operations={operations}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          onConfirmRecording={() => setShowRecordingConfirmDialog(true)}
          isPlaying={isPlaying}
          isPaused={isPaused}
          currentReplayIndex={currentReplayIndex}
          onPlayReplay={() => {
            void playReplay()
          }}
          onTogglePause={togglePause}
          onStopReplay={stopReplay}
          replaySpeed={replaySpeed}
          replayStartDelay={replayStartDelay}
          onReplaySpeedChange={setReplaySpeed}
          onReplayStartDelayChange={setReplayStartDelay}
          onShareReplay={() => setShowSaveReplayDialog(true)}
        />
      )}

      <ActionButtons
        canUndo={canUndo}
        canRedo={canRedo}
        undoDescription={undoDescription}
        redoDescription={redoDescription}
        onUndo={undo}
        onRedo={redo}
        isDeckLoaded={isDeckLoaded}
        hasInitialState={!!initialStateAfterDeckLoad}
        onReset={() => setShowResetConfirmDialog(true)}
        isPlaying={isPlaying}
        isPaused={isPaused}
        currentReplayIndex={currentReplayIndex}
        mobileDefenseMode={mobileDefenseMode}
        mobileFaceDownMode={mobileFaceDownMode}
        mobileStackBottom={mobileStackBottom}
        onToggleDefenseMode={() => setMobileDefenseMode(!mobileDefenseMode)}
        onToggleFaceDownMode={() => setMobileFaceDownMode(!mobileFaceDownMode)}
        onToggleStackBottom={() => setMobileStackBottom(!mobileStackBottom)}
        isTouchDevice={isTouchDevice}
      />
    </>
  )
}
