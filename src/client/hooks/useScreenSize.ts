import { useState, useEffect, useContext } from "react"
import { ScreenshotContext } from "@client/contexts/ScreenshotContext"
import { SCREEN_WIDTH, SCREENSHOT_SCREEN_WIDTH } from "../constants/screen"

export function useScreenSize() {
  const screenshotContext = useContext(ScreenshotContext)
  const screenshotWidth = screenshotContext?.screenshotWidth
  const [screenSize, setScreenSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : SCREEN_WIDTH.LARGE,
    isLargeScreen: typeof window !== "undefined" ? window.innerWidth >= SCREEN_WIDTH.LARGE : true,
    isMediumScreen: typeof window !== "undefined" ? window.innerWidth >= SCREEN_WIDTH.MEDIUM : true,
    isSmallScreen: typeof window !== "undefined" ? window.innerWidth >= SCREEN_WIDTH.SMALL : true,
    isSpScreen: typeof window !== "undefined" ? window.innerWidth < SCREEN_WIDTH.SMALL : false,
  })

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth
      setScreenSize({
        width,
        isLargeScreen: width >= SCREEN_WIDTH.LARGE,
        isMediumScreen: width >= SCREEN_WIDTH.MEDIUM,
        isSmallScreen: width >= SCREEN_WIDTH.SMALL,
        isSpScreen: width < SCREEN_WIDTH.SMALL,
      })
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  if (screenshotWidth != null) {
    return {
      width: screenshotWidth,
      isLargeScreen: screenshotWidth >= SCREENSHOT_SCREEN_WIDTH.PC,
      isMediumScreen: screenshotWidth >= SCREENSHOT_SCREEN_WIDTH.TABLET,
      isSmallScreen: screenshotWidth >= SCREENSHOT_SCREEN_WIDTH.SP,
      isSpScreen: screenshotWidth < SCREENSHOT_SCREEN_WIDTH.SP,
    }
  }

  return screenSize
}
