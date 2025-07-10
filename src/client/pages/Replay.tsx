import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { Card, CardContent } from "@client/components/Card"
import { GameField } from "@client/components/GameField"
import { loadGameState } from "@client/api/gameState"
import { getDeckImage, getDeckImageUrl } from "@client/api/deck"
import type { ReplaySaveData, DeckCardIdsMapping } from "@/shared/types/game"
import { DeckImageProcessor } from "@client/components/DeckImageProcessor"
import { AutoPlayDialog } from "@client/components/AutoPlayDialog"
import { ErrorDialog } from "@client/components/ErrorDialog"
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
import { ReplaySaveDataSchema, DeckConfigurationSchema, DeckCardIdsMappingSchema } from "@/client/schemas/replay"
import { z } from "zod"

export default function Replay() {
  const { id } = useParams<{ id: string }>()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorDetails, setErrorDetails] = useState<string | null>(null)
  const [showErrorDialog, setShowErrorDialog] = useState(false)
  const [title, setTitle] = useState<string>("")
  const [description, setDescription] = useState<string>("")
  const [showDeckProcessor, setShowDeckProcessor] = useState(false)
  const [deckImage, setDeckImage] = useState<string | null>(null)
  const [showAutoPlayDialog, setShowAutoPlayDialog] = useState(false)

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

    void loadReplay()

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
      let savedState
      try {
        savedState = await loadGameState(id ?? "")
      } catch (e) {
        // Handle API errors (404, network errors, etc)
        throw new Error("リプレイが見つかりません")
      }
      
      const deckData = await getDeckImage(savedState.deckImageHash)

      // Parse and validate replay data with Zod
      let replaySaveData: ReplaySaveData
      try {
        const parsedData = JSON.parse(savedState.stateJson)
        
        // Check version before full validation
        if (parsedData.version && parsedData.version !== "1.0") {
          console.warn(`Unknown replay version: ${parsedData.version}`)
        }
        
        const validationResult = ReplaySaveDataSchema.safeParse(parsedData)
        
        if (!validationResult.success) {
          const errors = validationResult.error.format()
          console.error("Replay validation errors:", errors)
          
          // Check for specific missing fields to provide better error messages
          if (errors.data?.deckCardIds) {
            throw new Error("古い形式のリプレイです（カードIDマッピングが不足）")
          }
          if (errors.data?.initialState) {
            throw new Error("古い形式のリプレイです（初期状態データが不正）")
          }
          if (errors.data?.operations) {
            throw new Error("古い形式のリプレイです（操作履歴が不正）")
          }
          throw new Error("リプレイデータの形式が不正です")
        }
        
        replaySaveData = validationResult.data as ReplaySaveData
      } catch (e) {
        if (e instanceof Error && e.message.includes("古い形式")) {
          throw e
        }
        throw new Error("リプレイデータの解析に失敗しました")
      }

      // Parse and validate deck config
      let deckConfig: DeckConfiguration
      try {
        const parsedConfig = JSON.parse(savedState.deckConfig)
        const validationResult = DeckConfigurationSchema.safeParse(parsedConfig)
        
        if (!validationResult.success) {
          console.error("Deck config validation errors:", validationResult.error.format())
          throw new Error("デッキ設定の形式が不正です")
        }
        
        deckConfig = validationResult.data
      } catch (e) {
        if (e instanceof Error && e.message.includes("形式が不正")) {
          throw e
        }
        throw new Error("デッキ設定の解析に失敗しました")
      }

      // Parse and validate deck card IDs
      let deckCardIds: DeckCardIdsMapping
      try {
        const parsedIds = JSON.parse(savedState.deckCardIds)
        const validationResult = DeckCardIdsMappingSchema.safeParse(parsedIds)
        
        if (!validationResult.success) {
          console.error("Deck card IDs validation errors:", validationResult.error.format())
          throw new Error("カードIDマッピングの形式が不正です")
        }
        
        deckCardIds = validationResult.data as DeckCardIdsMapping
      } catch (e) {
        if (e instanceof Error && e.message.includes("形式が不正")) {
          throw e
        }
        throw new Error("カードIDマッピングの解析に失敗しました")
      }

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

      // Set deck image for display
      setDeckImage(deckData.imageDataUrl)
      setShowDeckProcessor(true)
      setIsLoading(false)
    } catch (error) {
      console.error("Failed to load replay:", error)
      
      // Check if it's a format compatibility issue
      let errorMessage = "リプレイの読み込みに失敗しました"
      let errorDetail = null
      
      if (error instanceof Error) {
        errorDetail = error.message
        
        // Check for specific error patterns that indicate format issues
        if (error.message.includes("Cannot read properties") || 
            error.message.includes("undefined") ||
            error.message.includes("JSON") ||
            error.message.includes("parse")) {
          errorMessage = "リプレイ形式に互換性がありません"
          errorDetail = "このリプレイは古い形式で保存されており、現在のバージョンでは再生できません。"
        }
      }
      
      setError(errorMessage)
      setErrorDetails(errorDetail)
      setShowErrorDialog(true)
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

  // Handle deck process complete (dummy handler for replay mode)
  const handleProcessComplete = () => {
    // Processing is already done, this is just for UI consistency
  }

  // Handle replay start
  const handleReplayStart = () => {
    // First show the game field
    setShowDeckProcessor(false)
    // Show auto play dialog
    setShowAutoPlayDialog(true)
  }

  // Handle auto play start
  const handleAutoPlayStart = () => {
    setShowAutoPlayDialog(false)
    void playReplay()
  }

  // Handle auto play cancel
  const handleAutoPlayCancel = () => {
    setShowAutoPlayDialog(false)
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

        {/* Deck Image Processor for replay mode */}
        {showDeckProcessor && deckImage && (
          <div className="max-w-2xl mx-auto mb-8">
            <DeckImageProcessor 
              imageDataUrl={deckImage} 
              onProcessComplete={handleProcessComplete}
              isReplayMode={true}
              onReplayStart={handleReplayStart}
            />
          </div>
        )}

        {/* Game Field */}
        {!showDeckProcessor && (
          <Card className="max-w-7xl mx-auto">
            <CardContent>
              <GameField />
            </CardContent>
          </Card>
        )}

        {/* Auto Play Dialog */}
        {showAutoPlayDialog && (
          <AutoPlayDialog
            onStart={handleAutoPlayStart}
            onCancel={handleAutoPlayCancel}
            countdown={3}
          />
        )}

        {/* Error Dialog */}
        <ErrorDialog
          open={showErrorDialog}
          onOpenChange={setShowErrorDialog}
          title="エラー"
          message={error ?? ""}
          details={errorDetails ?? undefined}
        />
      </div>
    </div>
  )
}
