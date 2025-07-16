import React, { createContext, useContext, useState } from "react"

interface ScreenshotContextType {
  screenshotWidth: number | undefined
  setScreenshotWidth: (width: number | undefined) => void
  isScreenshotMode: boolean
  setIsScreenshotMode: (isScreenshotMode: boolean) => void
}

export const ScreenshotContext = createContext<ScreenshotContextType | undefined>(undefined)

export function ScreenshotProvider({ children }: { children: React.ReactNode }) {
  const [screenshotWidth, setScreenshotWidth] = useState<number | undefined>(undefined)
  const [isScreenshotMode, setIsScreenshotMode] = useState<boolean>(false)

  return (
    <ScreenshotContext.Provider value={{ screenshotWidth, setScreenshotWidth, isScreenshotMode, setIsScreenshotMode }}>
      {children}
    </ScreenshotContext.Provider>
  )
}

export function useScreenshot() {
  const context = useContext(ScreenshotContext)
  if (!context) {
    throw new Error("useScreenshot must be used within a ScreenshotProvider")
  }
  return context
}
