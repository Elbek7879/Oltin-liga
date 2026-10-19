import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

// Backend manzili: odatda localhost:8080, e2e testlarda boshqa port beriladi
const apiTarget = process.env.API_TARGET ?? "http://localhost:8080"

/**
 * Production build: mavsumlar ro'yxati HTML bilan birga so'raladi (JS yuklanishini kutmaydi).
 * Namunaviy (mock) rejimda server yo'q, shuning uchun qo'shilmaydi.
 */
const preloadSeasons: Plugin = {
  name: "preload-seasons",
  apply: (_config, env) => env.command === "build" && env.mode !== "mock",
  transformIndexHtml: () => [
    { tag: "link", attrs: { rel: "preload", href: "/api/public/seasons", as: "fetch", crossorigin: "anonymous" }, injectTo: "head" },
  ],
}

/**
 * Bosh sahifa — muxlislar eng ko'p kiradigan sahifa. Uning kod bo'laklari HTML'dan darhol yuklanadi,
 * asosiy JS bajarilishini kutmaydi (telefonda LCP tezlashadi).
 */
const preloadHomeRoute: Plugin = {
  name: "preload-home-route",
  apply: "build",
  transformIndexHtml: {
    order: "post",
    handler(html, ctx) {
      const bundle = ctx.bundle
      if (!bundle) return
      const home = Object.values(bundle).find(
        (c) => c.type === "chunk" && c.facadeModuleId?.replaceAll("\\", "/").endsWith("/src/pages/public/home-page.tsx"),
      )
      if (!home) return
      const files = new Set<string>()
      const visit = (file: string) => {
        const chunk = bundle[file]
        if (files.has(file) || !chunk || chunk.type !== "chunk") return
        files.add(file)
        chunk.imports.forEach(visit)
      }
      visit(home.fileName)
      return [...files]
        .filter((file) => !html.includes(file))
        .map((file) => ({ tag: "link", attrs: { rel: "modulepreload", crossorigin: "", href: `/${file}` }, injectTo: "head" as const }))
    },
  },
}

/**
 * Telegram va boshqa tarmoqlarda havola ulashilganda rasm chiqishi uchun og:image to'liq manzil bo'lishi kerak.
 * Production build: SITE_URL=https://sizning-domen.uz npm run build
 */
const siteUrl = process.env.SITE_URL?.replace(/\/+$/, "")
const absoluteShareTags: Plugin = {
  name: "absolute-share-tags",
  apply: "build",
  transformIndexHtml: (html) =>
    siteUrl
      ? html
          .replace('content="/og-image.jpg"', `content="${siteUrl}/og-image.jpg"`)
          .replace("</head>", `  <meta property="og:url" content="${siteUrl}/" />\n  </head>`)
      : html,
}

export default defineConfig({
  plugins: [react(), tailwindcss(), preloadSeasons, preloadHomeRoute, absoluteShareTags],
  // Playwright test serverlari o'z keshidan foydalanadi (playwright*.config.ts)
  cacheDir: process.env.VITE_CACHE_DIR ?? "node_modules/.vite",
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    port: Number(process.env.PORT ?? 5173),
    strictPort: true,
    proxy: {
      "/api": { target: apiTarget, changeOrigin: false },
      "/media": { target: apiTarget, changeOrigin: false },
    },
  },
  preview: {
    proxy: {
      "/api": { target: apiTarget, changeOrigin: false },
      "/media": { target: apiTarget, changeOrigin: false },
    },
  },
})
