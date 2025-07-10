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
  const [savedStateData, setSavedStateData] = useState<{
    stateJson: string
    deckConfig: string
    deckCardIds: string
    deckImageHash: string
    title: string
    description?: string
  } | null>(null)
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

    void loadReplay()

    // Cleanup function to stop replay
    return () => {
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
      
      // Early validation of replay data to detect compatibility issues
      let isReplayCompatible = false
      let replayValidationError: string | null = null
      try {
        const parsedData = JSON.parse(savedState.stateJson)
        const validationResult = ReplaySaveDataSchema.safeParse(parsedData)
        
        if (!validationResult.success) {
          const errors = validationResult.error.format()
          console.error("Early replay validation errors:", errors)
          
          // Determine specific compatibility issue
          if (errors.data?.deckCardIds) {
            replayValidationError = "古い形式のリプレイです（カードIDマッピングが不足）"
          } else if (errors.data?.initialState) {
            replayValidationError = "古い形式のリプレイです（初期状態データが不正）"
          } else if (errors.data?.operations) {
            replayValidationError = "古い形式のリプレイです（操作履歴が不正）"
          } else {
            replayValidationError = "リプレイデータの形式が不正です"
          }
        } else {
          isReplayCompatible = true
        }
      } catch (e) {
        console.error("Failed to parse replay data:", e)
        replayValidationError = "リプレイデータの解析に失敗しました"
      }
      
      // Store replay compatibility status for later use
      setReplayDataError(replayValidationError)
      
      let deckData
      try {
        deckData = await getDeckImage(savedState.deckImageHash)
      } catch (e) {
        console.error("Failed to load deck image:", e)
        // This is a fatal error - deck image is required
        setIsFatalError(true)
        throw new Error("デッキ画像の読み込みに失敗しました")
      }

      // Parse and validate deck config - but don't fail if it's invalid
      let deckConfig: DeckConfiguration | null = null
      try {
        const parsedConfig = JSON.parse(savedState.deckConfig)
        const validationResult = DeckConfigurationSchema.safeParse(parsedConfig)
        
        if (!validationResult.success) {
          console.error("Deck config validation errors:", validationResult.error.format())
          if (!replayValidationError) {
            replayValidationError = "デッキ設定データが不正です"
          }
        } else {
          deckConfig = validationResult.data
        }
      } catch (e) {
        console.error("Failed to parse deck config:", e)
        if (!replayValidationError) {
          replayValidationError = "デッキ設定の解析に失敗しました"
        }
      }

      // Parse and validate deck card IDs - but don't fail if it's invalid
      let deckCardIds: DeckCardIdsMapping | null = null
      try {
        const parsedIds = JSON.parse(savedState.deckCardIds)
        const validationResult = DeckCardIdsMappingSchema.safeParse(parsedIds)
        
        if (!validationResult.success) {
          console.error("Deck card IDs validation errors:", validationResult.error.format())
          if (!replayValidationError) {
            replayValidationError = "カードIDマッピングが不正です"
          }
        } else {
          deckCardIds = validationResult.data as DeckCardIdsMapping
        }
      } catch (e) {
        console.error("Failed to parse deck card IDs:", e)
        if (!replayValidationError) {
          replayValidationError = "カードIDマッピングの解析に失敗しました"
        }
      }
      
      // Check if we have minimum requirements to proceed
      const canProceedWithDeck = deckConfig !== null && deckCardIds !== null && deckData !== null
      
      // If we have critical data missing that prevents deck display, it's fatal
      if (!deckData.mainDeckCount && !deckData.extraDeckCount) {
        setIsFatalError(true)
        throw new Error("デッキ情報が破損しています")
      }

      // Set title and description
      setTitle(savedState.title)
      setDescription(savedState.description ?? "")

      // Set deck metadata with deckCardIds - only if we have valid data
      if (canProceedWithDeck && deckConfig && deckCardIds) {
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
          setEmptyGameState()
        }
      } else {
        // If deck config or card IDs are invalid, still set up empty game state
        console.warn("Deck config or card IDs are invalid, setting up empty game state")
        setEmptyGameState()
      }

      // Set deck image for display - always show deck if we have the image
      setDeckImage(deckData.imageDataUrl)
      setShowDeckProcessor(true)
      setIsLoading(false)
      
      // Show compatibility error dialog if needed (non-fatal)
      if (replayValidationError) {
        // Delay showing dialog to ensure page is rendered
        setTimeout(() => {
          setError(replayValidationError)
          setErrorDetails("このリプレイは現在のバージョンと互換性がありませんが、通常の操作は可能です。")
          setShowErrorDialog(true)
        }, 500)
      }
    } catch (error) {
      console.error("Failed to load replay:", error)
      
      // For fatal errors, just set the error and let the UI handle it
      if (error instanceof Error) {
        setError(error.message)
      } else {
        setError("リプレイの読み込みに失敗しました")
      }
      
      setIsLoading(false)
    }
  }

  // Helper function to set empty game state
  const setEmptyGameState = () => {
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
    // Check if we have a compatibility error
    if (replayDataError) {
      // Show error dialog but still proceed to game field
      setError(replayDataError)
      setErrorDetails("このリプレイは現在のバージョンで再生できません。通常の操作は可能です。")
      setShowErrorDialog(true)
      
      // Show the game field for normal play
      setShowDeckProcessor(false)
      return
    }
    
    // Check if saved state data is available
    if (!savedStateData) {
      setError("リプレイデータが利用できません")
      setShowErrorDialog(true)
      setShowDeckProcessor(false)
      return
    }
    
    // If we reach here, replay data should be valid - proceed with auto play dialog
    setShowDeckProcessor(false)
    setShowAutoPlayDialog(true)
  }

  // Handle auto play start
  const handleAutoPlayStart = async () => {
    setShowAutoPlayDialog(false)
    
    if (!savedStateData || !deckMetadata) {
      setError("リプレイデータが利用できません")
      setShowErrorDialog(true)
      return
    }
    
    // Parse and start replay (validation should have already passed)
    try {
      const parsedData = JSON.parse(savedStateData.stateJson)
      const replaySaveData = parsedData as ReplaySaveData
      
      // Extract card images from deck metadata
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
      setError("リプレイの開始に失敗しました")
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
