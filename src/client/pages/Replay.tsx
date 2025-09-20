import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { Card, CardContent } from "@client/components/ui/Card"
import { Button } from "@client/components/ui/button"
import { Copy } from "lucide-react"
import { GameField } from "@client/components/GameField"
import { LanguageSelector } from "@client/components/LanguageSelector"
import { useTranslation } from "react-i18next"
import { INITIAL_GAME_VALUES } from "@/shared/constants/game"
import "@client/i18n" // Initialize i18n
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
import { opponentDeckMetadataAtom } from "@/client/atoms/opponentDeckAtom"
import { extractCardsFromDeckImage, restoreCardImages } from "@/client/utils/cardExtractor"
import { DeckConfigurationSchema, DeckCardIdsMappingSchema, ReplaySaveDataSchema } from "@/client/schemas/replay"
import { cn } from "@/client/lib/utils"

export default function Replay() {
  const { t } = useTranslation(["ui", "replay"])
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
  const _setOpponentDeckMetadata = useSetAtom(opponentDeckMetadataAtom)
  const [copyFeedback, setCopyFeedback] = useState(false)

  useEffect(() => {
    if (id == null || id === "") {
      setError(t("replay:errors.noReplayId"))
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
        throw new Error(t("replay:errors.notFound"))
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
        throw new Error(t("replay:errors.deckImageLoadFailed"))
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
        throw new Error(t("replay:errors.deckInfoCorrupted"))
      }

      // Set title and description
      setTitle(savedState.title)
      setDescription(savedState.description ?? "")

      // Set document title
      document.title = `${savedState.title} - ${t("ui:page.homeTitle")}`

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
            sideDeck: {},
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
          mainDeckCards: [], // 後でextractCardsFromDeckImageで生成される
          extraDeckCards: [],
          sideDeckCards: [],
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
                lifePoints: INITIAL_GAME_VALUES.LIFE_POINTS,
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
                lifePoints: INITIAL_GAME_VALUES.LIFE_POINTS,
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
        setError(t("replay:errors.loadFailed"))
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
          lifePoints: INITIAL_GAME_VALUES.LIFE_POINTS,
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
          lifePoints: INITIAL_GAME_VALUES.LIFE_POINTS,
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
          <p className="mt-4 text-gray-600">{t("replay:messages.loading")}</p>
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
            <a href="/">{t("ui:error.returnHome")}</a>
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
      setError(t("replay:errors.dataUnavailable"))
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
        let validationError = t("replay:errors.invalidFormat")
        if (errors.data?.deckCardIds?._errors && errors.data.deckCardIds._errors.length > 0) {
          validationError = t("replay:errors.oldFormatCardMapping")
        } else if (errors.data?.initialState?._errors && errors.data.initialState._errors.length > 0) {
          validationError = t("replay:errors.oldFormatInitialState")
        } else if (errors.data?.operations?._errors && errors.data.operations._errors.length > 0) {
          validationError = t("replay:errors.oldFormatOperations")
        }

        // Show error dialog but still allow normal play
        setError(validationError)
        setErrorDetails(t("replay:errors.cannotPlayInCurrentVersion"))
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
                  lifePoints: INITIAL_GAME_VALUES.LIFE_POINTS,
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
                  lifePoints: INITIAL_GAME_VALUES.LIFE_POINTS,
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

      // 相手デッキ画像がある場合、R2から取得して復元
      if (replaySaveData.data.opponentDeckImageHash != null) {
        try {
          const opponentDeckData = await getDeckImage(replaySaveData.data.opponentDeckImageHash)

          // 相手デッキの画像URLを生成（自分のデッキと同様に/imageエンドポイントを使用）
          const opponentImageUrl = getDeckImageUrl(replaySaveData.data.opponentDeckImageHash)

          // 相手デッキのカード画像も抽出
          if (replaySaveData.data.deckCardIds != null) {
            // 相手デッキのカードIDマッピングを作成
            const opponentDeckCardIds = {
              mainDeck: replaySaveData.data.deckCardIds.opponentMainDeck ?? {},
              extraDeck: replaySaveData.data.deckCardIds.opponentExtraDeck ?? {},
              sideDeck: replaySaveData.data.deckCardIds.opponentSideDeck ?? {},
            }

            const opponentCardImageMap = await extractCardsFromDeckImage(
              {
                ...opponentDeckData,
                imageUrl: opponentImageUrl, // imageUrlを使用（imageエンドポイント経由）
                imageDataUrl: opponentDeckData.imageDataUrl, // フォールバック用
                deckCardIds: opponentDeckCardIds,
                // 相手デッキのdeck configを使用（R2から取得したものを優先）
                deckConfig:
                  opponentDeckData.deckConfig ??
                  (deckMetadata.deckConfig as DeckConfiguration | undefined) ??
                  ({
                    mainDeck: null,
                    extraDeck: null,
                    sideDeck: null,
                    cardWidth: 0,
                    cardHeight: 0,
                    cardGap: 0,
                    leftMargin: 0,
                  } as DeckConfiguration),
                sideDeckCount: Object.keys(replaySaveData.data.deckCardIds.opponentSideDeck || {}).length,
                mainDeckCards: [],
                extraDeckCards: [],
                sideDeckCards: [],
              },
              opponentDeckCardIds,
            )
            // 相手デッキの画像をcardImageMapに追加
            for (const [cardId, imageUrl] of opponentCardImageMap.entries()) {
              cardImageMap.set(cardId, imageUrl)
            }
          }
        } catch (error) {
          console.error("Failed to load opponent deck image:", error)
        }
      }

      // Restore card images to initial state
      restoreCardImages(replaySaveData.data.initialState, cardImageMap)

      // 相手デッキは restoreCardImages 内で imageUrl を復元済みなので、setOpponentDeck は呼ばない

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
      setError(t("replay:errors.prepareFailed"))
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
        setError(t("replay:errors.startFailed"))
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
      <div className="container mx-auto py-4 sm:py-8">
        <div className="flex items-center justify-between mb-4 sm:mb-8">
          <div className="flex-1">
            <Button asChild variant="outline" size="sm">
              <a href="/">
                <span className="sm:hidden">←</span>
                <span className="hidden sm:inline">{t("ui:page.returnHome")}</span>
              </a>
            </Button>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-center">{t("ui:page.replayTitle")}</h1>
          <div className="flex-1 flex justify-end">
            <LanguageSelector />
          </div>
        </div>

        {/* Replay Info */}
        <div className="max-w-2xl mx-auto mb-4 text-center">
          {title !== "" && <h2 className="text-base md:text-lg mb-2">{title}</h2>}
          {description !== "" && (
            <p className="text-xs md:text-sm text-gray-600 mb-2 whitespace-pre-line">{description}</p>
          )}
          <p className="text-xs md:text-sm text-gray-500">
            {t("ui:page.replayId")}{" "}
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
                title={t("replay:messages.clickToCopy")}
              >
                {id}
                <Copy className="h-3 w-3 opacity-60" />
              </code>
              {copyFeedback && (
                <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-gray-600 text-white text-xs rounded whitespace-nowrap animate-fade-in-out">
                  {t("ui:page.copied")}
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
          title={t("common:error.title")}
          message={error ?? ""}
          details={errorDetails ?? undefined}
        />
      </div>
    </div>
  )
}
