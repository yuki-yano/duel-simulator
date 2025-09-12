import { atom } from "jotai"

// Card ref tracking - Maps card ID to DOM element refs for animations
export const cardRefsAtom = atom<Map<string, HTMLElement>>(new Map())

// Zone ref tracking - Maps zone selector to DOM element refs for modals
export const zoneRefsAtom = atom<Map<string, HTMLElement>>(new Map())

// Update card ref atom
export const updateCardRefAtom = atom(null, (get, set, cardId: string, ref: HTMLElement | null) => {
  const refs = new Map(get(cardRefsAtom))
  if (ref) {
    refs.set(cardId, ref)
  } else {
    refs.delete(cardId)
  }
  set(cardRefsAtom, refs)
})

// Update zone ref atom
export const updateZoneRefAtom = atom(null, (get, set, zoneSelector: string, ref: HTMLElement | null) => {
  const refs = new Map(get(zoneRefsAtom))
  if (ref) {
    refs.set(zoneSelector, ref)
  } else {
    refs.delete(zoneSelector)
  }
  set(zoneRefsAtom, refs)
})
