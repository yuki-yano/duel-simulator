import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"
import { nanoid } from "nanoid"
import type { Card } from "@/shared/types/game"

// 相手デッキの読み込みステータス
export type OpponentDeckLoadStatus = "idle" | "processing" | "completed" | "error"

// 相手デッキのエラー情報
export interface OpponentDeckLoadError {
  code: "FILE_SIZE_EXCEEDED" | "INVALID_FORMAT" | "OCR_FAILED" | "NETWORK_ERROR" | "UNKNOWN"
  message: string
  details?: unknown
}

// 相手デッキのメインデッキカードAtom
export const opponentDeckCardsAtom = atomWithStorage<Card[]>("opponentDeckCards", [], undefined, { getOnInit: true })

// 相手デッキのエクストラデッキカードAtom
export const opponentExtraDeckCardsAtom = atomWithStorage<Card[]>("opponentExtraDeckCards", [], undefined, {
  getOnInit: true,
})

// 相手デッキのサイドデッキカードAtom
export const opponentSideDeckCardsAtom = atomWithStorage<Card[]>("opponentSideDeckCards", [], undefined, {
  getOnInit: true,
})

// 相手デッキ読み込みステータスAtom
export const opponentDeckLoadStatusAtom = atom<OpponentDeckLoadStatus>("idle")

// 相手デッキ読み込みエラーAtom
export const opponentDeckLoadErrorAtom = atom<OpponentDeckLoadError | null>(null)

// 相手デッキが存在するかの派生Atom
export const hasOpponentDeckAtom = atom((get) => {
  const mainDeck = get(opponentDeckCardsAtom)
  const extraDeck = get(opponentExtraDeckCardsAtom)
  const sideDeck = get(opponentSideDeckCardsAtom)

  return mainDeck.length > 0 || extraDeck.length > 0 || sideDeck.length > 0
})

// 相手デッキの枚数を取得する派生Atom
export const opponentDeckCountAtom = atom((get) => {
  const mainDeck = get(opponentDeckCardsAtom)
  const extraDeck = get(opponentExtraDeckCardsAtom)
  const sideDeck = get(opponentSideDeckCardsAtom)

  return {
    main: mainDeck.length,
    extra: extraDeck.length,
    side: sideDeck.length,
    total: mainDeck.length + extraDeck.length + sideDeck.length,
  }
})

// 相手デッキのメタデータ
export interface OpponentDeckMetadata {
  imageDataUrl: string
  imageHash?: string
  mainDeckCount: number
  extraDeckCount: number
  sideDeckCount?: number
  sourceWidth: number
  sourceHeight: number
  deckCardIds: {
    mainDeck: Record<string, string>
    extraDeck: Record<string, string>
    sideDeck?: Record<string, string>
  }
  deckConfig?: unknown
}

// 相手デッキのメタデータAtom
export const opponentDeckMetadataAtom = atom<OpponentDeckMetadata | null>(null)

// Player2用のカードID生成関数
export const generatePlayer2CardId = (): string => {
  return `p2-${nanoid(8)}`
}

// カードID生成関数（Player指定可能）
export const generateCardId = (playerId: "p1" | "p2" = "p1"): string => {
  return `${playerId}-${nanoid(8)}`
}

// 相手デッキをクリアする関数を提供するAtom
export const clearOpponentDeckAtom = atom(null, (get, set) => {
  set(opponentDeckCardsAtom, [])
  set(opponentExtraDeckCardsAtom, [])
  set(opponentSideDeckCardsAtom, [])
  set(opponentDeckLoadStatusAtom, "idle")
  set(opponentDeckLoadErrorAtom, null)
})

// 相手デッキを設定する関数を提供するAtom
export const setOpponentDeckAtom = atom(
  null,
  (get, set, { main, extra, side }: { main: Card[]; extra: Card[]; side: Card[] }) => {
    // 渡されたカードIDを維持したままコピーを保存する
    const cloneCards = (cards: Card[]): Card[] => cards.map((card) => ({ ...card }))

    set(opponentDeckCardsAtom, cloneCards(main))
    set(opponentExtraDeckCardsAtom, cloneCards(extra))
    set(opponentSideDeckCardsAtom, cloneCards(side))
    set(opponentDeckLoadStatusAtom, "completed")
    set(opponentDeckLoadErrorAtom, null)
  },
)

// 相手デッキのエラーを設定する関数を提供するAtom
export const setOpponentDeckErrorAtom = atom(null, (get, set, error: OpponentDeckLoadError) => {
  set(opponentDeckLoadStatusAtom, "error")
  set(opponentDeckLoadErrorAtom, error)
})
