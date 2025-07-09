import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { Card, CardContent } from "@client/components/Card"
import { GameField } from "@client/components/GameField"
import { loadGameState } from "@client/api/gameState"
import { getDeckImage, getDeckImageUrl } from "@client/api/deck"
import type { ReplaySaveData, DeckCardIdsMapping } from "@/shared/types/game"
import { useSetAtom } from "jotai"
import {
  replayDataAtom,
  gameStateAtom,
  deckMetadataAtom,
  playReplayAtom,
  stopReplayAtom,
} from "@/client/atoms/boardAtoms"
import { extractCardsFromDeckImage, restoreCardImages } from "@/client/utils/cardExtractor"
import type { DeckConfiguration } from "@/client/components/DeckImageProcessor"

export default function Replay() {
  const { id } = useParams<{ id: string }>()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState<string>("")
  const [description, setDescription] = useState<string>("")

  const setReplayData = useSetAtom(replayDataAtom)
  const setGameState = useSetAtom(gameStateAtom)
  const setDeckMetadata = useSetAtom(deckMetadataAtom)
  const playReplay = useSetAtom(playReplayAtom)
  const stopReplay = useSetAtom(stopReplayAtom)

  useEffect(() => {
    if (id == null || id === "") {
      setError("リプレイIDが指定されていません")
      setIsLoading(false)
      return
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let isCancelled = false

    const loadAndPlay = async () => {
      await loadReplay()
      if (!isCancelled) {
        timeoutId = setTimeout(() => {
          if (!isCancelled) {
            void playReplay()
          }
        }, 500)
      }
    }

    void loadAndPlay()

    // Cleanup function to cancel timeout and stop replay
    return () => {
      isCancelled = true
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      // Stop replay when leaving the page
      stopReplay()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const loadReplay = async () => {
    try {
      // Load saved state
      const savedState = await loadGameState(id ?? "")
      const deckData = await getDeckImage(savedState.deckImageHash)

      // Parse replay data
      const replaySaveData = JSON.parse(savedState.stateJson) as ReplaySaveData

      // Parse deck config
      const deckConfig = JSON.parse(savedState.deckConfig) as DeckConfiguration

      // Parse deck card IDs
      const deckCardIds = JSON.parse(savedState.deckCardIds) as DeckCardIdsMapping

      // Set title and description
      setTitle(savedState.title)
      setDescription(savedState.description ?? "")

      // Set deck metadata with deckCardIds
      const imageUrl = getDeckImageUrl(savedState.deckImageHash)
      const metadata = {
        imageDataUrl: deckData.imageDataUrl,
        imageUrl,
        deckConfig,
        mainDeckCount: deckData.mainDeckCount,
        extraDeckCount: deckData.extraDeckCount,
        sourceWidth: deckData.sourceWidth,
        sourceHeight: deckData.sourceHeight,
        deckCardIds: deckCardIds,
      }
      setDeckMetadata(metadata)

      // Extract card images from deck
      const cardImageMap = await extractCardsFromDeckImage(metadata, deckCardIds)

      // Restore card images to initial state
      restoreCardImages(replaySaveData.data.initialState, cardImageMap)

      // Set initial game state with restored images
      setGameState(replaySaveData.data.initialState)

      // Set replay data
      setReplayData({
        startSnapshot: replaySaveData.data.initialState,
        operations: replaySaveData.data.operations,
        startTime: Date.now(),
        endTime: Date.now() + replaySaveData.metadata.duration,
      })

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
        <div className="max-w-7xl mx-auto mb-4 text-center">
          {title !== "" && <h2 className="text-xl font-semibold mb-2">{title}</h2>}
          {description !== "" && <p className="text-gray-600 mb-2">{description}</p>}
          <p className="text-sm text-gray-500">
            リプレイID: <code className="px-2 py-1 bg-gray-100 rounded">{id}</code>
          </p>
        </div>

        {/* Game Field */}
        <Card className="max-w-7xl mx-auto">
          <CardContent>
            <GameField />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
