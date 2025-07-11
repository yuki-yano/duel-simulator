import type { Card as GameCard, ZoneId } from "@/shared/types/game"

export interface ZoneProps {
  className?: string
  label?: string
  children?: React.ReactNode
  type: "monster" | "spell" | "field" | "extra" | "deck" | "emz" | "hand"
  isOpponent?: boolean
  cardCount?: number
  zone: ZoneId
  card?: GameCard | null
  cards?: GameCard[]
  onDrop?: (fromZone: ZoneId, toZone: ZoneId, shiftKey?: boolean) => void
  onContextMenu?: (e: React.MouseEvent | React.TouchEvent, card: GameCard, zone: ZoneId) => void
  onContextMenuClose?: () => void
}

export interface GraveZoneProps {
  type: "grave" | "banish"
  cardCount: number
  label?: string
  className?: string
  style?: React.CSSProperties
  cards?: GameCard[]
  zone: ZoneId
  onDrop?: (fromZone: ZoneId, toZone: ZoneId, shiftKey?: boolean) => void
  isOpponent?: boolean
  onContextMenu?: (e: React.MouseEvent | React.TouchEvent, card: GameCard, zone: ZoneId) => void
  onContextMenuClose?: () => void
  onLabelClick?: () => void
  isDisabled?: boolean
}

export interface DeckZoneProps {
  type: "deck" | "extra" | "hand"
  isOpponent?: boolean
  cardCount?: number
  orientation?: "horizontal" | "vertical"
  cards?: GameCard[]
  zone: ZoneId
  onDrop?: (fromZone: ZoneId, toZone: ZoneId, shiftKey?: boolean) => void
  onContextMenu?: (e: React.MouseEvent | React.TouchEvent, card: GameCard, zone: ZoneId) => void
  onContextMenuClose?: () => void
  className?: string
  style?: React.CSSProperties
}