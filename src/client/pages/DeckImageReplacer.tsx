import { useState, useRef } from "react"
import { Card, CardContent } from "@client/components/ui/Card"
import { Button } from "@client/components/ui/button"
import { DeckImageUploader } from "@client/components/DeckImageUploader"
import { DeckImageProcessor, type DeckProcessMetadata } from "@client/components/DeckImageProcessor"
import { Download, X, Upload } from "lucide-react"

type DeckType = "main" | "extra"
type CardPosition = {
  deckType: DeckType
  position: number
}

type ReplacementImage = {
  id: string
  imageUrl: string
  fileName: string
  positions: CardPosition[]
}

export default function DeckImageReplacer() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [processedCards, setProcessedCards] = useState<string[]>([])
  const [deckMetadata, setDeckMetadata] = useState<DeckProcessMetadata | null>(null)
  const [replacementImages, setReplacementImages] = useState<ReplacementImage[]>([])
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [selectedDeckType, setSelectedDeckType] = useState<DeckType>("main")
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = (imageDataUrl: string) => {
    setUploadedImage(imageDataUrl)
  }

  const handleProcessComplete = (cards: string[], metadata: DeckProcessMetadata) => {
    setProcessedCards(cards)
    setDeckMetadata(metadata)
  }

  const handleReplacementImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    handleFiles(files)

    // Clear the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const removeReplacementImage = (imageId: string) => {
    setReplacementImages((prev) => prev.filter((img) => img.id !== imageId))
    if (selectedImageId === imageId) {
      const remainingImages = replacementImages.filter((img) => img.id !== imageId)
      setSelectedImageId(remainingImages.length > 0 ? remainingImages[0].id : null)
    }
  }

  const updateImagePositions = (imageId: string, positions: CardPosition[]) => {
    setReplacementImages((prev) => prev.map((img) => (img.id === imageId ? { ...img, positions } : img)))
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFiles(files)
    }
  }

  const handleFiles = (files: FileList) => {
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return

      const reader = new FileReader()
      reader.onload = (e) => {
        const imageUrl = e.target?.result as string
        const newImage: ReplacementImage = {
          id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          imageUrl,
          fileName: file.name,
          positions: [],
        }
        setReplacementImages((prev) => [...prev, newImage])
        setSelectedImageId(newImage.id)
      }
      reader.readAsDataURL(file)
    })
  }

  const generateReplacedImage = async () => {
    if (uploadedImage === null || deckMetadata === null || replacementImages.length === 0) {
      return
    }

    // Check if any image has positions selected
    const hasPositions = replacementImages.some((img) => img.positions.length > 0)
    if (!hasPositions) {
      return
    }

    setIsGenerating(true)

    try {
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      // Load original deck image
      const originalImg = new Image()
      await new Promise<void>((resolve, reject) => {
        originalImg.onload = () => resolve()
        originalImg.onerror = () => reject(new Error("Failed to load original image"))
        originalImg.src = uploadedImage
      })

      // Set canvas size to match original image
      canvas.width = originalImg.width
      canvas.height = originalImg.height

      // Draw original image
      ctx.drawImage(originalImg, 0, 0)

      // Get deck configuration
      const { cardWidth, cardHeight, cardGap, leftMargin } = deckMetadata.deckConfig
      const cardsPerRow = 10

      // Layout ratios (from DeckImageProcessor)
      const LAYOUT_RATIOS = {
        textToCardsGap: 0.035,
        firstRowOffset: 0.002,
        rowGap: 0,
        cardHorizontalMargin: 0.002,
      }

      // Process each replacement image
      for (const replacementData of replacementImages) {
        if (replacementData.positions.length === 0) continue

        // Load replacement image
        const replacementImg = new Image()
        await new Promise<void>((resolve, reject) => {
          replacementImg.onload = () => resolve()
          replacementImg.onerror = () => reject(new Error("Failed to load replacement image"))
          replacementImg.src = replacementData.imageUrl
        })

        // Draw replacement image at selected positions
        for (const pos of replacementData.positions) {
          const deckSection =
            pos.deckType === "main" ? deckMetadata.deckConfig.mainDeck : deckMetadata.deckConfig.extraDeck

          if (!deckSection) continue

          const { yPosition } = deckSection
          const cardIndex = pos.position - 1 // Convert to 0-based index
          const row = Math.floor(cardIndex / cardsPerRow)
          const col = cardIndex % cardsPerRow

          const startY =
            yPosition +
            originalImg.width * LAYOUT_RATIOS.textToCardsGap +
            originalImg.width * LAYOUT_RATIOS.firstRowOffset
          const x = leftMargin + col * (cardWidth + cardGap)
          const y = startY + row * (cardHeight + originalImg.width * LAYOUT_RATIOS.rowGap)
          const horizontalMargin = originalImg.width * LAYOUT_RATIOS.cardHorizontalMargin

          // Calculate destination dimensions
          const maxWidth = cardWidth + horizontalMargin * 2
          const maxHeight = cardHeight

          // Calculate aspect ratios
          const srcAspect = replacementImg.width / replacementImg.height
          const destAspect = maxWidth / maxHeight

          let destWidth: number
          let destHeight: number
          let destX: number
          let destY: number

          // Fit entire image within the card bounds
          if (srcAspect > destAspect) {
            // Source is wider - fit to width
            destWidth = maxWidth
            destHeight = maxWidth / srcAspect
            destX = x - horizontalMargin
            destY = y + (maxHeight - destHeight) / 2
          } else {
            // Source is taller - fit to height
            destHeight = maxHeight
            destWidth = maxHeight * srcAspect
            destX = x - horizontalMargin + (maxWidth - destWidth) / 2
            destY = y
          }

          // Fill the card area with white background first
          ctx.fillStyle = "white"
          ctx.fillRect(x - horizontalMargin, y, maxWidth, maxHeight)

          // Draw replacement image at calculated position with entire image visible
          ctx.drawImage(
            replacementImg,
            0,
            0,
            replacementImg.width,
            replacementImg.height,
            destX,
            destY,
            destWidth,
            destHeight,
          )
        }
      }

      // Convert canvas to data URL
      const resultImage = canvas.toDataURL("image/png")
      setGeneratedImage(resultImage)
    } catch (error) {
      console.error("Failed to generate image:", error)
    } finally {
      setIsGenerating(false)
    }
  }

  const downloadImage = () => {
    if (generatedImage === null) return

    const link = document.createElement("a")
    link.download = "deck-replaced.png"
    link.href = generatedImage
    link.click()
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full py-4 sm:py-8">
        <div className="max-w-2xl mx-auto mb-8 px-4 sm:px-0">
          <div className="flex items-center">
            <Button asChild variant="outline" size="sm">
              <a href="/">
                <span className="sm:hidden">←</span>
                <span className="hidden sm:inline">← ホームに戻る</span>
              </a>
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold flex-1 text-center">Deck Image Replacer</h1>
            <div className="w-[32px] sm:w-[116px]"></div>
          </div>
        </div>

        {/* Image Upload Section */}
        {uploadedImage === null && (
          <div className="max-w-2xl mx-auto mb-4">
            <DeckImageUploader onImageUpload={handleImageUpload} />
          </div>
        )}

        {/* Image Processing Section */}
        {uploadedImage !== null && processedCards.length === 0 && (
          <div className="max-w-2xl mx-auto mb-4">
            <DeckImageProcessor
              imageDataUrl={uploadedImage}
              onProcessComplete={handleProcessComplete}
              onError={() => setUploadedImage(null)}
            />
          </div>
        )}

        {/* Deck Load Success Message */}
        {deckMetadata && (
          <div className="max-w-2xl mx-auto mb-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-green-800">デッキ画像の読み込みが完了しました</p>
                  <p className="text-xs text-green-600 mt-1">
                    メインデッキ: {deckMetadata.mainDeckCount}枚
                    {deckMetadata.extraDeckCount > 0 && (
                      <span className="ml-2">EXデッキ: {deckMetadata.extraDeckCount}枚</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Replacement Image Upload */}
          <Card className={deckMetadata === null ? "opacity-50" : ""}>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4">置換画像のアップロード</h2>
              <div className="space-y-4">
                <div>
                  <input
                    ref={fileInputRef}
                    id="replacement-image"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleReplacementImageUpload}
                    className="hidden"
                    disabled={deckMetadata === null}
                  />
                  <div
                    onClick={() => deckMetadata !== null && fileInputRef.current?.click()}
                    onDragOver={deckMetadata !== null ? handleDragOver : undefined}
                    onDragLeave={deckMetadata !== null ? handleDragLeave : undefined}
                    onDrop={deckMetadata !== null ? handleDrop : undefined}
                    className={`
                      w-full py-12 px-4 border-2 border-dashed rounded-lg
                      flex flex-col items-center justify-center gap-3
                      transition-colors
                      ${
                        deckMetadata === null
                          ? "border-gray-200 bg-gray-50 cursor-not-allowed"
                          : isDragging
                            ? "border-blue-500 bg-blue-50 cursor-pointer"
                            : "border-gray-300 hover:border-gray-400 hover:bg-gray-50 cursor-pointer"
                      }
                    `}
                  >
                    <Upload className={`w-8 h-8 ${deckMetadata === null ? "text-gray-300" : "text-gray-400"}`} />
                    <div className="text-center">
                      <p className={`text-sm font-medium ${deckMetadata === null ? "text-gray-400" : "text-gray-700"}`}>
                        {deckMetadata === null
                          ? "デッキ画像を先に読み込んでください"
                          : "クリックして画像を選択（複数対応）"}
                      </p>
                      {deckMetadata !== null && <p className="text-xs text-gray-500">またはドラッグ&ドロップ</p>}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Position Selection */}
          <Card className={deckMetadata === null ? "opacity-50" : ""}>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4">置換位置の選択</h2>

              {/* Show placeholder when deck not loaded */}
              {deckMetadata === null ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-gray-400">デッキ画像を読み込むと、ここで置換位置を選択できます</p>
                </div>
              ) : (
                <>
                  {/* Uploaded Images List - moved here for image selection */}
                  {replacementImages.length > 0 ? (
                    <div className="flex gap-2 flex-wrap mb-4">
                      {replacementImages.map((img) => (
                        <div
                          key={img.id}
                          onClick={() => setSelectedImageId(img.id)}
                          onTouchStart={(e) => {
                            e.preventDefault()
                            setSelectedImageId(img.id)
                          }}
                          className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                            selectedImageId === img.id
                              ? "border-blue-500 ring-2 ring-blue-200"
                              : "border-gray-300 hover:border-gray-400"
                          }`}
                        >
                          <div className="w-20 aspect-[59/86] bg-gray-100">
                            <img src={img.imageUrl} alt="" className="w-full h-full object-contain" />
                          </div>
                          {img.positions.length > 0 && (
                            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs text-center py-1">
                              {img.positions.length}箇所
                            </div>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              removeReplacementImage(img.id)
                            }}
                            className="absolute top-1 right-1 p-1 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mb-4 p-4 border-2 border-dashed border-gray-300 rounded-lg text-center">
                      <p className="text-sm text-gray-500">置換画像をアップロードしてください</p>
                    </div>
                  )}

                  {/* Deck Count Information */}
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">
                      メインデッキ: {deckMetadata.mainDeckCount}枚
                      {deckMetadata.extraDeckCount > 0 && (
                        <span className="ml-4">EXデッキ: {deckMetadata.extraDeckCount}枚</span>
                      )}
                    </p>
                  </div>

                  {/* Deck Type Selection and Position Grid - Only show when image is selected */}
                  {selectedImageId !== null && (
                    <>
                      <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">デッキタイプ</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSelectedDeckType("main")}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                              selectedDeckType === "main"
                                ? "bg-blue-500 text-white hover:bg-blue-600"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                          >
                            メインデッキ
                          </button>
                          {deckMetadata.extraDeckCount > 0 && (
                            <button
                              onClick={() => setSelectedDeckType("extra")}
                              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                selectedDeckType === "extra"
                                  ? "bg-blue-500 text-white hover:bg-blue-600"
                                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                              }`}
                            >
                              EXデッキ
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Position Grid */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          置換位置を選択（複数選択可）
                        </label>
                        <div className="grid grid-cols-10 gap-1">
                          {Array.from({
                            length:
                              selectedDeckType === "main" ? deckMetadata.mainDeckCount : deckMetadata.extraDeckCount,
                          }).map((_, index) => {
                            const position = index + 1
                            const selectedImage = replacementImages.find((img) => img.id === selectedImageId)
                            const isSelected =
                              selectedImage?.positions.some(
                                (p) => p.deckType === selectedDeckType && p.position === position,
                              ) ?? false

                            // Check if this position is occupied by another image
                            const occupiedByOther = replacementImages.some(
                              (img) =>
                                img.id !== selectedImageId &&
                                img.positions.some((p) => p.deckType === selectedDeckType && p.position === position),
                            )

                            const disabled = occupiedByOther

                            return (
                              <button
                                key={`${selectedDeckType}-${position}`}
                                onClick={() => {
                                  if (!selectedImage || disabled) return
                                  const newPositions = isSelected
                                    ? selectedImage.positions.filter(
                                        (p) => !(p.deckType === selectedDeckType && p.position === position),
                                      )
                                    : [...selectedImage.positions, { deckType: selectedDeckType, position }]
                                  updateImagePositions(selectedImageId, newPositions)
                                }}
                                disabled={disabled}
                                className={`aspect-[59/86] rounded text-xs font-medium transition-colors relative overflow-hidden ${
                                  isSelected
                                    ? "border-2 border-blue-500 bg-blue-50"
                                    : disabled
                                      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                      : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                                }`}
                              >
                                {occupiedByOther ? (
                                  (() => {
                                    const occupyingImage = replacementImages.find(
                                      (img) =>
                                        img.id !== selectedImageId &&
                                        img.positions.some(
                                          (p) => p.deckType === selectedDeckType && p.position === position,
                                        ),
                                    )
                                    return occupyingImage ? (
                                      <img
                                        src={occupyingImage.imageUrl}
                                        alt=""
                                        className="absolute inset-0 w-full h-full object-contain opacity-50"
                                      />
                                    ) : null
                                  })()
                                ) : isSelected && selectedImage ? (
                                  <img
                                    src={selectedImage.imageUrl}
                                    alt=""
                                    className="absolute inset-0 w-full h-full object-contain opacity-80"
                                  />
                                ) : null}
                                <span className={`relative z-10 ${isSelected ? "text-blue-700 font-bold" : ""}`}>
                                  {position}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                        {(() => {
                          const selectedImage = replacementImages.find((img) => img.id === selectedImageId)
                          return selectedImage && selectedImage.positions.length > 0 ? (
                            <p className="text-sm text-gray-600 mt-2">選択中: {selectedImage.positions.length}箇所</p>
                          ) : null
                        })()}
                      </div>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Generate Button */}
          {replacementImages.some((img) => img.positions.length > 0) && (
            <Card>
              <CardContent className="p-6">
                <button
                  onClick={() => void generateReplacedImage()}
                  disabled={isGenerating}
                  className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? "生成中..." : "画像を生成"}
                </button>
              </CardContent>
            </Card>
          )}

          {/* Generated Image Result */}
          {generatedImage !== null && (
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-4">生成結果</h2>
                <div className="space-y-4">
                  <div className="border rounded-lg overflow-hidden">
                    <img src={generatedImage} alt="生成されたデッキ画像" className="w-full h-auto" />
                  </div>
                  <Button onClick={downloadImage} className="w-full flex items-center justify-center gap-2">
                    <Download className="w-4 h-4" />
                    画像をダウンロード
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Hidden canvas for image processing */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  )
}
