/**
 * Find the droppable zone element from a given element
 */
export function findDroppableZone(element: Element | null): Element | null {
  let targetElement: Element | null = element

  while (targetElement) {
    // Check if this element or its parent has drag event handlers
    if (
      (targetElement as HTMLElement).ondrop ||
      (targetElement as HTMLElement).ondragover ||
      targetElement.classList.contains("zone") ||
      targetElement.classList.contains("deck-zone") ||
      targetElement.classList.contains("grave-zone") ||
      targetElement.classList.contains("zone-expand-modal-drop") ||
      targetElement.getAttribute("data-droppable") === "true"
    ) {
      return targetElement
    }
    targetElement = targetElement.parentElement
  }

  return null
}

/**
 * Create and dispatch a drag event
 */
export function createDragEvent(type: "dragover" | "drop", clientX: number, clientY: number): DragEvent {
  return new DragEvent(type, {
    bubbles: true,
    cancelable: true,
    dataTransfer: new DataTransfer(),
    clientX,
    clientY,
  })
}

/**
 * Calculate offset from touch/mouse point to card center
 */
export function calculateDragOffset(
  cardElement: HTMLElement | null,
  clientX: number,
  clientY: number
): { x: number; y: number } {
  if (!cardElement) {
    return { x: 0, y: 0 }
  }

  const rect = cardElement.getBoundingClientRect()
  const cardCenterX = rect.left + rect.width / 2
  const cardCenterY = rect.top + rect.height / 2

  return {
    x: cardCenterX - clientX,
    y: cardCenterY - clientY,
  }
}

/**
 * Lock body scrolling for mobile drag
 */
export function lockBodyScroll(): void {
  document.body.style.overflow = "hidden"
  document.body.style.touchAction = "none"
}

/**
 * Unlock body scrolling after mobile drag
 */
export function unlockBodyScroll(): void {
  document.body.style.overflow = ""
  document.body.style.touchAction = ""
}
