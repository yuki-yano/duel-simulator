import { useAtomValue } from "jotai"
import { cardAnimationsAtom } from "@/client/atoms/boardAtoms"

export function useCardAnimation(cardId: string) {
  const cardAnimations = useAtomValue(cardAnimationsAtom)

  // Check if this card is currently animating (only for move animations)
  const isAnimating = cardAnimations.some((anim) => anim.type === "move" && anim.cardId === cardId)

  // Check if this card has a highlight animation
  const highlightAnimating = cardAnimations.some((anim) => anim.type === "highlight" && anim.cardId === cardId)

  // Check if this card is in target animation (used to suppress hover shift only)
  const targetAnimating = cardAnimations.some((anim) => anim.type === "target" && anim.cardId === cardId)

  // Check if this card is in effect activation animation (used to suppress hover shift)
  const activateAnimating = cardAnimations.some((anim) => anim.type === "activate" && anim.cardId === cardId)

  // Check if this card is in rotate animation (used to suppress hover shift)
  const rotateAnimating = cardAnimations.some((anim) => anim.type === "rotate" && anim.cardId === cardId)

  // Check if this card is in flip animation (hide the original card)
  const flipAnimating = cardAnimations.some((anim) => anim.type === "flip" && anim.cardId === cardId)

  return {
    isAnimating,
    highlightAnimating,
    targetAnimating,
    activateAnimating,
    rotateAnimating,
    flipAnimating,
  }
}
