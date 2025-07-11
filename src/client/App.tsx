import { useState, useEffect } from "react"
import { produce } from "immer"
import { Card, CardContent } from "@client/components/ui/Card"
import { GameField } from "@client/components/GameField"
import { DeckImageUploader } from "@client/components/DeckImageUploader"
import { DeckImageProcessor, type DeckProcessMetadata } from "@client/components/DeckImageProcessor"
import { GoToReplayDialog } from "@client/components/GoToReplayDialog"
import { useAtom, useAtomValue } from "jotai"
import {
  extractedCardsAtom,
  gameStateAtom,
  resetHistoryAtom,
  operationsAtom,
  drawCardAtom,
  draggedCardAtom,
  initialStateAfterDeckLoadAtom,
  deckMetadataAtom,
} from "@client/atoms/boardAtoms"

export default function App() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [processedCards, setProcessedCards] = useState<string[]>([])
  const [_deckMetadata, setDeckMetadata] = useState<DeckProcessMetadata | null>(null)
  const [showGoToReplayDialog, setShowGoToReplayDialog] = useState(false)
  const extractedCards = useAtomValue(extractedCardsAtom)
  const gameState = useAtomValue(gameStateAtom)
  const [, resetHistory] = useAtom(resetHistoryAtom)
  const _operations = useAtomValue(operationsAtom)
  const [, _drawCard] = useAtom(drawCardAtom)
  const [_isGameStarted, _setIsGameStarted] = useState(false)
  const draggedCard = useAtomValue(draggedCardAtom)
  const [, setInitialStateAfterDeckLoad] = useAtom(initialStateAfterDeckLoadAtom)
  const [, setDeckMetadataAtom] = useAtom(deckMetadataAtom)

  // Disable pinch zoom on mount
  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault()
      }
    }

    document.addEventListener("touchmove", handleTouchMove, { passive: false })

    return () => {
      document.removeEventListener("touchmove", handleTouchMove)
    }
  }, [])

  const handleImageUpload = (imageDataUrl: string) => {
    setUploadedImage(imageDataUrl)
  }

  const handleProcessComplete = (cards: string[], metadata: DeckProcessMetadata) => {
    setProcessedCards(cards)
    setDeckMetadata(metadata)
    // Save deck metadata to global atom for replay saving
    setDeckMetadataAtom({
      imageDataUrl: metadata.imageDataUrl,
      deckConfig: metadata.deckConfig,
      mainDeckCount: metadata.mainDeckCount,
      extraDeckCount: metadata.extraDeckCount,
      sourceWidth: metadata.sourceWidth,
      sourceHeight: metadata.sourceHeight,
      deckCardIds: metadata.deckCardIds,
    })
  }

  // When cards are extracted, reflect them in game state
  useEffect(() => {
    if (extractedCards.mainDeck.length > 0 || extractedCards.extraDeck.length > 0) {
      // Set zone information and index for cards
      const mainDeckWithZones = extractedCards.mainDeck.map((card, index) => ({
        ...card,
        zone: { player: "self" as const, type: "deck" as const },
        index,
      }))
      const extraDeckWithZones = extractedCards.extraDeck.map((card, index) => ({
        ...card,
        zone: { player: "self" as const, type: "extraDeck" as const },
        index,
      }))

      const newState = produce(gameState, (draft) => {
        draft.players.self.deck = mainDeckWithZones
        draft.players.self.extraDeck = extraDeckWithZones
      })

      // Reset history with deck loaded state as initial state
      resetHistory(newState)

      // Save initial state for reset functionality
      setInitialStateAfterDeckLoad(newState)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extractedCards]) // Intentionally excluding gameState and resetHistory to prevent infinite loop

  // Prevent scrolling during touch drag
  useEffect(() => {
    const preventScroll = (e: TouchEvent) => {
      // Only prevent default if dragging a card AND not pinch zooming
      if (draggedCard && e.touches.length === 1) {
        e.preventDefault()
      }
    }

    // Specify passive: false to enable preventDefault
    document.addEventListener("touchmove", preventScroll, { passive: false })

    return () => {
      document.removeEventListener("touchmove", preventScroll)
    }
  }, [draggedCard])

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-4 sm:py-8">
        <h1 className="text-2xl md:text-3xl font-bold text-center mb-4 sm:mb-8">Duel Simulator</h1>

        {/* Image Upload Section */}
        {uploadedImage === null && (
          <div className="max-w-2xl mx-auto mb-4 space-y-4">
            <DeckImageUploader onImageUpload={handleImageUpload} />
            <div className="text-center">
              <button
                onClick={() => setShowGoToReplayDialog(true)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium"
              >
                リプレイIDからリプレイを開く
              </button>
            </div>
          </div>
        )}

        {/* Image Processing Section */}
        {uploadedImage !== null && processedCards.length === 0 && (
          <div className="max-w-2xl mx-auto mb-4">
            <DeckImageProcessor imageDataUrl={uploadedImage} onProcessComplete={handleProcessComplete} />
          </div>
        )}

        {/* Game Field */}
        <Card className="max-w-5xl mx-auto">
          <CardContent>
            <GameField />
          </CardContent>
        </Card>

        {/* Processed Cards Display (before game starts) */}
        {/* {processedCards.length > 0 && !isGameStarted && (                                                       */}
        {/*   <div className="max-w-7xl mx-auto mt-8 space-y-4">                                                    */}
        {/*     <Card className="p-6">                                                                              */}
        {/*       <h3 className="text-lg font-semibold mb-4">メインデッキ ({extractedCards.mainDeck.length}枚)</h3> */}
        {/*       <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">                                          */}
        {/*         {extractedCards.mainDeck.map((card) => (                                                        */}
        {/*           <img                                                                                          */}
        {/*             key={card.id}                                                                               */}
        {/*             src={card.imageUrl}                                                                         */}
        {/*             alt={`Main Deck Card`}                                                                      */}
        {/*             className="w-full aspect-[59/86] rounded shadow-sm hover:shadow-lg transition-shadow"       */}
        {/*           />                                                                                            */}
        {/*         ))}                                                                                             */}
        {/*       </div>                                                                                            */}
        {/*     </Card>                                                                                             */}

        {/*     {extractedCards.extraDeck.length > 0 && (                                                           */}
        {/*       <Card className="p-6">                                                                            */}
        {/*         <h3 className="text-lg font-semibold mb-4">EXデッキ ({extractedCards.extraDeck.length}枚)</h3>  */}
        {/*         <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">                                        */}
        {/*           {extractedCards.extraDeck.map((card) => (                                                     */}
        {/*             <img                                                                                        */}
        {/*               key={card.id}                                                                             */}
        {/*               src={card.imageUrl}                                                                       */}
        {/*               alt={`Extra Deck Card`}                                                                   */}
        {/*               className="w-full aspect-[59/86] rounded shadow-sm hover:shadow-lg transition-shadow"     */}
        {/*             />                                                                                          */}
        {/*           ))}                                                                                           */}
        {/*         </div>                                                                                          */}
        {/*       </Card>                                                                                           */}
        {/*     )}                                                                                                  */}
        {/*   </div>                                                                                                */}
        {/* )}                                                                                                      */}

        {/* Go to Replay Dialog */}
        <GoToReplayDialog isOpen={showGoToReplayDialog} onOpenChange={setShowGoToReplayDialog} />
      </div>
    </div>
  )
}
