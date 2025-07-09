import { useEffect, useState } from "react"
import { Card, CardContent } from "@/client/components/Card"

interface AutoPlayDialogProps {
  onStart: () => void
  onCancel: () => void
  countdown?: number
}

export function AutoPlayDialog({ onStart, onCancel, countdown = 3 }: AutoPlayDialogProps) {
  const [remainingTime, setRemainingTime] = useState(countdown)
  const [elapsedTime, setElapsedTime] = useState(0)

  useEffect(() => {
    const startTime = Date.now()
    const animationTimer = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000
      setElapsedTime(elapsed)
      
      if (elapsed >= countdown) {
        clearInterval(animationTimer)
      }
    }, 16) // 60fps for smooth animation

    const countdownTimer = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimer)
          clearInterval(animationTimer)
          onStart()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      clearInterval(countdownTimer)
      clearInterval(animationTimer)
    }
  }, [onStart, countdown])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="max-w-md w-full mx-4">
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <h3 className="text-xl font-semibold">自動再生</h3>
            <p className="text-gray-600">
              デッキを読み込みました。{remainingTime}秒後に自動再生を開始します
            </p>
            
            {/* カウントダウン表示 */}
            <div className="relative w-24 h-24 mx-auto">
              <svg className="w-24 h-24 transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-gray-200"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 40}`}
                  strokeDashoffset={`${2 * Math.PI * 40 * (elapsedTime / countdown)}`}
                  className="text-blue-500"
                  style={{ transition: "none" }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-bold">{remainingTime}</span>
              </div>
            </div>

            {/* ボタン */}
            <div className="flex gap-3 justify-center">
              <button
                onClick={onCancel}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={onStart}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                今すぐ再生
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}