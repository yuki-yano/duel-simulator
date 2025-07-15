import { cn } from "@client/lib/utils"
import { Circle, Square, Play, Pause, Share2 } from "lucide-react"
import { Slider } from "@client/components/ui/slider"

interface ReplayControlsProps {
  // Recording state
  isRecording: boolean
  isDeckLoaded: boolean
  replayData: { operations: { timestamp: number }[]; startTime?: number } | null
  replayStartIndex: number | null
  operations: { timestamp: number }[]
  onStartRecording: () => void
  onStopRecording: () => void
  onConfirmRecording: () => void

  // Playback state
  isPlaying: boolean
  isPaused: boolean
  currentReplayIndex: number | null
  onPlayReplay: () => void
  onTogglePause: () => void
  onStopReplay: () => void

  // Settings
  replaySpeed: number
  replayStartDelay: number
  onReplaySpeedChange: (speed: number) => void
  onReplayStartDelayChange: (delay: number) => void

  // Share
  onShareReplay: () => void
}

export function ReplayControls({
  isRecording,
  isDeckLoaded,
  replayData,
  replayStartIndex,
  operations,
  onStartRecording,
  onStopRecording,
  onConfirmRecording,
  isPlaying,
  isPaused,
  currentReplayIndex,
  onPlayReplay,
  onTogglePause,
  onStopReplay,
  replaySpeed,
  replayStartDelay,
  onReplaySpeedChange,
  onReplayStartDelayChange,
  onShareReplay,
}: ReplayControlsProps) {
  return (
    <div className="mb-2 flex justify-start gap-2 flex-wrap" data-html2canvas-ignore="true">
      {!isPlaying && (
        <>
          {!isRecording ? (
            <button
              onClick={() => {
                if (replayData && replayData.operations.length > 0) {
                  // Show confirmation dialog if replay data already exists
                  onConfirmRecording()
                } else {
                  // Start recording directly if no replay data
                  onStartRecording()
                }
              }}
              disabled={!isDeckLoaded}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors text-xs sm:text-sm font-medium",
                isDeckLoaded
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-muted text-muted-foreground cursor-not-allowed",
              )}
              aria-label="Start recording"
            >
              <Circle className="w-4 h-4" />
              <span>リプレイ保存開始</span>
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  onStopRecording()
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors text-xs sm:text-sm font-medium bg-red-600 text-white hover:bg-red-700 animate-pulse"
                aria-label="Stop recording"
              >
                <Square className="w-4 h-4" />
                <span>保存停止</span>
              </button>
              <div className="flex items-center px-3 py-1.5 text-xs sm:text-sm font-medium text-muted-foreground">
                保存中: {operations.filter((op) => op.timestamp >= (replayData?.startTime ?? Date.now())).length} 操作
              </div>
            </>
          )}

          {/* Play replay button */}
          {replayData && replayData.operations.length > 0 && !isRecording && (
            <>
              <button
                onClick={() => onPlayReplay()}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors text-xs sm:text-sm font-medium bg-green-500 text-white hover:bg-green-600"
                aria-label="Play replay"
              >
                <Play className="w-4 h-4" />
                <span>リプレイ再生</span>
              </button>

              {/* Share replay button */}
              <button
                onClick={() => onShareReplay()}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors text-xs sm:text-sm font-medium bg-blue-500 text-white hover:bg-blue-600"
                aria-label="Share replay"
              >
                <Share2 className="w-4 h-4" />
                <span>共有</span>
              </button>
            </>
          )}
        </>
      )}

      {/* Replay playback controls for mobile when playing - moved up */}
      {isPlaying && (
        <div className="flex sm:hidden items-center gap-2 w-full">
          <button
            onClick={() => {
              if (isPaused) {
                onPlayReplay()
              } else {
                onTogglePause()
              }
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors text-xs font-medium bg-blue-500 text-white hover:bg-blue-600"
            aria-label={isPaused ? "Resume" : "Pause"}
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            <span>{isPaused ? "再開" : "一時停止"}</span>
          </button>
          <button
            onClick={() => onStopReplay()}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors text-xs font-medium bg-gray-500 text-white hover:bg-gray-600"
            aria-label="Stop replay"
          >
            <Square className="w-4 h-4" />
            <span>停止</span>
          </button>
          <div className="flex items-center px-3 py-1.5 text-xs font-medium text-muted-foreground">
            ステップ: {currentReplayIndex ?? 0} / {replayData?.operations.length ?? 0}
          </div>
        </div>
      )}

      {/* Replay controls on mobile - separate row - Always show */}
      <div className="w-full sm:hidden mt-2">
        <div className="flex flex-wrap gap-2">
          {/* Replay speed control */}
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs text-muted-foreground">速度:</span>
            <div className="flex-1 max-w-[120px]">
              <Slider
                value={[replaySpeed === 0.5 ? 0 : replaySpeed === 1 ? 1 : replaySpeed === 2 ? 2 : 3]}
                onValueChange={(value) => {
                  const speeds = [0.5, 1, 2, 3]
                  // Map slider values to array indices
                  const index = Math.round(value[0])
                  onReplaySpeedChange(speeds[Math.min(index, speeds.length - 1)])
                }}
                min={0}
                max={3}
                step={1}
                className="cursor-pointer"
              />
            </div>
            <span className="text-xs font-medium text-muted-foreground w-8">{replaySpeed}x</span>
          </div>

          {/* Start delay control */}
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs text-muted-foreground">待機:</span>
            <div className="flex-1 max-w-[120px]">
              <Slider
                value={[replayStartDelay]}
                onValueChange={(value) => {
                  // Snap to specific values: 0, 0.5, 1, 2, 3
                  const snapValues = [0, 0.5, 1, 2, 3]
                  const closest = snapValues.reduce((prev, curr) => {
                    return Math.abs(curr - value[0]) < Math.abs(prev - value[0]) ? curr : prev
                  })
                  onReplayStartDelayChange(closest)
                }}
                min={0}
                max={3}
                step={0.1}
                className="cursor-pointer"
              />
            </div>
            <span className="text-xs font-medium text-muted-foreground w-8">{replayStartDelay}秒</span>
          </div>
        </div>
      </div>

      {/* Replay controls on desktop - same row */}
      <div className="hidden sm:flex items-center gap-4">
        {/* Playback controls when playing */}
        {replayData && replayData.operations.length > 0 && !isRecording && isPlaying && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (isPaused) {
                  onPlayReplay()
                } else {
                  onTogglePause()
                }
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors text-sm font-medium bg-blue-500 text-white hover:bg-blue-600"
              aria-label={isPaused ? "Resume" : "Pause"}
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              <span>{isPaused ? "再開" : "一時停止"}</span>
            </button>
            <button
              onClick={() => onStopReplay()}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors text-sm font-medium bg-gray-500 text-white hover:bg-gray-600"
              aria-label="Stop replay"
            >
              <Square className="w-4 h-4" />
              <span>停止</span>
            </button>
            <div className="flex items-center px-3 py-1.5 text-sm font-medium text-muted-foreground">
              ステップ: {currentReplayIndex ?? 0} / {replayData?.operations.length ?? 0}
            </div>
          </div>
        )}

        {/* Replay speed control - Always show */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">速度:</span>
          <div className="w-24">
            <Slider
              value={[replaySpeed === 0.5 ? 0 : replaySpeed === 1 ? 1 : replaySpeed === 2 ? 2 : 3]}
              onValueChange={(value) => {
                const speeds = [0.5, 1, 2, 3]
                onReplaySpeedChange(speeds[value[0]])
              }}
              min={0}
              max={3}
              step={1}
              className="cursor-pointer"
            />
          </div>
          <span className="text-sm font-medium text-muted-foreground">{replaySpeed}x</span>
        </div>

        {/* Start delay control - Always show */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">待機:</span>
          <div className="w-24">
            <Slider
              value={[replayStartDelay]}
              onValueChange={(value) => {
                // Snap to specific values: 0, 0.5, 1, 2, 3
                const snapValues = [0, 0.5, 1, 2, 3]
                const closest = snapValues.reduce((prev, curr) => {
                  return Math.abs(curr - value[0]) < Math.abs(prev - value[0]) ? curr : prev
                })
                onReplayStartDelayChange(closest)
              }}
              min={0}
              max={3}
              step={0.1}
              className="cursor-pointer"
            />
          </div>
          <span className="text-sm font-medium text-muted-foreground">{replayStartDelay}秒</span>
        </div>
      </div>

      {/* Recording status */}
      {isRecording && (
        <div className="flex items-center px-3 py-1.5 text-xs sm:text-sm font-medium text-red-600">
          <Circle className="w-3 h-3 mr-1 animate-pulse fill-current" />
          録画中 (開始: ステップ {replayStartIndex !== null ? replayStartIndex : 0})
        </div>
      )}
    </div>
  )
}
