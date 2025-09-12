import { atom } from "jotai"
import type { Card, ZoneId } from "@/shared/types/game"

// UI state atoms
export const selectedCardAtom = atom<Card | null>(null)
export const draggedCardAtom = atom<(Card & { zone: ZoneId }) | null>(null)
export const hoveredZoneAtom = atom<ZoneId | null>(null)
export const highlightedZonesAtom = atom<ZoneId[]>([])
