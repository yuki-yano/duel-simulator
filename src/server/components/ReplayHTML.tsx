/** @jsxImportSource hono/jsx */
import type { FC } from "hono/jsx"

interface ReplayHTMLProps {
  title: string
  description: string
  url: string
  imageUrl?: string
}

export const ReplayHTML: FC<ReplayHTMLProps> = ({ title, description, url, imageUrl }) => {
  return (
    <html lang="ja">
      <head>
        <meta charSet="UTF-8" />
        <link rel="icon" type="image/svg+xml" href="/vite.svg" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, maximum-scale=1.0" />
        <title>{title} - Duel Simulator</title>

        {/* OGP Tags */}
        <meta property="og:title" content={`${title} - Duel Simulator`} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={url} />
        {imageUrl !== undefined && <meta property="og:image" content={imageUrl} />}

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${title} - Duel Simulator`} />
        <meta name="twitter:description" content={description} />
        {imageUrl !== undefined && <meta name="twitter:image" content={imageUrl} />}

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

export const DefaultHTML: FC = () => {
  return (
    <html lang="ja">
      <head>
        <meta charSet="UTF-8" />
        <link rel="icon" type="image/svg+xml" href="/vite.svg" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, maximum-scale=1.0" />
        <title>Duel Simulator</title>
      </head>
      <body>
        <div id="root"></div>
        <script type="module" crossOrigin="anonymous" src="/static/index.js"></script>
        <link rel="stylesheet" crossOrigin="anonymous" href="/static/index.css" />
      </body>
    </html>
  )
}
