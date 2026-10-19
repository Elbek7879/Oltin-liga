/*
 * Core Web Vitals laboratoriya o'lchovi (Playwright + Chromium).
 * Telefon sharoiti: 375px ekran, CPU 4 marta sekin, «Slow 4G» tarmoq (150 ms, 1.6 Mbit/s), bo'sh kesh.
 * Ishga tushirish: node scripts/web-vitals.mjs http://127.0.0.1:18090 [slow4g|4g]
 * slow4g (standart) — og'ir sharoit; 4g — oddiy mobil internet (40 ms, 9 Mbit/s, CPU 2x).
 * Eslatma: bu laboratoriya natijasi; haqiqiy foydalanuvchilar ko'rsatkichi (field data) sayt ishga tushgach yig'iladi.
 */
import { chromium, devices } from "@playwright/test"

const base = process.argv[2] ?? "http://127.0.0.1:18090"
const PROFILES = {
  slow4g: { latency: 150, mbit: 1.6, cpu: 4 },
  "4g": { latency: 40, mbit: 9, cpu: 2 },
}
const profile = PROFILES[process.argv[3] ?? "slow4g"]
const pages = [
  { path: "/", name: "Bosh sahifa" },
  { path: "/jadval", name: "Turnir jadvali" },
  { path: "/oyinlar", name: "O‘yinlar", interact: { role: "tab", name: "Natijalar" } },
  { path: "/statistika", name: "Statistika", interact: { role: "tab", name: "Assistlar" } },
  { path: "/admin/kirish", name: "Admin: kirish" },
]

const observers = () => {
  window.__lcp = 0
  window.__cls = 0
  window.__inp = 0
  new PerformanceObserver((l) => l.getEntries().forEach((e) => (window.__lcp = e.startTime))).observe({ type: "largest-contentful-paint", buffered: true })
  new PerformanceObserver((l) => l.getEntries().forEach((e) => !e.hadRecentInput && (window.__cls += e.value))).observe({ type: "layout-shift", buffered: true })
  new PerformanceObserver((l) => l.getEntries().forEach((e) => (window.__inp = Math.max(window.__inp, e.duration)))).observe({ type: "event", buffered: true, durationThreshold: 16 })
}

const browser = await chromium.launch()
const rows = []
for (const p of pages) {
  const context = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 375, height: 812 } })
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send("Network.enable")
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: profile.latency, downloadThroughput: (profile.mbit * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 })
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: profile.cpu })
  await page.addInitScript(observers)
  await page.goto(base + p.path, { waitUntil: "networkidle" })
  await page.waitForTimeout(1000)
  if (p.interact) {
    await page.getByRole(p.interact.role, { name: p.interact.name }).click()
    await page.waitForTimeout(800)
  }
  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0]
    const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0
    const bytes = performance.getEntriesByType("resource").reduce((s, r) => s + (r.transferSize || 0), nav.transferSize || 0)
    return { ttfb: nav.responseStart, fcp, lcp: window.__lcp, cls: window.__cls, inp: window.__inp, kb: bytes / 1024 }
  })
  rows.push({ sahifa: p.name, TTFB_ms: Math.round(m.ttfb), FCP_ms: Math.round(m.fcp), LCP_ms: Math.round(m.lcp), CLS: +m.cls.toFixed(3), INP_ms: p.interact ? Math.round(m.inp) : "—", yuklandi_KB: Math.round(m.kb) })
  await context.close()
}
await browser.close()
console.table(rows)
const bad = rows.filter((r) => r.LCP_ms > 2500 || r.CLS > 0.1 || (typeof r.INP_ms === "number" && r.INP_ms > 200))
console.log(bad.length ? `Me'yordan oshgan: ${bad.map((r) => r.sahifa).join(", ")}` : "Hamma sahifalar me'yorda: LCP < 2.5 s, CLS < 0.1, INP < 200 ms")
