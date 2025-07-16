import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import pages from "@hono/vite-cloudflare-pages"
import devServer from "@hono/vite-dev-server"
import adapter from "@hono/vite-dev-server/cloudflare"
import path from "path"

export default defineConfig(({ mode }) => {
  if (mode === "client") {
    return {
      plugins: [react()],
      resolve: {
        alias: {
          "@": path.resolve(__dirname, "./src"),
          "@client": path.resolve(__dirname, "./src/client"),
          "@server": path.resolve(__dirname, "./src/server"),
        },
      },
      build: {
        rollupOptions: {
          input: "./index.html",
          output: {
            entryFileNames: "static/[name].js",
            chunkFileNames: "static/[name]-[hash].js",
            assetFileNames: (assetInfo) => {
              if (assetInfo.name && assetInfo.name.endsWith(".css")) {
                return "static/[name].css"
              }
              return "static/[name]-[hash].[ext]"
            },
          },
        },
      },
      server: {
        host: true,
      },
    }
  } else {
    return {
      plugins: [
        pages({
          entry: "src/server/index.tsx",
        }),
        devServer({
          adapter,
          entry: "src/server/index.tsx",
        }),
      ],
      resolve: {
        alias: {
          "@": path.resolve(__dirname, "./src"),
          "@client": path.resolve(__dirname, "./src/client"),
          "@server": path.resolve(__dirname, "./src/server"),
        },
      },
      server: {
        port: 5173,
        host: true, // ネットワーク上の他のデバイスからアクセス可能にする
      },
    }
  }
})
