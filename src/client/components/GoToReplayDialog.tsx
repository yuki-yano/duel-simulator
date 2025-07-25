import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@client/components/ui/dialog"
import { loadGameState } from "@client/api/gameState"

interface GoToReplayDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function GoToReplayDialog({ isOpen, onOpenChange }: GoToReplayDialogProps) {
  const [replayId, setReplayId] = useState("")
  const [isChecking, setIsChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleGoToReplay = async () => {
    if (!replayId.trim()) {
      setError("リプレイIDを入力してください")
      return
    }

    setIsChecking(true)
    setError(null)

    try {
      // Check if replay exists
      await loadGameState(replayId.trim())

      // If successful, navigate to replay page
      void navigate(`/replay/${replayId.trim()}`)
      onOpenChange(false)
    } catch (e) {
      console.error("Failed to check replay:", e)
      setError("リプレイが見つかりません")
    } finally {
      setIsChecking(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isChecking) {
      void handleGoToReplay()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>リプレイを開く</DialogTitle>
          <DialogDescription>リプレイIDを入力して、保存されたリプレイを開きます。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label htmlFor="replayId" className="text-sm font-medium">
              リプレイID
            </label>
            <input
              id="replayId"
              type="text"
              value={replayId}
              onChange={(e) => {
                setReplayId(e.target.value)
                setError(null)
              }}
              onKeyPress={handleKeyPress}
              placeholder="例: xc3k2m9p"
              className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              autoFocus
              disabled={isChecking}
            />
            {error !== null && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2"
            disabled={isChecking}
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={() => void handleGoToReplay()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isChecking || !replayId.trim()}
          >
            {isChecking ? "確認中..." : "開く"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
