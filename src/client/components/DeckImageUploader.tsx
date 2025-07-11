import { useState, useRef, ChangeEvent, DragEvent } from "react"
import { Card } from "@/client/components/ui/Card"
import { ErrorDialog } from "@/client/components/ErrorDialog"
import { Upload } from "lucide-react"

interface DeckImageUploaderProps {
  onImageUpload: (imageDataUrl: string) => void
}

export function DeckImageUploader({ onImageUpload }: DeckImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showError, setShowError] = useState(false)

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setShowError(true)
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result
      if (typeof result === "string") {
        onImageUpload(result)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (file != null) {
      handleFileSelect(file)
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <Card className="p-6">
      <div
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors duration-200
          ${isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

        <div className="space-y-4">
          <div className="flex justify-center">
            <Upload className="w-12 h-12 text-gray-400" />
          </div>
          <div>
            <p className="text-lg font-medium">デッキ画像をアップロード</p>
            <p className="text-sm text-gray-500 mt-1">クリックまたはドラッグ&ドロップ</p>
          </div>
          <p className="text-xs text-gray-400">遊戯王ニューロンからエクスポートした画像に対応</p>
        </div>
      </div>

      {/* Error Dialog */}
      <ErrorDialog
        open={showError}
        onOpenChange={setShowError}
        title="エラー"
        message="画像ファイルを選択してください"
        actionLabel="OK"
        actionHref="#"
      />
    </Card>
  )
}
