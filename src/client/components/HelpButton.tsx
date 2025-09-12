import { useState } from "react"
import { cn } from "@client/lib/utils"
import { HelpCircle } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@client/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@client/components/ui/tabs"
import { useDeviceType } from "@client/hooks/useDeviceType"
import { useTranslation } from "react-i18next"

export function HelpButton() {
  const [open, setOpen] = useState(false)
  const { isMobile, isTablet } = useDeviceType()
  const { t } = useTranslation("ui")

  // Only show on mobile and tablet devices
  if (!isMobile && !isTablet) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className={cn(
            "fixed bottom-4 right-4 z-50",
            "w-10 h-10 rounded-full",
            "bg-gray-400/40 hover:bg-gray-500/50 transition-colors",
            "flex items-center justify-center",
            "shadow-md",
            // Device type based visibility is handled above
          )}
          aria-label={t("help.title")}
        >
          <HelpCircle className="w-5 h-5 text-gray-600" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-[90vw] h-[700px] max-h-[85vh] flex flex-col !rounded-2xl">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{t("help.operationGuide")}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="basic" className="w-full flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
            <TabsTrigger value="basic">{t("help.basicOperations")}</TabsTrigger>
            <TabsTrigger value="zones">{t("help.zones")}</TabsTrigger>
            <TabsTrigger value="features">{t("help.features")}</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4 overflow-y-auto flex-1 px-1">
            <div className="space-y-1">
              <h3 className="font-semibold text-sm">{t("help.cardMovement")}</h3>
              <p className="text-sm text-gray-600">{t("help.cardMovementDescription")}</p>
            </div>

            <div className="space-y-1">
              <h3 className="font-semibold text-sm">{t("help.cardMenu")}</h3>
              <p className="text-sm text-gray-600">{t("help.cardMenuDescription")}</p>
              <ul className="text-sm text-gray-600 list-disc list-inside ml-2">
                <li>{t("help.activateEffect")}</li>
                <li>{t("help.targetCard")}</li>
                <li>{t("help.highlight")}</li>
                <li>{t("help.changeDisplay")}</li>
                <li>{t("help.faceDown")}</li>
              </ul>
            </div>

            <div className="space-y-1">
              <h3 className="font-semibold text-sm">{t("help.undoOperation")}</h3>
              <p className="text-sm text-gray-600">{t("help.undoDescription")}</p>
            </div>
          </TabsContent>

          <TabsContent value="zones" className="space-y-4 mt-4 overflow-y-auto flex-1 px-1">
            <div className="space-y-1">
              <h3 className="font-semibold text-sm">{t("help.cardStacking")}</h3>
              <p className="text-sm text-gray-600">{t("help.cardStackingDescription")}</p>
            </div>

            <div className="space-y-1">
              <h3 className="font-semibold text-sm">{t("help.graveBanishZone")}</h3>
              <p className="text-sm text-gray-600">{t("help.graveBanishDescription")}</p>
            </div>

            <div className="space-y-1">
              <h3 className="font-semibold text-sm">{t("help.exDeck")}</h3>
              <p className="text-sm text-gray-600">{t("help.exDeckDescription")}</p>
            </div>

            <div className="space-y-1">
              <h3 className="font-semibold text-sm">{t("help.freeZone")}</h3>
              <p className="text-sm text-gray-600">{t("help.freeZoneDescription")}</p>
            </div>
          </TabsContent>

          <TabsContent value="features" className="space-y-4 mt-4 overflow-y-auto flex-1 px-1">
            <div className="space-y-1">
              <h3 className="font-semibold text-sm">{t("help.tokenGeneration")}</h3>
              <p className="text-sm text-gray-600">{t("help.tokenDescription")}</p>
            </div>

            <div className="space-y-1">
              <h3 className="font-semibold text-sm">{t("help.random5Draw")}</h3>
              <p className="text-sm text-gray-600">{t("help.random5DrawDescription")}</p>
            </div>

            <div className="space-y-1">
              <h3 className="font-semibold text-sm">{t("help.replayFeature")}</h3>
              <p className="text-sm text-gray-600">{t("help.replayDescription")}</p>
              <ul className="text-sm text-gray-600 list-disc list-inside ml-2">
                <li>{t("help.startStopRecording")}</li>
                <li>{t("help.playPause")}</li>
                <li>{t("help.shareLink")}</li>
              </ul>
            </div>

            <div className="space-y-1">
              <h3 className="font-semibold text-sm">{t("help.gameReset")}</h3>
              <p className="text-sm text-gray-600">{t("help.gameResetDescription")}</p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
