/** @jsxImportSource hono/jsx */
import type { FC } from "hono/jsx"
import { OGP_IMAGE } from "@/shared/constants/ogp"

export const Root: FC = () => {
  const baseUrl = "https://duel-simulator.miyauchidp.dev"
  const title = "Duel Simulator"
  const description =
    "Yu-Gi-Oh! カードゲームのシミュレーター。ニューロンの画像からデッキを自動認識し、操作・リプレイ保存・URL共有が可能"
  const imageUrl = `${baseUrl}/ogp.jpg`

  return (
    <html lang="ja">
      <head>
        <meta charSet="UTF-8" />
        <link rel="icon" type="image/svg+xml" href="/vite.svg" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, maximum-scale=1.0" />
        <title>{title}</title>
        <meta name="description" content={description} />

        {/* OGP Tags */}
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={baseUrl} />
        <meta property="og:locale" content="ja_JP" />
        <meta property="og:image" content={imageUrl} />
        <meta property="og:image:secure_url" content={imageUrl} />
        <meta property="og:image:type" content="image/jpeg" />
        <meta property="og:image:width" content={String(OGP_IMAGE.WIDTH)} />
        <meta property="og:image:height" content={String(OGP_IMAGE.HEIGHT)} />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={imageUrl} />

        {/* Note.com support */}
        <meta name="note:card" content="summary_large_image" />
      </head>
      <body>
        <div id="root"></div>
        <script type="module" crossOrigin="anonymous" src="/static/index.js"></script>
        <link rel="stylesheet" crossOrigin="anonymous" href="/static/index.css" />
      </body>
    </html>
  )
}
