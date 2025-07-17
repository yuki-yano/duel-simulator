/** @jsxImportSource hono/jsx */
import type { FC } from "hono/jsx"
import { OGP_IMAGE } from "@/shared/constants/ogp"

interface ReplayProps {
  title: string
  description: string
  url: string
  imageUrl?: string
}

export const Replay: FC<ReplayProps> = ({ title, description, url, imageUrl }) => {
  return (
    <html lang="ja">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, maximum-scale=1.0" />
        <title>{title} - Duel Simulator</title>

        {/* OGP Tags */}
        <meta property="og:title" content={`${title} - Duel Simulator`} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={url} />
        <meta property="og:locale" content="ja_JP" />
        {imageUrl != null && imageUrl !== "" && <meta property="og:image" content={imageUrl} />}
        {imageUrl != null && imageUrl !== "" && <meta property="og:image:secure_url" content={imageUrl} />}
        {imageUrl != null && imageUrl !== "" && <meta property="og:image:type" content="image/jpeg" />}
        {imageUrl != null && imageUrl !== "" && <meta property="og:image:width" content={String(OGP_IMAGE.WIDTH)} />}
        {imageUrl != null && imageUrl !== "" && <meta property="og:image:height" content={String(OGP_IMAGE.HEIGHT)} />}

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${title} - Duel Simulator`} />
        <meta name="twitter:description" content={description} />
        {imageUrl != null && imageUrl !== "" && <meta name="twitter:image" content={imageUrl} />}

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
