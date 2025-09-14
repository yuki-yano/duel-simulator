import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@client/components/ui/dialog"
import { useTranslation } from "react-i18next"

type ShareUrlDisplayProps = {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  shareUrl: string
  shareTitle: string
  onClose: () => void
}

export function ShareUrlDisplay({ isOpen, onOpenChange, shareUrl, shareTitle, onClose }: ShareUrlDisplayProps) {
  const [copied, setCopied] = useState(false)
  const { t } = useTranslation("ui")

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error("Failed to copy:", error)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("shareUrl.replaySaved")}</DialogTitle>
          <DialogDescription>{t("shareUrl.shareDescription")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={shareUrl}
              readOnly
              className="flex-1 h-10 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm"
              onClick={(e) => e.currentTarget.select()}
            />
            <button
              onClick={handleCopy}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2"
            >
              {copied ? t("shareUrl.copied") : t("shareUrl.copy")}
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const text = encodeURIComponent(
                  `Duel Simulatorでリプレイを共有しました\n${shareTitle} ${shareUrl}\n#DuelSimulator\n`,
                )
                window.open(`https://x.com/intent/tweet?text=${text}`, "_blank", "noopener,noreferrer")
              }}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-black text-white hover:bg-gray-800 h-10 px-4 py-2"
            >
              {t("shareUrl.postToX")}
            </button>
            <button
              onClick={() => window.open(shareUrl, "_blank", "noopener,noreferrer")}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-gray-600 text-white hover:bg-gray-700 h-10 px-4 py-2"
            >
              {t("shareUrl.openReplay")}
            </button>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-gray-300 bg-white hover:bg-gray-100 h-10 px-4 py-2"
          >
            {t("shareUrl.close")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
