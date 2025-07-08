import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { Card, CardContent } from "@client/components/Card"
import { GameField } from "@client/components/GameField"
import { loadGameState, type GameState } from "@client/api/gameState"
import { getDeckImage } from "@client/api/deck"
import type { DeckProcessMetadata } from "@client/components/DeckImageProcessor"

export default function Replay() {
  const { id } = useParams<{ id: string }>()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deckMetadata, setDeckMetadata] = useState<DeckProcessMetadata | null>(null)
  const [processedCards, setProcessedCards] = useState<string[]>([])
  const [_gameState, setGameState] = useState<GameState | null>(null)

  useEffect(() => {
    if (id == null || id === "") {
      setError("リプレイIDが指定されていません")
      setIsLoading(false)
      return
    }

    void loadReplay()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const loadReplay = async () => {
    try {
      // Load saved state
      const savedState = await loadGameState(id ?? "")
      const deckData = await getDeckImage(savedState.deckImageHash)

      // Set deck metadata
      const metadata: DeckProcessMetadata = {
        imageDataUrl: deckData.imageDataUrl,
        aspectRatioType: deckData.aspectRatioType,
        mainDeckCount: deckData.mainDeckCount,
        extraDeckCount: deckData.extraDeckCount,
        sourceWidth: deckData.sourceWidth,
        sourceHeight: deckData.sourceHeight,
      }
      setDeckMetadata(metadata)

      // Parse and restore game state
      const state = JSON.parse(savedState.stateJson) as GameState
      setGameState(state)
      setProcessedCards(state.cards)

      setIsLoading(false)
    } catch (error) {
      console.error("Failed to load replay:", error)
      setError("リプレイの読み込みに失敗しました")
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">リプレイを読み込み中...</p>
        </div>
      </div>
    )
  }

  if (error !== null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 font-semibold">{error}</p>
          <a href="/" className="mt-4 inline-block text-blue-600 hover:underline">
            ホームに戻る
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-4 sm:py-8">
        <h1 className="text-2xl sm:text-4xl font-bold text-center mb-4 sm:mb-8">Duel Simulator - リプレイ</h1>

        {/* Replay Info */}
        <div className="max-w-7xl mx-auto mb-4 text-center text-sm text-gray-600">
          <p>
            リプレイID: <code className="px-2 py-1 bg-gray-100 rounded">{id}</code>
          </p>
        </div>

        {/* Game Field */}
        <Card className="max-w-7xl mx-auto">
          <CardContent>
            <GameField />
          </CardContent>
        </Card>

        {/* Processed Cards Display */}
        {processedCards.length > 0 && (
          <div className="max-w-7xl mx-auto mt-8 space-y-4">
            {/* Main Deck */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">メインデッキ</h3>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                {processedCards.slice(0, deckMetadata?.mainDeckCount ?? 40).map((card, index) => (
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
            {(deckMetadata?.extraDeckCount ?? 0) > 0 && (
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">EXデッキ</h3>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                  {processedCards.slice(-(deckMetadata?.extraDeckCount ?? 15)).map((card, index) => (
                    <img
                      key={index}
                      src={card}
                      alt={`Extra Deck Card ${index + 1}`}
                      className="w-full aspect-[59/86] rounded shadow-sm hover:shadow-lg transition-shadow cursor-pointer"
                    />
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
