import { nanoid } from "nanoid"
import type { Card } from "@/shared/types/game"
import { TOKEN_IMAGE_DATA_URL } from "@/client/constants/tokenImage"

/**
 * トークンカードを生成する
 * @returns 新しいトークンカード
 */
export function createTokenCard(): Card {
  return {
    id: nanoid(),
    name: "token",
    imageUrl: TOKEN_IMAGE_DATA_URL,
    position: "attack",
    rotation: 0,
    faceDown: false,
    highlighted: false,
    // トークンカードは基本的にモンスターカードとして扱う
    type: "monster",
  }
}

/**
 * フリーゾーン内のカードの重なり枚数をチェック
 * @param cardCount フリーゾーン内のカード枚数
 * @returns 5枚以上重なっているかどうか
 */
export function isTokenLimitReached(cardCount: number): boolean {
  return cardCount >= 5
}
