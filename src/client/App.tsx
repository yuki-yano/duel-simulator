import { useState } from "react"
import { Card, CardContent } from "@client/components/Card"
import { GameField } from "@client/components/GameField"
import { DeckImageUploader } from "@client/components/DeckImageUploader"
import { DeckImageProcessor, type DeckProcessMetadata } from "@client/components/DeckImageProcessor"
import { saveGameState, type GameState } from "@client/api/gameState"

export default function App() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [processedCards, setProcessedCards] = useState<string[]>([])
  const [deckMetadata, setDeckMetadata] = useState<DeckProcessMetadata | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveId, setSaveId] = useState<string | null>(null)

  const handleImageUpload = (imageDataUrl: string) => {
    setUploadedImage(imageDataUrl)
  }

  const handleProcessComplete = (cards: string[], metadata: DeckProcessMetadata) => {
    setProcessedCards(cards)
    setDeckMetadata(metadata)
  }

  const handleSaveGame = async () => {
    if (!deckMetadata) {
      alert("デッキ画像を先に処理してください")
      return
    }

    setIsSaving(true)
    try {
      // TODO: Get actual game state from GameField
      const gameState: GameState = {
        cards: processedCards,
        field: {},
        turn: 1,
      }

      const result = await saveGameState(gameState, deckMetadata)
      setSaveId(result.id)
      const replayUrl = `${window.location.origin}/replay/${result.id}`
      alert(`ゲームを保存しました！\n\nリプレイURL:\n${replayUrl}`)
    } catch (error) {
      console.error("Failed to save game:", error)
      alert("保存に失敗しました")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-4 sm:py-8">
        <h1 className="text-2xl sm:text-4xl font-bold text-center mb-4 sm:mb-8">Duel Simulator</h1>

        {/* Image Upload Section */}
        {uploadedImage === null && (
          <div className="max-w-2xl mx-auto mb-8">
            <DeckImageUploader onImageUpload={handleImageUpload} />
          </div>
        )}

        {/* Image Processing Section */}
        {uploadedImage !== null && processedCards.length === 0 && (
          <div className="max-w-2xl mx-auto mb-8">
            <DeckImageProcessor imageDataUrl={uploadedImage} onProcessComplete={handleProcessComplete} />
          </div>
        )}

        {/* Game Controls */}
        {processedCards.length > 0 && (
          <div className="max-w-7xl mx-auto mb-4 flex gap-4 justify-center">
            <button
              onClick={handleSaveGame}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {isSaving ? "保存中..." : "ゲームを保存"}
            </button>
            {saveId !== null && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>リプレイURL:</span>
                <a
                  href={`/replay/${saveId}`}
                  className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 font-mono text-blue-600"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {window.location.origin}/replay/{saveId}
                </a>
              </div>
            )}
          </div>
        )}

        {/* Game Field */}
        <Card className="max-w-7xl mx-auto">
          <CardContent>
            <GameField />
          </CardContent>
        </Card>

        {/* Processed Cards Display (temporary) */}
        {processedCards.length > 0 && (
          <div className="max-w-7xl mx-auto mt-8 space-y-4">
            {/* Main Deck */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">メインデッキ</h3>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                {processedCards.slice(0, -15).map((card, index) => (
                  <img
                    key={index}
                    src={card}
                    alt={`Main Deck Card ${index + 1}`}
                    className="w-full aspect-[59/86] rounded shadow-sm hover:shadow-lg transition-shadow cursor-pointer"
                  />
                ))}
              </div>
            </Card>

            {/* Extra Deck */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">EXデッキ</h3>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                {processedCards.slice(-15).map((card, index) => (
                  <img
                    key={index}
                    src={card}
                    alt={`Extra Deck Card ${index + 1}`}
                    className="w-full aspect-[59/86] rounded shadow-sm hover:shadow-lg transition-shadow cursor-pointer"
                  />
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
