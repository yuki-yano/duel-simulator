import { useState } from "react"

import { useScreenSize } from "@client/hooks/useScreenSize"
import { useDeviceType } from "@client/hooks/useDeviceType"

export const useGameFieldUiState = () => {
  const { isMobile, isTablet, isPc } = useDeviceType()
  const { isLargeScreen, isMediumScreen, isSmallScreen } = useScreenSize()

  const isTouchDevice = isMobile || isTablet

  const [isOpponentFieldOpen, setIsOpponentFieldOpen] = useState(false)
  const [isExtraActionsOpen, setIsExtraActionsOpen] = useState(false)
  const [mobileDefenseMode, setMobileDefenseMode] = useState(false)
  const [mobileFaceDownMode, setMobileFaceDownMode] = useState(false)
  const [mobileStackBottom, setMobileStackBottom] = useState(false)
  const [preventSameZoneReorder, setPreventSameZoneReorder] = useState(false)
  const [isHintMinimized, setIsHintMinimized] = useState(() => {
    const saved = localStorage.getItem("duel-simulator-hint-minimized")
    return saved === "true"
  })

  return {
    isTouchDevice,
    isPc,
    isLargeScreen,
    isMediumScreen,
    isSmallScreen,
    isOpponentFieldOpen,
    setIsOpponentFieldOpen,
    isExtraActionsOpen,
    setIsExtraActionsOpen,
    mobileDefenseMode,
    setMobileDefenseMode,
    mobileFaceDownMode,
    setMobileFaceDownMode,
    mobileStackBottom,
    setMobileStackBottom,
    preventSameZoneReorder,
    setPreventSameZoneReorder,
    isHintMinimized,
    setIsHintMinimized,
  }
}

export type GameFieldUiState = ReturnType<typeof useGameFieldUiState>
