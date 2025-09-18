import { DeckZone } from "../DeckZone"
import type { GameFieldController } from "../hooks/useGameFieldController"

export function PlayerArea({ controller }: { controller: GameFieldController }) {
  const {
    playerBoard,
    handleCardDrop,
    handleCardContextMenu,
    setContextMenu,
    isPc,
    openExtraDeckExpandModal,
    isExtraDeckExpanded,
    hasSideDeck,
  } = controller

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-start">
        <DeckZone
          type="hand"
          zone={{ player: "self", type: "hand" }}
          cardCount={playerBoard.hand.length}
          cards={playerBoard.hand}
          onDrop={handleCardDrop}
          onContextMenu={handleCardContextMenu}
          onContextMenuClose={() => setContextMenu(null)}
          className="hand-zone-self"
          style={{ width: "35%" }}
        />
        <DeckZone
          type="extra"
          zone={{ player: "self", type: "extraDeck" }}
          cardCount={playerBoard.extraDeck.length}
          cards={playerBoard.extraDeck}
          onDrop={handleCardDrop}
          onContextMenu={handleCardContextMenu}
          onContextMenuClose={() => setContextMenu(null)}
          className="extra-zone-self"
          style={{ width: "65%" }}
          onLabelClick={!isPc ? openExtraDeckExpandModal : undefined}
          isDisabled={isExtraDeckExpanded}
        />
      </div>
      <DeckZone
        type="deck"
        zone={{ player: "self", type: "deck" }}
        cardCount={playerBoard.deck.length}
        cards={playerBoard.deck}
        onDrop={handleCardDrop}
        onContextMenu={handleCardContextMenu}
        onContextMenuClose={() => setContextMenu(null)}
        className="deck-zone-self"
      />
      {(hasSideDeck || (playerBoard.sideDeck && playerBoard.sideDeck.length > 0)) && (
        <DeckZone
          type="side"
          zone={{ player: "self", type: "sideDeck" }}
          cardCount={playerBoard.sideDeck?.length ?? 0}
          cards={playerBoard.sideDeck ?? []}
          onDrop={handleCardDrop}
          onContextMenu={handleCardContextMenu}
          onContextMenuClose={() => setContextMenu(null)}
          className="side-deck-zone-self"
        />
      )}
    </div>
  )
}
