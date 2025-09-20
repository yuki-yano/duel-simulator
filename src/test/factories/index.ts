/**
 * テストファクトリーユーティリティ
 * 
 * テストデータを効率的に生成するためのファクトリークラスと
 * フィクスチャデータを提供します。
 */

export { CardFactory } from './CardFactory'
export { BoardFactory } from './BoardFactory'
export { OperationFactory } from './OperationFactory'
export {
  FAMOUS_CARDS,
  PRESET_DECKS,
  GAME_STATES,
  getCard,
  getDeck,
  getGameState,
  createSampleReplay
} from './fixtures'
