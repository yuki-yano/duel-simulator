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
import { useSetAtom, useAtomValue } from "jotai"
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
  const [replayDataError, setReplayDataError] = useState<string | null>(null)
  const [savedStateData, setSavedStateData] = useState<any>(null)
  const [isFatalError, setIsFatalError] = useState(false)

  const setReplayData = useSetAtom(replayDataAtom)
  const setGameState = useSetAtom(gameStateAtom)
  const setDeckMetadata = useSetAtom(deckMetadataAtom)
  const playReplay = useSetAtom(playReplayAtom)
  const stopReplay = useSetAtom(stopReplayAtom)
  const deckMetadata = useAtomValue(deckMetadataAtom)

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
        setIsFatalError(true)
        throw new Error("リプレイが見つかりません")
      }
      
      // Store saved state for later use
      setSavedStateData(savedState)
      
      const deckData = await getDeckImage(savedState.deckImageHash)

      // Don't parse replay data here - we'll do it when starting replay
      // This allows deck to be displayed even if replay data is invalid

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

      // Try to extract cards from deck for initial setup
      try {
        const cardImageMap = await extractCardsFromDeckImage(metadata, deckCardIds)
        
        // Create initial state with deck cards
        const mainDeckCards = Object.entries(cardImageMap)
          .filter(([id]) => id.startsWith('main-'))
          .map(([id, imageUrl]) => ({
            id,
            name: `Card ${id}`,
            imageUrl,
            position: "facedown" as const,
            rotation: 0,
            faceDown: true,
          }))
        
        const extraDeckCards = Object.entries(cardImageMap)
          .filter(([id]) => id.startsWith('extra-'))
          .map(([id, imageUrl]) => ({
            id,
            name: `Card ${id}`,
            imageUrl,
            position: "facedown" as const,
            rotation: 0,
            faceDown: true,
          }))
        
        // Set initial game state with cards in deck
        setGameState({
          players: {
            self: {
              monsterZones: Array(5).fill(null).map(() => []),
              spellTrapZones: Array(5).fill(null).map(() => []),
              fieldZone: null,
              graveyard: [],
              banished: [],
              extraDeck: extraDeckCards,
              deck: mainDeckCards,
              hand: [],
              extraMonsterZones: Array(2).fill(null).map(() => []),
              lifePoints: 8000,
            },
            opponent: {
              monsterZones: Array(5).fill(null).map(() => []),
              spellTrapZones: Array(5).fill(null).map(() => []),
              fieldZone: null,
              graveyard: [],
              banished: [],
              extraDeck: [],
              deck: [],
              hand: [],
              extraMonsterZones: Array(2).fill(null).map(() => []),
              lifePoints: 8000,
            },
          },
          turn: 1,
          phase: "main1",
          currentPlayer: "self",
        })
      } catch (e) {
        console.error("Failed to setup initial state:", e)
        // Set empty state as fallback
        setGameState({
          players: {
            self: {
              monsterZones: Array(5).fill(null).map(() => []),
              spellTrapZones: Array(5).fill(null).map(() => []),
              fieldZone: null,
              graveyard: [],
              banished: [],
              extraDeck: [],
              deck: [],
              hand: [],
              extraMonsterZones: Array(2).fill(null).map(() => []),
              lifePoints: 8000,
            },
            opponent: {
              monsterZones: Array(5).fill(null).map(() => []),
              spellTrapZones: Array(5).fill(null).map(() => []),
              fieldZone: null,
              graveyard: [],
              banished: [],
              extraDeck: [],
              deck: [],
              hand: [],
              extraMonsterZones: Array(2).fill(null).map(() => []),
              lifePoints: 8000,
            },
          },
          turn: 1,
          phase: "main1",
          currentPlayer: "self",
        })
      }

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
      setIsLoading(false)
      
      // If it's not a fatal error, show dialog after page loads
      if (!isFatalError) {
        setTimeout(() => setShowErrorDialog(true), 100)
      }
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

  // Only show full-screen error for fatal errors (404, etc)
  if (isFatalError && error !== null) {
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
  const handleReplayStart = async () => {
    // First validate replay data
    if (!savedStateData) {
      setError("リプレイデータが利用できません")
      setShowErrorDialog(true)
      return
    }
    
    try {
      const parsedData = JSON.parse(savedStateData.stateJson)
      const validationResult = ReplaySaveDataSchema.safeParse(parsedData)
      
      if (!validationResult.success) {
        const errors = validationResult.error.format()
        console.error("Replay validation errors:", errors)
        
        let errorMessage = "リプレイデータの形式が不正です"
        if (errors.data?.deckCardIds) {
          errorMessage = "古い形式のリプレイです（カードIDマッピングが不足）"
        } else if (errors.data?.initialState) {
          errorMessage = "古い形式のリプレイです（初期状態データが不正）"
        } else if (errors.data?.operations) {
          errorMessage = "古い形式のリプレイです（操作履歴が不正）"
        }
        
        // Show error but still allow normal gameplay
        setError(errorMessage)
        setErrorDetails("このリプレイは現在のバージョンで再生できません。通常のデュエルは可能です。")
        setShowErrorDialog(true)
        
        // Still show the game field for normal play
        setShowDeckProcessor(false)
        return
      }
      
      // Valid replay data - proceed with auto play dialog
      setShowDeckProcessor(false)
      setShowAutoPlayDialog(true)
    } catch (e) {
      console.error("Failed to validate replay:", e)
      setError("リプレイデータの検証に失敗しました")
      setErrorDetails("通常のデュエルは可能です。")
      setShowErrorDialog(true)
      
      // Still show the game field
      setShowDeckProcessor(false)
    }
  }

  // Handle auto play start
  const handleAutoPlayStart = async () => {
    setShowAutoPlayDialog(false)
    
    if (!savedStateData) {
      setError("リプレイデータが利用できません")
      setShowErrorDialog(true)
      return
    }
    
    // Now try to parse and validate replay data
    try {
      let replaySaveData: ReplaySaveData
      const parsedData = JSON.parse(savedStateData.stateJson)
      
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
      
      // Extract card images from deck metadata
      if (!deckMetadata) {
        throw new Error("デッキメタデータが利用できません")
      }
      
      const cardImageMap = await extractCardsFromDeckImage(deckMetadata, deckMetadata.deckCardIds)
      
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
      
      // Start replay
      void playReplay()
    } catch (e) {
      console.error("Failed to start replay:", e)
      
      let errorMessage = "リプレイの開始に失敗しました"
      let errorDetail = null
      
      if (e instanceof Error) {
        errorMessage = e.message
        if (e.message.includes("古い形式")) {
          errorDetail = "このリプレイは現在のバージョンで再生できません。通常のデュエルは可能です。"
        }
      }
      
      setError(errorMessage)
      setErrorDetails(errorDetail)
      setShowErrorDialog(true)
    }
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
