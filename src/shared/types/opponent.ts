import type { GameOperation } from "@/shared/types/game"

/**
 * 相手デッキ関連の操作タイプ
 */
export type OpponentDeckOperationType =
  | "OPPONENT_DECK_LOADED" // 相手デッキ読み込み
  | "OPPONENT_DECK_CLEARED" // 相手デッキクリア
  | "DUAL_RANDOM_DRAW" // 両プレイヤーランダムドロー

/**
 * 両プレイヤーランダムドロー操作
 */
export interface DualRandomDrawOperation extends GameOperation {
  type: "draw"
  metadata: {
    operationType: "DUAL_RANDOM_DRAW"
    player1Cards: string[]
    player2Cards: string[]
  }
}

/**
 * 相手デッキ読み込み操作
 */
export interface OpponentDeckLoadOperation extends GameOperation {
  type: "draw" // 既存の操作タイプを拡張
  metadata: {
    operationType: "OPPONENT_DECK_LOADED"
    playerId: "opponent"
    deckSize: {
      main: number
      extra: number
      side: number
    }
  }
}
