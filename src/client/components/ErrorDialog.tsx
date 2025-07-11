import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog"
import { AlertCircle } from "lucide-react"

interface ErrorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  message: string
  details?: string
  actionLabel?: string
  actionHref?: string
}

export function ErrorDialog({
  open,
  onOpenChange,
  title,
  message,
  details,
  actionLabel = "ホームに戻る",
  actionHref = "/",
}: ErrorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-4">
            {/* Error Icon */}
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <DialogTitle>{title}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <DialogDescription className="text-base">{message}</DialogDescription>

          {/* Details (optional) */}
          {details != null && (
            <div className="bg-gray-50 rounded p-3">
              <p className="text-sm text-gray-500 font-mono">{details}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <button
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-gray-100 hover:bg-gray-200 h-10 px-4 py-2"
          >
            閉じる
          </button>
          <button
            onClick={() => (window.location.href = actionHref)}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
          >
            {actionLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
