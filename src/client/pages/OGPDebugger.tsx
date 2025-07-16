import { useState } from "react"

export function OGPDebugger() {
  const [replayId, setReplayId] = useState("")
  const [debugUrl, setDebugUrl] = useState("")

  const handleDebug = () => {
    if (!replayId) return
    
    const baseUrl = window.location.origin
    const replayUrl = `${baseUrl}/replay/${replayId}`
    setDebugUrl(replayUrl)
  }

  const debuggers = [
    {
      name: "Facebook Sharing Debugger",
      url: (url: string) => `https://developers.facebook.com/tools/debug/?q=${encodeURIComponent(url)}`,
      description: "Facebookの公式OGPデバッガー"
    },
    {
      name: "Twitter Card Validator", 
      url: (_url: string) => `https://cards-dev.twitter.com/validator`,
      description: "X(Twitter)の公式カードバリデーター（要ログイン）"
    },
    {
      name: "LinkedIn Post Inspector",
      url: (url: string) => `https://www.linkedin.com/post-inspector/inspect/${encodeURIComponent(url)}`,
      description: "LinkedInの公式デバッガー"
    },
    {
      name: "OpenGraph.xyz",
      url: (url: string) => `https://www.opengraph.xyz/url/${encodeURIComponent(url)}`,
      description: "汎用OGPチェッカー（プレビュー付き）"
    },
    {
      name: "metatags.io",
      url: (url: string) => `https://metatags.io/?url=${encodeURIComponent(url)}`,
      description: "各SNSでの見た目をプレビュー"
    }
  ]

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">OGP Debugger</h1>
      
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-yellow-800">
          <strong>注意:</strong> ローカル環境（localhost）では外部サービスからアクセスできないため、
          本番環境にデプロイした後でテストしてください。
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">
            リプレイID
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={replayId}
              onChange={(e) => setReplayId(e.target.value)}
              placeholder="例: LkyUTcsm"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
            />
            <button
              onClick={handleDebug}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              デバッグ開始
            </button>
          </div>
        </div>

        {debugUrl && (
          <>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">デバッグ対象URL:</p>
              <code className="block p-2 bg-white border rounded text-sm">{debugUrl}</code>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-4">OGPデバッグツール</h2>
              <div className="grid gap-4">
                {debuggers.map((tool) => (
                  <div key={tool.name} className="border rounded-lg p-4">
                    <h3 className="font-medium mb-2">{tool.name}</h3>
                    <p className="text-sm text-gray-600 mb-3">{tool.description}</p>
                    <a
                      href={tool.url(debugUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-blue-500 hover:text-blue-600"
                    >
                      デバッグツールを開く →
                    </a>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8">
              <h2 className="text-lg font-semibold mb-4">ローカルでのテスト方法</h2>
              <div className="space-y-4 text-sm">
                <div className="border-l-4 border-blue-500 pl-4">
                  <h3 className="font-medium mb-2">1. ngrokを使った方法</h3>
                  <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
{`# ngrokをインストール
brew install ngrok

# ローカルサーバーを公開
ngrok http 8787

# 表示されたhttps://xxxxx.ngrok.ioのURLを使ってテスト`}
                  </pre>
                </div>

                <div className="border-l-4 border-blue-500 pl-4">
                  <h3 className="font-medium mb-2">2. curlでメタタグを確認</h3>
                  <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
{`curl -s http://localhost:8787/replay/${replayId} | grep -E 'og:|twitter:'`}
                  </pre>
                </div>

                <div className="border-l-4 border-blue-500 pl-4">
                  <h3 className="font-medium mb-2">3. ブラウザで直接確認</h3>
                  <p className="text-gray-600">
                    ページのソースを表示（右クリック → ページのソースを表示）して、
                    &lt;meta property={`"og:*"`}&gt; タグが正しく設定されているか確認
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}