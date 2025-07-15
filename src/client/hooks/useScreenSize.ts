import { useState, useEffect } from "react"

export function useScreenSize() {
  const [screenSize, setScreenSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 1024,
    isLargeScreen: typeof window !== "undefined" ? window.innerWidth >= 1024 : true,
    isMediumScreen: typeof window !== "undefined" ? window.innerWidth >= 768 : true,
    isSmallScreen: typeof window !== "undefined" ? window.innerWidth >= 640 : true,
  })

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth
      setScreenSize({
        width,
        isLargeScreen: width >= 1024,
        isMediumScreen: width >= 768,
        isSmallScreen: width >= 640,
      })
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return screenSize
}