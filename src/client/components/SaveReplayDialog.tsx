import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@client/components/ui/dialog"
import { Loader2 } from "lucide-react"
import type { ReplayData } from "@client/atoms/boardAtoms"

interface SaveReplayDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  replayData: ReplayData
  onSave: (title: string, description?: string) => void
  onCancel: () => void
  isLoading?: boolean
}

export function SaveReplayDialog({ isOpen, onOpenChange, replayData, onSave, onCancel, isLoading = false }: SaveReplayDialogProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")

  const duration = replayData.endTime !== undefined ? Math.floor((replayData.endTime - replayData.startTime) / 1000) : 0
  const operationCount = replayData.operations.length

  const handleSave = () => {
    if (title.trim() && !isLoading) {
      onSave(title.trim(), description.trim() || undefined)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>リプレイの保存</DialogTitle>
          <DialogDescription>リプレイを保存して、他の人と共有できます。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label htmlFor="title" className="text-sm font-medium">
              タイトル <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder=""
              className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="description" className="text-sm font-medium">
              説明（オプション）
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="リプレイの説明を入力..."
              rows={3}
              className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="text-sm text-gray-600">
            <p>リプレイの長さ: {duration}秒</p>
            <p>操作数: {operationCount}回</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-gray-300 bg-white hover:bg-gray-100 h-10 px-4 py-2"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || isLoading}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2 disabled:bg-gray-300"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                保存中...
              </>
            ) : (
              "保存"
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
