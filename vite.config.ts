import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import pages from "@hono/vite-cloudflare-pages"
import devServer from "@hono/vite-dev-server"
import adapter from "@hono/vite-dev-server/cloudflare"
import { sentryVitePlugin } from "@sentry/vite-plugin"
import path from "path"

export default defineConfig(({ mode, command }) => {
  if (mode === "client") {
    const isProduction = command === "build"

    const plugins = [react()]

    if (isProduction && process.env.SENTRY_AUTH_TOKEN) {
      plugins.push(
        sentryVitePlugin({
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
          release: {
            name: process.env.VITE_APP_VERSION || "unknown",
          },
          sourcemaps: {
            filesToDeleteAfterUpload: "**/*.map",
          },
        }),
      )
    }

    return {
      plugins,
      resolve: {
        alias: {
          "@": path.resolve(__dirname, "./src"),
          "@client": path.resolve(__dirname, "./src/client"),
          "@server": path.resolve(__dirname, "./src/server"),
        },
      },
      build: {
        sourcemap: isProduction ? "hidden" : false,
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
        host: true,
      },
    }
  }
})
