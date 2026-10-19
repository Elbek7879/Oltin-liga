/*
 * Liga logotipidan sayt uchun optimallashtirilgan rasmlarni yasaydi:
 * favicon, sarlavha logotipi (WebP), telefon bosh ekrani ikonkalari va ulashish rasmi.
 * Ishga tushirish: node scripts/brand-assets.mjs  (manba: docs/brand/logo-original.jpg)
 */
import fs from "node:fs"
import path from "node:path"
import { chromium } from "@playwright/test"

const root = path.resolve(import.meta.dirname, "..")
const source = path.resolve(root, "../docs/brand/logo-original.jpg")
const out = path.join(root, "public")
const dataUrl = `data:image/jpeg;base64,${fs.readFileSync(source).toString("base64")}`

// Logotipdagi oltin halqa markazda; doiradan tashqaridagi qora burchaklar kesiladi
const outputs = [
  { file: "brand/logo-96.webp", size: 96, type: "image/webp", circle: true },
  { file: "brand/logo-192.webp", size: 192, type: "image/webp", circle: true },
  { file: "brand/logo-320.webp", size: 320, type: "image/webp", circle: true },
  { file: "favicon-48.png", size: 48, type: "image/png", circle: true },
  { file: "brand/icon-192.png", size: 192, type: "image/png", background: "#0b2e22" },
  { file: "brand/icon-512.png", size: 512, type: "image/png", background: "#0b2e22" },
  { file: "apple-touch-icon.png", size: 180, type: "image/png", background: "#0b2e22" },
  { file: "og-image.jpg", width: 1200, height: 630, type: "image/jpeg", background: "#0b2e22", og: true },
]

const browser = await chromium.launch()
const page = await browser.newPage()
await page.setContent(`<img id="logo" src="${dataUrl}">`)
await page.waitForFunction(() => document.getElementById("logo").complete)

for (const o of outputs) {
  const result = await page.evaluate((o) => {
    const img = document.getElementById("logo")
    const w = o.width ?? o.size
    const h = o.height ?? o.size
    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext("2d")
    ctx.imageSmoothingQuality = "high"
    if (o.background) {
      ctx.fillStyle = o.background
      ctx.fillRect(0, 0, w, h)
    }
    if (o.og) {
      // Ulashish rasmi: logotip markazda, maydon fonida
      const s = 520
      ctx.save()
      ctx.beginPath()
      ctx.arc(w / 2, h / 2, s * 0.488, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(img, (w - s) / 2, (h - s) / 2, s, s)
      ctx.restore()
    } else {
      const s = o.background ? Math.round(w * 0.9) : w
      const x = (w - s) / 2
      if (o.circle || o.background) {
        ctx.beginPath()
        ctx.arc(w / 2, h / 2, s * 0.488, 0, Math.PI * 2)
        ctx.clip()
      }
      ctx.drawImage(img, x, x, s, s)
    }
    return canvas.toDataURL(o.type, o.type === "image/png" ? undefined : 0.88)
  }, o)
  const base64 = result.split(",")[1]
  const target = path.join(out, o.file)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, Buffer.from(base64, "base64"))
  console.log(`${o.file}  ${(fs.statSync(target).size / 1024).toFixed(1)} KB`)
}
await browser.close()
