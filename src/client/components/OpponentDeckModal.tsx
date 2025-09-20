import { useState, useCallback, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/client/components/ui/dialog"
import { DeckImageProcessor, type DeckProcessMetadata } from "@/client/components/DeckImageProcessor"
import { useSetAtom } from "jotai"
import { setOpponentDeckAtom, opponentDeckMetadataAtom } from "@/client/atoms/opponentDeckAtom"
import { loadOpponentDeckToGameStateAtom } from "@/client/atoms/operations/gameActions"
import { Upload } from "lucide-react"
import { FILE_SIZE_LIMITS } from "@/client/constants/limits"
import { calculateImageHash, saveDeckImage } from "@/client/api/deck"

type OpponentDeckModalProps = {
  isOpen: boolean
  onClose: () => void
  onLoadSuccess?: () => void // 読み込み成功時のコールバック
}

export function OpponentDeckModal({ isOpen, onClose, onLoadSuccess }: OpponentDeckModalProps) {
  const { t } = useTranslation(["game", "ui", "common"])
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [deckProcessorKey, setDeckProcessorKey] = useState(0) // DeckImageProcessorを再マウントするためのkey
  const setOpponentDeck = useSetAtom(setOpponentDeckAtom)
  const loadOpponentDeckToGameState = useSetAtom(loadOpponentDeckToGameStateAtom)
  const setOpponentDeckMetadata = useSetAtom(opponentDeckMetadataAtom)

  // ファイル処理の共通ロジック
  const processFile = useCallback(
    (file: File) => {
      // ファイルサイズチェック（10MB制限）
      if (file.size > FILE_SIZE_LIMITS.MAX_IMAGE_SIZE) {
        alert(t("game:opponentDeck.fileSizeExceeded"))
        return
      }

      // ファイルタイプチェック
      if (!file.type.startsWith("image/")) {
        alert(t("game:opponentDeck.invalidFileType"))
        return
      }

      const reader = new FileReader()
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string
        if (dataUrl) {
          setImageDataUrl(dataUrl)
        }
      }
      reader.onerror = () => {
        alert(t("game:opponentDeck.fileReadError"))
      }
      reader.readAsDataURL(file)
    },
    [t],
  )

  // ファイル選択ハンドラー
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        processFile(file)
      }
    },
    [processFile],
  )

  // ドラッグイベントハンドラー
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // ドロップゾーン外に出た時のみドラッグ状態を解除
    if (e.currentTarget === e.target) {
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const files = Array.from(e.dataTransfer.files)
      const imageFile = files.find((file) => file.type.startsWith("image/"))

      if (imageFile) {
        processFile(imageFile)
      } else if (files.length > 0) {
        alert(t("game:opponentDeck.invalidFileType"))
      }
    },
    [processFile, t],
  )

  // デッキ処理完了ハンドラー
  const handleProcessComplete = useCallback(
    async (_cards: string[], metadata: DeckProcessMetadata) => {
      // 画像ハッシュを計算してR2に保存
      const imageHash = await calculateImageHash(metadata.imageDataUrl)

      try {
        await saveDeckImage({
          hash: imageHash,
          imageData: metadata.imageDataUrl,
          mainDeckCount: metadata.mainDeckCount,
          extraDeckCount: metadata.extraDeckCount,
          sourceWidth: metadata.sourceWidth,
          sourceHeight: metadata.sourceHeight,
          deckConfig: metadata.deckConfig, // deck configも保存
        })
      } catch (error) {
        console.error("Failed to save opponent deck image to R2:", error)
        // エラーがあっても処理を継続
      }

      // メタデータから直接カード配列を使用
      const mainDeck = metadata.mainDeckCards
      const extraDeck = metadata.extraDeckCards
      const sideDeck = metadata.sideDeckCards

      // Atomに保存（リプレイ用）
      setOpponentDeck({
        main: mainDeck,
        extra: extraDeck,
        side: sideDeck,
      })

      // メタデータを保存
      const opponentMetadata = {
        imageDataUrl: metadata.imageDataUrl,
        imageHash,
        mainDeckCount: metadata.mainDeckCount,
        extraDeckCount: metadata.extraDeckCount,
        sideDeckCount: metadata.sideDeckCount,
        sourceWidth: metadata.sourceWidth,
        sourceHeight: metadata.sourceHeight,
        deckCardIds: metadata.deckCardIds,
        deckConfig: metadata.deckConfig,
      }
      setOpponentDeckMetadata(opponentMetadata)

      // GameStateに反映（実際のゲームボード）
      loadOpponentDeckToGameState({
        mainDeck,
        extraDeck,
        sideDeck,
      })

      // 読み込み成功時のコールバックを実行
      if (onLoadSuccess) {
        onLoadSuccess()
      }

      // モーダルを閉じる
      onClose()
    },
    [setOpponentDeck, setOpponentDeckMetadata, loadOpponentDeckToGameState, onClose, onLoadSuccess],
  )

  // エラーハンドラー
  const handleError = useCallback(() => {
    // エラー時はimageDataUrlをリセット
    setImageDataUrl(null)
  }, [])

  // モーダルが開かれた時に状態をリセット
  useEffect(() => {
    if (isOpen) {
      setImageDataUrl(null)
      setIsDragging(false)
      // DeckImageProcessorを再マウントするためにkeyを更新
      setDeckProcessorKey((prev) => prev + 1)
    }
  }, [isOpen])

  // モーダルが閉じられたときのクリーンアップ
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setImageDataUrl(null)
        setIsDragging(false)
        onClose()
      }
    },
    [onClose],
  )

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("game:opponentDeck.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* ファイル選択・ドラッグ&ドロップ */}
          {imageDataUrl == null && (
            <div
              className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                transition-colors duration-200
                ${isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"}
              `}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => document.getElementById("opponent-deck-file-input")?.click()}
            >
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
                id="opponent-deck-file-input"
              />

              <div className="space-y-4">
                <div className="flex justify-center">
                  <Upload className="w-12 h-12 text-gray-400" />
                </div>
                <div>
                  <p className="text-lg font-medium">{t("game:opponentDeck.uploadTitle")}</p>
                  <p className="text-sm text-gray-500 mt-1">{t("game:opponentDeck.clickOrDrag")}</p>
                </div>
                <p className="text-xs text-gray-400">{t("game:opponentDeck.supportedFormats")}</p>
              </div>
            </div>
          )}

          {/* DeckImageProcessorを使用した処理 */}
          {imageDataUrl != null && (
            <DeckImageProcessor
              key={deckProcessorKey} // keyを追加して再マウントを強制
              imageDataUrl={imageDataUrl}
              onProcessComplete={handleProcessComplete}
              onError={handleError}
              isReplayMode={false}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
