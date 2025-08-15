import { atom } from "jotai"
import type { GameOperation } from "@/shared/types/game"

// Operation history atom
export const operationsAtom = atom<GameOperation[]>([])