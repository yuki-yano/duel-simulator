import { ChevronDown, ChevronUp } from "lucide-react"
import { useTranslation } from "react-i18next"

import { cn } from "@client/lib/utils"

import type { GameFieldController } from "../hooks/useGameFieldController"

export function PcHintPanel({ controller }: { controller: GameFieldController }) {
  const { t } = useTranslation(["game"])
  const { isHintMinimized, setIsHintMinimized } = controller

  return (
    <div className="hidden md:block fixed bottom-4 right-4 max-w-xs">
      <div className="bg-gray-800/90 text-white rounded-lg text-xs">
        <div className={cn("px-3 pt-3 flex items-center justify-between", isHintMinimized ? "pb-3" : "pb-1")}>
          <div className="font-semibold">{t("game:field.operationHints")}</div>
          <button
            onClick={() => {
              const newState = !isHintMinimized
              setIsHintMinimized(newState)
              localStorage.setItem("duel-simulator-hint-minimized", String(newState))
            }}
            className="bg-gray-600 hover:bg-gray-500 text-white transition-colors p-1 rounded"
            aria-label={isHintMinimized ? "Expand" : "Minimize"}
          >
            {isHintMinimized ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
        <div
          className={cn(
            "space-y-1 text-gray-300 px-3 transition-all duration-200",
            isHintMinimized ? "h-0 overflow-hidden pb-0" : "pb-3",
          )}
        >
          <div>
            • <span className="text-yellow-400">{t("game:field.shiftDrag")}</span>:
          </div>
          <div className="ml-4 text-xs">- {t("game:field.emptyZone")}</div>
          <div className="ml-4 text-xs">- {t("game:field.cardZone")}</div>
          <div>
            • <span className="text-blue-400">{t("game:field.dropOnCards")}</span>:
          </div>
          <div className="ml-4 text-xs">- {t("game:field.stackTop")}</div>
          <div className="ml-4 text-xs">- {t("game:field.stackBottom")}</div>
          <div>
            • <span className="text-green-400">{t("game:field.graveClickExpand")}</span>
          </div>
          <div>
            • <span className="text-gray-400">{t("game:field.rightClickMenu")}</span>
          </div>
          <div>
            • <span className="text-purple-400">{t("game:field.doubleClickEffect")}</span>
          </div>
          <div>
            • <span className="text-purple-400">{t("game:field.shiftDoubleClickTarget")}</span>
          </div>
          <div>
            • <span className="text-gray-400">{t("game:field.undoShortcut")}</span>
          </div>
          <div>
            • <span className="text-gray-400">{t("game:field.redoShortcut")}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
