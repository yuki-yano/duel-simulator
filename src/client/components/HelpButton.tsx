import { useState } from "react"
import { cn } from "@client/lib/utils"
import { HelpCircle } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@client/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@client/components/ui/tabs"

export function HelpButton() {
  const [open, setOpen] = useState(false)

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
            "md:hidden", // Only show on touch devices
          )}
          aria-label="ヘルプ"
        >
          <HelpCircle className="w-5 h-5 text-gray-600" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-[90vw] h-[700px] max-h-[85vh] flex flex-col !rounded-2xl">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>操作ガイド</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="basic" className="w-full flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
            <TabsTrigger value="basic">基本操作</TabsTrigger>
            <TabsTrigger value="zones">ゾーン</TabsTrigger>
            <TabsTrigger value="features">機能</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4 overflow-y-auto flex-1 px-1">
            <div className="space-y-1">
              <h3 className="font-semibold text-sm">カードの移動</h3>
              <p className="text-sm text-gray-600">カードをドラッグ＆ドロップで別のゾーンに移動できます。</p>
            </div>

            <div className="space-y-1">
              <h3 className="font-semibold text-sm">カードメニュー</h3>
              <p className="text-sm text-gray-600">カードを長押しすると、メニューが開きます：</p>
              <ul className="text-sm text-gray-600 list-disc list-inside ml-2">
                <li>効果発動</li>
                <li>対象に取る</li>
                <li>ハイライト表示</li>
                <li>表示形式変更（モンスターゾーンのみ）</li>
                <li>裏側表示にする</li>
              </ul>
            </div>

            <div className="space-y-1">
              <h3 className="font-semibold text-sm">操作の取り消し</h3>
              <p className="text-sm text-gray-600">
                「元に戻す」ボタンで直前の操作を取り消せます。 「やり直す」ボタンで取り消した操作をやり直せます。
              </p>
            </div>
          </TabsContent>

          <TabsContent value="zones" className="space-y-4 mt-4 overflow-y-auto flex-1 px-1">
            <div className="space-y-1">
              <h3 className="font-semibold text-sm">カードの重ね方</h3>
              <p className="text-sm text-gray-600">
                モンスター・魔法罠ゾーンではカードを重ねることができます。
                「上に重ねる」ボタンのトグルで上下どちらに重ねるか選択できます。
              </p>
            </div>

            <div className="space-y-1">
              <h3 className="font-semibold text-sm">墓地・除外ゾーン</h3>
              <p className="text-sm text-gray-600">
                ゾーン名（墓地/除外）をタップすると、 カードを拡大表示して確認できます。
              </p>
            </div>

            <div className="space-y-1">
              <h3 className="font-semibold text-sm">フリーゾーン</h3>
              <p className="text-sm text-gray-600">
                左下のグレーのゾーンは自由に使えるフリーゾーンです。 一時的にカードを置いたり、整理したりできます。
              </p>
            </div>
          </TabsContent>

          <TabsContent value="features" className="space-y-4 mt-4 overflow-y-auto flex-1 px-1">
            <div className="space-y-1">
              <h3 className="font-semibold text-sm">トークン生成</h3>
              <p className="text-sm text-gray-600">
                「トークン生成」ボタンでトークンを生成できます。
                トークンはフリーゾーンに追加され、フリーゾーンのカードが5枚になるまで追加できます。
              </p>
            </div>

            <div className="space-y-1">
              <h3 className="font-semibold text-sm">ランダム5枚ドロー</h3>
              <p className="text-sm text-gray-600">
                「ランダム5ドロー」でデッキ読み込み直後の状態に戻しながら、シャッフルをした上で5枚ドローを行います。
              </p>
            </div>

            <div className="space-y-1">
              <h3 className="font-semibold text-sm">リプレイ機能</h3>
              <p className="text-sm text-gray-600">デュエルを録画・再生・共有できます：</p>
              <ul className="text-sm text-gray-600 list-disc list-inside ml-2">
                <li>録画開始/停止ボタンで記録</li>
                <li>再生/一時停止で確認</li>
                <li>共有リンクでリプレイを共有</li>
              </ul>
            </div>

            <div className="space-y-1">
              <h3 className="font-semibold text-sm">ゲームリセット</h3>
              <p className="text-sm text-gray-600">「Reset」ボタンでゲームを初期状態に戻せます。</p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
