import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { Card, CardContent } from "@client/components/ui/Card"
import { Button } from "@client/components/ui/button"
import { Copy } from "lucide-react"
import { GameField } from "@client/components/GameField"
import { loadGameState } from "@client/api/gameState"
import { getDeckImage, getDeckImageUrl } from "@client/api/deck"
import type { DeckCardIdsMapping, DeckConfiguration } from "@/shared/types/game"
import { DeckImageProcessor } from "@client/components/DeckImageProcessor"
import { AutoPlayDialog } from "@client/components/AutoPlayDialog"
import { ErrorDialog } from "@client/components/ErrorDialog"
import { useSetAtom, useAtomValue, useAtom } from "jotai"
import {
  replayDataAtom,
  gameStateAtom,
  deckMetadataAtom,
  playReplayAtom,
  stopReplayAtom,
  replayTotalOperationsAtom,
  hasEverPlayedInReplayModeAtom,
  initialStateAfterDeckLoadAtom,
} from "@/client/atoms/boardAtoms"
import { extractCardsFromDeckImage, restoreCardImages } from "@/client/utils/cardExtractor"
import { DeckConfigurationSchema, DeckCardIdsMappingSchema, ReplaySaveDataSchema } from "@/client/schemas/replay"
import { cn } from "@/client/lib/utils"

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
  const [savedStateData, setSavedStateData] = useState<{
    stateJson: string
    deckConfig: string
    deckCardIds: string
    deckImageHash: string
    title: string
    description: string | null
  } | null>(null)
  const [isFatalError, setIsFatalError] = useState(false)

  const setReplayData = useSetAtom(replayDataAtom)
  const setGameState = useSetAtom(gameStateAtom)
  const setDeckMetadata = useSetAtom(deckMetadataAtom)
  const [, setInitialStateAfterDeckLoad] = useAtom(initialStateAfterDeckLoadAtom)
  const playReplay = useSetAtom(playReplayAtom)
  const stopReplay = useSetAtom(stopReplayAtom)
  const deckMetadata = useAtomValue(deckMetadataAtom)
  const setReplayTotalOperations = useSetAtom(replayTotalOperationsAtom)
  const setHasEverPlayedInReplayMode = useSetAtom(hasEverPlayedInReplayModeAtom)
  const [copyFeedback, setCopyFeedback] = useState(false)

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
      } catch (_e) {
        // Handle API errors (404, network errors, etc)
        setIsFatalError(true)
        throw new Error("リプレイが見つかりません")
      }

      // Store saved state for later use
      setSavedStateData(savedState)

      // Validation will be done when replay starts
      // バリデーションは「再生を開始」ボタンクリック時に実行する

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
        const validationResult = DeckConfigurationSchema.safeParse(JSON.parse(savedState.deckConfig))

        if (!validationResult.success) {
          console.error("Deck config validation errors:", validationResult.error.format())
        } else {
          deckConfig = validationResult.data
        }
      } catch (e) {
        console.error("Failed to parse deck config:", e)
      }

      // Parse and validate deck card IDs - but don't fail if it's invalid
      let deckCardIds: DeckCardIdsMapping | null = null
      try {
        const validationResult = DeckCardIdsMappingSchema.safeParse(JSON.parse(savedState.deckCardIds))

        if (!validationResult.success) {
          console.error("Deck card IDs validation errors:", validationResult.error.format())
        } else {
          deckCardIds = validationResult.data as DeckCardIdsMapping
        }
      } catch (e) {
        console.error("Failed to parse deck card IDs:", e)
      }

      // Check if we have minimum requirements to proceed
      const _canProceedWithDeck = deckConfig !== null && deckCardIds !== null && deckData !== null

      // If we have critical data missing that prevents deck display, it's fatal
      if (deckData.mainDeckCount === 0 && deckData.extraDeckCount === 0) {
        setIsFatalError(true)
        throw new Error("デッキ情報が破損しています")
      }

      // Set title and description
      setTitle(savedState.title)
      setDescription(savedState.description ?? "")

      // Set document title
      document.title = `${savedState.title} - Duel Simulator`

      // Set deck metadata - always set if we have deck image data
      // This allows deck display even if deckCardIds is invalid
      if (deckData !== null && deckConfig !== null) {
        const imageUrl = getDeckImageUrl(savedState.deckImageHash)

        // If deckCardIds is null, generate default mapping
        let finalDeckCardIds = deckCardIds
        if (finalDeckCardIds === null) {
          console.warn("deckCardIds is null, generating default mapping...")
          finalDeckCardIds = {
            mainDeck: {},
            extraDeck: {},
          }
          // Generate default IDs for main deck
          for (let i = 0; i < deckData.mainDeckCount; i++) {
            finalDeckCardIds.mainDeck[`main-${i}`] = `main-${i}`
          }
          // Generate default IDs for extra deck
          for (let i = 0; i < deckData.extraDeckCount; i++) {
            finalDeckCardIds.extraDeck[`extra-${i}`] = `extra-${i}`
          }
        }

        const metadata = {
          imageDataUrl: deckData.imageDataUrl,
          imageUrl,
          deckConfig,
          mainDeckCount: deckData.mainDeckCount,
          extraDeckCount: deckData.extraDeckCount,
          sourceWidth: deckData.sourceWidth,
          sourceHeight: deckData.sourceHeight,
          deckCardIds: finalDeckCardIds,
        }
        setDeckMetadata(metadata)

        // Try to extract cards from deck for initial setup
        try {
          // Extract cards using the deckCardIds from metadata (which is guaranteed to be non-null)
          const cardImageMap = await extractCardsFromDeckImage(metadata, metadata.deckCardIds)

          // Create initial state with deck cards
          const mainDeckCards = Object.entries(cardImageMap)
            .filter(([id]) => id.startsWith("main-"))
            .map(([id, imageUrl]) => ({
              id,
              name: `Card ${id}`,
              imageUrl,
              position: "attack" as const,
              rotation: 0,
              faceDown: false,
            }))

          const extraDeckCards = Object.entries(cardImageMap)
            .filter(([id]) => id.startsWith("extra-"))
            .map(([id, imageUrl]) => ({
              id,
              name: `Card ${id}`,
              imageUrl,
              position: "attack" as const,
              rotation: 0,
              faceDown: false,
            }))

          // Set initial game state with cards in deck
          setGameState({
            players: {
              self: {
                monsterZones: Array(5)
                  .fill(null)
                  .map(() => []),
                spellTrapZones: Array(5)
                  .fill(null)
                  .map(() => []),
                fieldZone: null,
                graveyard: [],
                banished: [],
                extraDeck: extraDeckCards,
                deck: mainDeckCards,
                hand: [],
                extraMonsterZones: Array(2)
                  .fill(null)
                  .map(() => []),
                freeZone: [],
                sideFreeZone: [],
                lifePoints: 8000,
              },
              opponent: {
                monsterZones: Array(5)
                  .fill(null)
                  .map(() => []),
                spellTrapZones: Array(5)
                  .fill(null)
                  .map(() => []),
                fieldZone: null,
                graveyard: [],
                banished: [],
                extraDeck: [],
                deck: [],
                hand: [],
                extraMonsterZones: Array(2)
                  .fill(null)
                  .map(() => []),
                freeZone: [],
                sideFreeZone: [],
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
          monsterZones: Array(5)
            .fill(null)
            .map(() => []),
          spellTrapZones: Array(5)
            .fill(null)
            .map(() => []),
          fieldZone: null,
          graveyard: [],
          banished: [],
          extraDeck: [],
          deck: [],
          hand: [],
          extraMonsterZones: Array(2)
            .fill(null)
            .map(() => []),
          freeZone: [],
          sideFreeZone: [],
          lifePoints: 8000,
        },
        opponent: {
          monsterZones: Array(5)
            .fill(null)
            .map(() => []),
          spellTrapZones: Array(5)
            .fill(null)
            .map(() => []),
          fieldZone: null,
          graveyard: [],
          banished: [],
          extraDeck: [],
          deck: [],
          hand: [],
          extraMonsterZones: Array(2)
            .fill(null)
            .map(() => []),
          freeZone: [],
          sideFreeZone: [],
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
          <Button asChild variant="link" className="mt-4">
            <a href="/">ホームに戻る</a>
          </Button>
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
    // Check if saved state data is available
    if (!savedStateData || !deckMetadata) {
      setError("リプレイデータが利用できません")
      setShowErrorDialog(true)
      setShowDeckProcessor(false)
      return
    }

    // リプレイデータをパースしてバリデーション
    try {
      // Zodバリデーションを実行（JSON.parseも含めて安全に実行）
      const validationResult = ReplaySaveDataSchema.safeParse(JSON.parse(savedStateData.stateJson))

      if (!validationResult.success) {
        const errors = validationResult.error.format()
        console.error("Replay validation errors:", errors)

        // Determine specific compatibility issue
        let validationError = "リプレイデータの形式が不正です"
        if (errors.data?.deckCardIds?._errors && errors.data.deckCardIds._errors.length > 0) {
          validationError = "古い形式のリプレイです（カードIDマッピングが不足）"
        } else if (errors.data?.initialState?._errors && errors.data.initialState._errors.length > 0) {
          validationError = "古い形式のリプレイです（初期状態データが不正）"
        } else if (errors.data?.operations?._errors && errors.data.operations._errors.length > 0) {
          validationError = "古い形式のリプレイです（操作履歴が不正）"
        }

        // Show error dialog but still allow normal play
        setError(validationError)
        setErrorDetails("このリプレイは現在のバージョンで再生できません。通常の操作は可能です。")
        setShowErrorDialog(true)

        // バリデーションエラーでも、デッキの初期状態を設定して通常操作可能にする
        try {
          // 以前のデバッグ用ログを削除
          // 既にデッキメタデータがある場合はそれを使用
          if (deckMetadata != null) {
            // バリデーションエラー時は新しいカードIDマッピングを生成
            const regeneratedCardIds = {
              mainDeck: {} as Record<string, string>,
              extraDeck: {} as Record<string, string>,
            }

            // 新しいカードIDを生成
            const timestamp = Date.now()
            for (let i = 0; i < deckMetadata.mainDeckCount; i++) {
              const newId = `regen-main-${i}-${timestamp}`
              regeneratedCardIds.mainDeck[i.toString()] = newId
            }

            for (let i = 0; i < deckMetadata.extraDeckCount; i++) {
              const newId = `regen-extra-${i}-${timestamp}`
              regeneratedCardIds.extraDeck[i.toString()] = newId
            }

            // 新しいIDマッピングで画像を切り出し
            const cardImageMap = await extractCardsFromDeckImage(deckMetadata, regeneratedCardIds)

            // カードオブジェクトを作成
            const mainDeckCards = []
            const extraDeckCards = []

            for (const [id, imageUrl] of cardImageMap.entries()) {
              const card = {
                id,
                name: `Card ${id}`,
                imageUrl,
                position: "attack" as const,
                rotation: 0,
                faceDown: false,
              }

              if (id.includes("main")) {
                mainDeckCards.push(card)
              } else if (id.includes("extra")) {
                extraDeckCards.push(card)
              }
            }

            // 初期状態を設定
            setGameState({
              players: {
                self: {
                  monsterZones: Array(5)
                    .fill(null)
                    .map(() => []),
                  spellTrapZones: Array(5)
                    .fill(null)
                    .map(() => []),
                  fieldZone: null,
                  graveyard: [],
                  banished: [],
                  extraDeck: extraDeckCards,
                  deck: mainDeckCards,
                  hand: [],
                  extraMonsterZones: Array(2)
                    .fill(null)
                    .map(() => []),
                  freeZone: [],
                  sideFreeZone: [],
                  lifePoints: 8000,
                },
                opponent: {
                  monsterZones: Array(5)
                    .fill(null)
                    .map(() => []),
                  spellTrapZones: Array(5)
                    .fill(null)
                    .map(() => []),
                  fieldZone: null,
                  graveyard: [],
                  banished: [],
                  extraDeck: [],
                  deck: [],
                  hand: [],
                  extraMonsterZones: Array(2)
                    .fill(null)
                    .map(() => []),
                  freeZone: [],
                  sideFreeZone: [],
                  lifePoints: 8000,
                },
              },
              turn: 1,
              phase: "main1",
              currentPlayer: "self",
            })
          } else {
            // deck metadata not available
          }
        } catch (e) {
          console.error("Failed to setup initial state on validation error:", e)
        }

        setShowDeckProcessor(false)
        return
      }

      // バリデーション成功 - リプレイデータを使用
      const replaySaveData = validationResult.data

      // 古いリプレイデータとの互換性対応
      // freeZone, sideFreeZone が存在しない場合は空配列を設定
      if (!replaySaveData.data.initialState.players.self.freeZone) {
        replaySaveData.data.initialState.players.self.freeZone = []
      }
      if (!replaySaveData.data.initialState.players.self.sideFreeZone) {
        replaySaveData.data.initialState.players.self.sideFreeZone = []
      }
      if (!replaySaveData.data.initialState.players.opponent.freeZone) {
        replaySaveData.data.initialState.players.opponent.freeZone = []
      }
      if (!replaySaveData.data.initialState.players.opponent.sideFreeZone) {
        replaySaveData.data.initialState.players.opponent.sideFreeZone = []
      }

      // Extract card images from deck metadata
      const cardImageMap = await extractCardsFromDeckImage(deckMetadata, deckMetadata.deckCardIds)

      // Restore card images to initial state
      restoreCardImages(replaySaveData.data.initialState, cardImageMap)

      // Set initial game state with restored images
      setGameState(replaySaveData.data.initialState)

      // Set initial state for reset functionality
      setInitialStateAfterDeckLoad(replaySaveData.data.initialState)

      // Set replay data
      setReplayData({
        startSnapshot: replaySaveData.data.initialState,
        operations: replaySaveData.data.operations,
        startTime: Date.now(),
        endTime: Date.now() + replaySaveData.metadata.duration,
      })

      // Set total operations for redo functionality
      setReplayTotalOperations(replaySaveData.data.operations.length)

      // If we reach here, replay data should be valid - proceed with auto play dialog
      setShowDeckProcessor(false)
      setShowAutoPlayDialog(true)
    } catch (e) {
      console.error("Failed to prepare replay:", e)
      setError("リプレイの準備に失敗しました")
      setShowErrorDialog(true)
      setShowDeckProcessor(false)
    }
  }

  // Handle auto play start
  const handleAutoPlayStart = () => {
    // ReactのレンダリングサイクルとsetStateの競合を避けるため、
    // 次のイベントループでsetStateとplayReplayを実行
    setTimeout(() => {
      setShowAutoPlayDialog(false)
      // snapshotは既にhandleReplayStartで復元済みなので、単にリプレイを開始するだけ
      try {
        // Start replay
        void playReplay()
      } catch (e) {
        console.error("Failed to start replay:", e)
        setError("リプレイの開始に失敗しました")
        setShowErrorDialog(true)
      }
    }, 0)
  }

  // Handle auto play cancel
  const handleAutoPlayCancel = () => {
    setShowAutoPlayDialog(false)
    // キャンセル時もリプレイコントロールボタンを表示するため、hasEverPlayedInReplayModeをtrueに設定
    setHasEverPlayedInReplayMode(true)
    // キャンセル時も初期状態は維持する（デッキにカードが入った状態）
    // すでにhandleReplayStartでsnapshotを復元済みなので、追加の処理は不要
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full py-4 sm:py-8">
        <div className="max-w-2xl mx-auto mb-2 px-4 sm:px-0">
          <div className="flex items-center">
            <Button asChild variant="outline" size="sm">
              <a href="/">
                <span className="sm:hidden">←</span>
                <span className="hidden sm:inline">← ホームに戻る</span>
              </a>
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold flex-1 text-center">Duel Simulator - リプレイ</h1>
            <div className="w-[32px] sm:w-[116px]"></div>
          </div>
        </div>

        {/* Replay Info */}
        <div className="max-w-2xl mx-auto mb-4 text-center">
          {title !== "" && <h2 className="text-base md:text-lg mb-2">{title}</h2>}
          {description !== "" && (
            <p className="text-xs md:text-sm text-gray-600 mb-2 whitespace-pre-line">{description}</p>
          )}
          <p className="text-xs md:text-sm text-gray-500">
            リプレイID:{" "}
            <span className="relative inline-flex items-center">
              <code
                className={cn(
                  "px-2 py-1 rounded cursor-pointer transition-all duration-300 inline-flex items-center gap-2",
                  copyFeedback ? "bg-gray-200 text-gray-700" : "bg-gray-100 hover:bg-gray-200",
                )}
                onClick={() => {
                  void navigator.clipboard.writeText(id ?? "").then(() => {
                    setCopyFeedback(true)
                    setTimeout(() => {
                      setCopyFeedback(false)
                    }, 2000)
                  })
                }}
                title="クリックしてコピー"
              >
                {id}
                <Copy className="h-3 w-3 opacity-60" />
              </code>
              {copyFeedback && (
                <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-gray-600 text-white text-xs rounded whitespace-nowrap animate-fade-in-out">
                  コピーしました！
                </span>
              )}
            </span>
          </p>
        </div>

        {/* Deck Image Processor for replay mode */}
        {showDeckProcessor && deckImage != null && (
          <div className="max-w-2xl mx-auto mb-8">
            <DeckImageProcessor
              imageDataUrl={deckImage}
              onProcessComplete={handleProcessComplete}
              isReplayMode={true}
              onReplayStart={handleReplayStart}
            />
          </div>
        )}

        {/* Game Field - Always show */}
        <Card className="max-w-5xl mx-auto">
          <CardContent>
            <GameField />
          </CardContent>
        </Card>

        {/* Auto Play Dialog */}
        {showAutoPlayDialog && (
          <AutoPlayDialog onStart={handleAutoPlayStart} onCancel={handleAutoPlayCancel} countdown={3} />
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
