import { cn } from "@client/lib/utils"

import { Zone } from "../Zone"
import { GraveZone } from "../GraveZone"
import type { GameFieldController } from "../hooks/useGameFieldController"
import { GRAVE_ZONE_SIZE } from "@/client/constants/screen"

export function FieldGrid({ controller }: { controller: GameFieldController }) {
  const {
    gridRef,
    isLargeScreen,
    isMediumScreen,
    isSmallScreen,
    isOpponentFieldOpen,
    playerBoard,
    opponentBoard,
    handleCardDrop,
    handleCardContextMenu,
    setContextMenu,
    openZoneExpandModal,
    expandedZone,
  } = controller

  return (
    <div className="mb-2 flex justify-center">
      <div
        ref={gridRef}
        className={cn(
          "grid gap-1 sm:gap-2 p-1 sm:p-2 mx-auto relative overflow-visible",
          isLargeScreen
            ? "grid-cols-[93px_38px_repeat(5,38px)_auto] sm:grid-cols-[93px_55px_repeat(5,55px)_auto] md:grid-cols-[93px_66px_repeat(5,66px)_auto]"
            : "grid-cols-[38px_repeat(5,38px)_auto] sm:grid-cols-[55px_repeat(5,55px)_auto] md:grid-cols-[66px_repeat(5,66px)_auto]",
        )}
      >
        {isLargeScreen && (
          <div
            className={cn(
              "side-free-zone-self col-start-1 row-span-2",
              isOpponentFieldOpen ? "row-start-4" : "row-start-2",
            )}
            style={{
              marginTop: "-105px",
              zIndex: 10,
              position: "relative",
            }}
          >
            <GraveZone
              type="sideFree"
              cardCount={(playerBoard.sideFreeZone ?? []).length}
              cards={playerBoard.sideFreeZone ?? []}
              zone={{ player: "self", type: "sideFreeZone" }}
              onDrop={handleCardDrop}
              onContextMenu={handleCardContextMenu}
              onContextMenuClose={() => setContextMenu(null)}
              style={{
                height: isLargeScreen
                  ? GRAVE_ZONE_SIZE.SELF.LARGE.HEIGHT
                  : isMediumScreen
                    ? GRAVE_ZONE_SIZE.SELF.MEDIUM.HEIGHT
                    : GRAVE_ZONE_SIZE.SELF.SMALL.HEIGHT,
                width: isLargeScreen
                  ? GRAVE_ZONE_SIZE.SELF.LARGE.WIDTH
                  : isMediumScreen
                    ? GRAVE_ZONE_SIZE.SELF.MEDIUM.WIDTH
                    : GRAVE_ZONE_SIZE.SELF.SMALL.WIDTH,
              }}
            />
          </div>
        )}

        {isOpponentFieldOpen && (
          <>
            {isLargeScreen ? <div className="col-start-2" /> : <div />}
            {[0, 1, 2, 3, 4].map((index) => (
              <Zone
                key={`opponent-spell-${index}`}
                className={index === 0 ? "spell-trap-zone-opponent" : ""}
                type="spell"
                zone={{ player: "opponent", type: "spellTrapZone", index }}
                cards={opponentBoard.spellTrapZones[index]}
                onDrop={handleCardDrop}
                onContextMenu={handleCardContextMenu}
                onContextMenuClose={() => setContextMenu(null)}
              />
            ))}
            <div className="row-span-2 flex gap-1 sm:gap-2" style={{ zIndex: 10, position: "relative" }}>
              <GraveZone
                type="grave"
                cardCount={opponentBoard.graveyard.length}
                cards={opponentBoard.graveyard}
                zone={{ player: "opponent", type: "graveyard" }}
                onDrop={handleCardDrop}
                isOpponent={true}
                onContextMenu={handleCardContextMenu}
                onContextMenuClose={() => setContextMenu(null)}
                style={{
                  height: isLargeScreen
                    ? GRAVE_ZONE_SIZE.OPPONENT.LARGE.HEIGHT
                    : isMediumScreen
                      ? GRAVE_ZONE_SIZE.OPPONENT.MEDIUM.HEIGHT
                      : isSmallScreen
                        ? GRAVE_ZONE_SIZE.OPPONENT.SMALL.HEIGHT
                        : GRAVE_ZONE_SIZE.OPPONENT.SP.HEIGHT,
                  width: isLargeScreen
                    ? GRAVE_ZONE_SIZE.OPPONENT.LARGE.WIDTH
                    : isMediumScreen
                      ? GRAVE_ZONE_SIZE.OPPONENT.MEDIUM.WIDTH
                      : isSmallScreen
                        ? GRAVE_ZONE_SIZE.OPPONENT.SMALL.WIDTH
                        : GRAVE_ZONE_SIZE.OPPONENT.SP.WIDTH,
                }}
              />
              <GraveZone
                type="banish"
                cardCount={opponentBoard.banished.length}
                cards={opponentBoard.banished}
                zone={{ player: "opponent", type: "banished" }}
                onDrop={handleCardDrop}
                isOpponent={true}
                onContextMenu={handleCardContextMenu}
                onContextMenuClose={() => setContextMenu(null)}
                style={{
                  height: isLargeScreen
                    ? GRAVE_ZONE_SIZE.OPPONENT.LARGE.HEIGHT
                    : isMediumScreen
                      ? GRAVE_ZONE_SIZE.OPPONENT.MEDIUM.HEIGHT
                      : isSmallScreen
                        ? GRAVE_ZONE_SIZE.OPPONENT.SMALL.HEIGHT
                        : GRAVE_ZONE_SIZE.OPPONENT.SP.HEIGHT,
                  width: isLargeScreen
                    ? GRAVE_ZONE_SIZE.OPPONENT.LARGE.WIDTH
                    : isMediumScreen
                      ? GRAVE_ZONE_SIZE.OPPONENT.MEDIUM.WIDTH
                      : isSmallScreen
                        ? GRAVE_ZONE_SIZE.OPPONENT.SMALL.WIDTH
                        : GRAVE_ZONE_SIZE.OPPONENT.SP.WIDTH,
                }}
              />
            </div>
            {isLargeScreen && <div className="col-start-1" />}
            <Zone
              type="field"
              zone={{ player: "opponent", type: "fieldZone" }}
              card={opponentBoard.fieldZone}
              onDrop={handleCardDrop}
              onContextMenu={handleCardContextMenu}
              onContextMenuClose={() => setContextMenu(null)}
            />
            {[0, 1, 2, 3, 4].map((index) => (
              <Zone
                key={`opponent-monster-${index}`}
                type="monster"
                zone={{ player: "opponent", type: "monsterZone", index }}
                cards={opponentBoard.monsterZones[index]}
                onDrop={handleCardDrop}
                onContextMenu={handleCardContextMenu}
                onContextMenuClose={() => setContextMenu(null)}
              />
            ))}
          </>
        )}

        <Zone
          className={cn(
            "emz-zone-self",
            isOpponentFieldOpen ? "row-start-3" : "row-start-1",
            isLargeScreen ? "col-start-4" : "col-start-3",
          )}
          type="emz"
          zone={{ player: "self", type: "extraMonsterZone", index: 0 }}
          cards={playerBoard.extraMonsterZones[0]}
          onDrop={handleCardDrop}
          onContextMenu={handleCardContextMenu}
          onContextMenuClose={() => setContextMenu(null)}
        />
        <Zone
          className={cn(
            isOpponentFieldOpen ? "row-start-3" : "row-start-1",
            isLargeScreen ? "col-start-6" : "col-start-5",
          )}
          type="emz"
          zone={{ player: "self", type: "extraMonsterZone", index: 1 }}
          cards={playerBoard.extraMonsterZones[1]}
          onDrop={handleCardDrop}
          onContextMenu={handleCardContextMenu}
          onContextMenuClose={() => setContextMenu(null)}
        />
        <Zone
          className={cn(isOpponentFieldOpen ? "row-start-4" : "row-start-2", isLargeScreen ? "col-start-2" : "")}
          type="field"
          zone={{ player: "self", type: "fieldZone" }}
          card={playerBoard.fieldZone}
          onDrop={handleCardDrop}
          onContextMenu={handleCardContextMenu}
          onContextMenuClose={() => setContextMenu(null)}
        />
        {[0, 1, 2, 3, 4].map((index) => (
          <Zone
            key={`self-monster-${index}`}
            className={cn("", isOpponentFieldOpen ? "row-start-4" : "row-start-2")}
            type="monster"
            zone={{ player: "self", type: "monsterZone", index }}
            cards={playerBoard.monsterZones[index]}
            onDrop={handleCardDrop}
            onContextMenu={handleCardContextMenu}
            onContextMenuClose={() => setContextMenu(null)}
          />
        ))}
        <div
          className={cn(
            "row-span-2 flex gap-1 sm:gap-2 player-grave-container",
            isOpponentFieldOpen ? "row-start-4" : "row-start-2",
          )}
        >
          <div
            className="flex gap-1 sm:gap-2"
            style={{
              marginTop: isLargeScreen
                ? GRAVE_ZONE_SIZE.SELF.LARGE.MARGIN_TOP
                : isMediumScreen
                  ? GRAVE_ZONE_SIZE.SELF.MEDIUM.MARGIN_TOP
                  : isSmallScreen
                    ? GRAVE_ZONE_SIZE.SELF.SMALL.MARGIN_TOP
                    : GRAVE_ZONE_SIZE.SELF.SP.MARGIN_TOP,
              zIndex: 10,
              position: "relative",
            }}
          >
            <GraveZone
              type="grave"
              cardCount={playerBoard.graveyard.length}
              cards={playerBoard.graveyard}
              zone={{ player: "self", type: "graveyard" }}
              onDrop={handleCardDrop}
              onContextMenu={handleCardContextMenu}
              onContextMenuClose={() => setContextMenu(null)}
              onLabelClick={() => openZoneExpandModal({ player: "self", type: "graveyard" })}
              isDisabled={expandedZone?.type === "graveyard"}
              className="grave-zone-self"
              style={{
                height: isLargeScreen
                  ? GRAVE_ZONE_SIZE.SELF.LARGE.HEIGHT
                  : isMediumScreen
                    ? GRAVE_ZONE_SIZE.SELF.MEDIUM.HEIGHT
                    : isSmallScreen
                      ? GRAVE_ZONE_SIZE.SELF.SMALL.HEIGHT
                      : GRAVE_ZONE_SIZE.SELF.SP.HEIGHT,
                width: isLargeScreen
                  ? GRAVE_ZONE_SIZE.SELF.LARGE.WIDTH
                  : isMediumScreen
                    ? GRAVE_ZONE_SIZE.SELF.MEDIUM.WIDTH
                    : isSmallScreen
                      ? GRAVE_ZONE_SIZE.SELF.SMALL.WIDTH
                      : GRAVE_ZONE_SIZE.SELF.SP.WIDTH,
              }}
            />
            <GraveZone
              type="banish"
              cardCount={playerBoard.banished.length}
              cards={playerBoard.banished}
              zone={{ player: "self", type: "banished" }}
              onDrop={handleCardDrop}
              onContextMenu={handleCardContextMenu}
              onContextMenuClose={() => setContextMenu(null)}
              onLabelClick={() => openZoneExpandModal({ player: "self", type: "banished" })}
              isDisabled={expandedZone?.type === "banished"}
              className="banish-zone-self"
              style={{
                height: isLargeScreen
                  ? GRAVE_ZONE_SIZE.SELF.LARGE.HEIGHT
                  : isMediumScreen
                    ? GRAVE_ZONE_SIZE.SELF.MEDIUM.HEIGHT
                    : isSmallScreen
                      ? GRAVE_ZONE_SIZE.SELF.SMALL.HEIGHT
                      : GRAVE_ZONE_SIZE.SELF.SP.HEIGHT,
                width: isLargeScreen
                  ? GRAVE_ZONE_SIZE.SELF.LARGE.WIDTH
                  : isMediumScreen
                    ? GRAVE_ZONE_SIZE.SELF.MEDIUM.WIDTH
                    : isSmallScreen
                      ? GRAVE_ZONE_SIZE.SELF.SMALL.WIDTH
                      : GRAVE_ZONE_SIZE.SELF.SP.WIDTH,
              }}
            />
          </div>
        </div>
        <Zone
          className={cn(isOpponentFieldOpen ? "row-start-5" : "row-start-3", isLargeScreen ? "col-start-2" : "")}
          type="free"
          zone={{ player: "self", type: "freeZone" }}
          cards={playerBoard.freeZone}
          onDrop={handleCardDrop}
          onContextMenu={handleCardContextMenu}
          onContextMenuClose={() => setContextMenu(null)}
        />
        {[0, 1, 2, 3, 4].map((index) => (
          <Zone
            key={`self-spell-${index}`}
            className={cn(
              index === 0 ? "spell-trap-zone-self" : "",
              isOpponentFieldOpen ? "row-start-5" : "row-start-3",
            )}
            type="spell"
            zone={{ player: "self", type: "spellTrapZone", index }}
            cards={playerBoard.spellTrapZones[index]}
            onDrop={handleCardDrop}
            onContextMenu={handleCardContextMenu}
            onContextMenuClose={() => setContextMenu(null)}
          />
        ))}
      </div>
    </div>
  )
}
