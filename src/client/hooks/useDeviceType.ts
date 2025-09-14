import { useEffect, useState } from "react"
import { SCREEN_WIDTH } from "@client/constants/screen"

// User-Agent Client Hints API types
type NavigatorUAData = {
  mobile?: boolean
  platform?: string
  brands?: Array<{
    brand: string
    version: string
  }>
}

declare global {
  interface Navigator {
    userAgentData?: NavigatorUAData
  }
}

type DeviceType = "pc" | "mobile" | "tablet"

type UseDeviceTypeReturn = {
  deviceType: DeviceType
  isPc: boolean
  isMobile: boolean
  isTablet: boolean
}

export const useDeviceType = (): UseDeviceTypeReturn => {
  const getDeviceType = (): DeviceType => {
    // 1. 入力能力での判定（最速）
    const isPcLike = window.matchMedia("(hover: hover) and (pointer: fine)").matches
    const isMobileLike = window.matchMedia("(hover: none) and (pointer: coarse)").matches

    if (isPcLike) {
      return "pc"
    }

    if (isMobileLike) {
      // 2. 画面サイズでタブレットとモバイルを区別
      const isTabletSize = window.matchMedia(`(min-width: ${SCREEN_WIDTH.MEDIUM}px)`).matches
      if (isTabletSize) {
        return "tablet"
      }
      return "mobile"
    }

    // 3. User-Agent Client Hints（Chromium系のみ）
    if ("userAgentData" in navigator) {
      const uaData = navigator.userAgentData
      if (uaData && uaData.mobile === true) {
        const isTabletSize = window.matchMedia(`(min-width: ${SCREEN_WIDTH.MEDIUM}px)`).matches
        return isTabletSize ? "tablet" : "mobile"
      }
      return "pc"
    }

    // 4. フォールバック: タッチサポートと画面サイズで判定
    const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0
    const isTabletSize = window.matchMedia("(min-width: 768px)").matches

    if (hasTouch) {
      return isTabletSize ? "tablet" : "mobile"
    }

    return "pc"
  }

  const [deviceType, setDeviceType] = useState<DeviceType>(getDeviceType)

  useEffect(() => {
    const updateDeviceType = () => {
      setDeviceType(getDeviceType())
    }

    // メディアクエリの変更を監視
    const mediaQueries = [
      window.matchMedia("(hover: hover) and (pointer: fine)"),
      window.matchMedia("(hover: none) and (pointer: coarse)"),
      window.matchMedia(`(min-width: ${SCREEN_WIDTH.MEDIUM}px)`),
    ]

    mediaQueries.forEach((mq) => {
      mq.addEventListener("change", updateDeviceType)
    })

    return () => {
      mediaQueries.forEach((mq) => {
        mq.removeEventListener("change", updateDeviceType)
      })
    }
  }, [])

  return {
    deviceType,
    isPc: deviceType === "pc",
    isMobile: deviceType === "mobile",
    isTablet: deviceType === "tablet",
  }
}
