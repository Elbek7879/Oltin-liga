import { expect, test, type Page } from "@playwright/test"
import { loginAsAdmin } from "./helpers"

/**
 * Sayt bo'ylab to'liq aylanish: ommaviy saytdagi har bir sahifa va undagi ichki havolalar,
 * admin panelining barcha bo'limlari va har bir rol uchun ruxsatlar.
 * Har sahifada tekshiriladi: konsol va JS xatosi yo'q, server 4xx/5xx qaytarmaydi,
 * «Ma'lumotni yuklab bo'lmadi» yoki «Sahifa topilmadi» chiqmaydi, rasm buzilmagan,
 * gorizontal scroll yo'q (375, 768 va 1440 px).
 */

const WIDTHS = [375, 768, 1440]
const PUBLIC = ["/", "/oyinlar", "/oyinlar?tab=natijalar", "/jadval", "/pley-off", "/jamoalar", "/futbolchilar", "/statistika", "/ramziy-jamoa", "/yangiliklar", "/mavsumlar", "/chempionlar", "/homiylar", "/liga-haqida", "/nizom", "/maxfiylik"]
const ADMIN = [
  "/admin",
  "/admin/mavsumlar",
  "/admin/jamoalar",
  "/admin/futbolchilar",
  "/admin/guruhlar",
  "/admin/oyinlar",
  "/admin/natijalar",
  "/admin/pley-off",
  "/admin/ramziy-jamoa",
  "/admin/yangiliklar",
  "/admin/homiylar",
  "/admin/hisobotlar",
  "/admin/tashriflar",
  "/admin/sozlamalar",
  "/admin/sozlamalar?tab=foydalanuvchilar",
  "/admin/hisobim",
]
/** Bitta yo'nalishdagi (masalan, /jamoalar/:id) nechta sahifa ochiladi */
const PER_PATTERN = 4

interface Problem {
  url: string
  width: number
  kind: string
  detail: string
}

function watch(page: Page) {
  const found: { kind: string; detail: string }[] = []
  page.on("console", (m) => {
    if (m.type() === "error") found.push({ kind: "konsol", detail: m.text() })
  })
  page.on("pageerror", (e) => found.push({ kind: "JS xato", detail: e.message }))
  page.on("response", (r) => {
    if (r.status() >= 400) found.push({ kind: `HTTP ${r.status()}`, detail: r.url() })
  })
  page.on("requestfailed", (r) => {
    const reason = r.failure()?.errorText ?? ""
    // Sahifa almashganda bekor qilingan so'rovlar (jonli oqim, rasm) xato emas
    if (!/ERR_ABORTED|NS_BINDING_ABORTED/.test(reason)) found.push({ kind: "so‘rov uzildi", detail: `${r.url()} ${reason}` })
  })
  return found
}

/** /jamoalar/abc-123 → /jamoalar/:id — bir xil sahifalarni cheklash uchun */
function pattern(url: string) {
  const [path, query = ""] = url.split("?")
  const p = path.replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "/:id").replace(/^\/yangiliklar\/.+/, "/yangiliklar/:slug")
  return query ? `${p}?${query.replace(/=[^&]*/g, "=")}` : p
}

/** Sahifani ochib tekshiradi; ichki havolalarni qaytaradi */
async function inspect(page: Page, found: { kind: string; detail: string }[], url: string, width: number, problems: Problem[]) {
  found.length = 0
  await page.goto(url)
  await page.waitForLoadState("networkidle")
  await expect(page.locator("main h1").first(), `${url}: sarlavha chiqmadi`).toBeAttached({ timeout: 15_000 })
  const report = await page.evaluate(() => {
    const text = document.querySelector("main")?.textContent ?? ""
    const broken = [...document.images].filter((img) => img.complete && img.currentSrc && img.naturalWidth === 0).map((img) => img.currentSrc)
    const links = [...document.querySelectorAll<HTMLAnchorElement>("a[href]")]
      .map((a) => a.getAttribute("href") ?? "")
      .filter((h) => h.startsWith("/") && !h.startsWith("//"))
      .map((h) => h.split("#")[0])
    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      broken,
      links,
      error: text.includes("Ma’lumotni yuklab bo‘lmadi") || text.includes("Маълумотни юклаб бўлмади"),
      notFound: /Sahifa topilmadi|Саҳифа топилмади/.test(document.querySelector("main h1")?.textContent ?? ""),
      roleClosed: text.includes("Bu bo‘lim sizning rolingiz uchun yopiq"),
    }
  })
  const add = (kind: string, detail: string) => problems.push({ url, width, kind, detail })
  if (report.overflow > 0) add("gorizontal scroll", `${report.overflow}px`)
  for (const src of report.broken) add("buzilgan rasm", src)
  if (report.error) add("xato holati", "«Ma’lumotni yuklab bo‘lmadi»")
  if (report.notFound) add("404", "«Sahifa topilmadi»")
  for (const f of found) add(f.kind, f.detail)
  return { links: report.links, roleClosed: report.roleClosed }
}

/** Boshlang'ich sahifalardan ichki havolalar bo'ylab yuradi (har yo'nalishdan PER_PATTERN tagacha) */
async function crawl(page: Page, start: string[], width: number, keep: (href: string) => boolean, problems: Problem[], perPattern = PER_PATTERN) {
  const found = watch(page)
  const queue = [...start]
  const seen = new Set<string>()
  const perKey = new Map<string, number>()
  let visited = 0
  while (queue.length) {
    const url = queue.shift()!
    if (seen.has(url)) continue
    seen.add(url)
    const key = pattern(url)
    if ((perKey.get(key) ?? 0) >= perPattern) continue
    perKey.set(key, (perKey.get(key) ?? 0) + 1)
    const { links } = await inspect(page, found, url, width, problems)
    visited++
    for (const href of links) if (keep(href) && !seen.has(href)) queue.push(href)
  }
  return visited
}

const isPublic = (href: string) => !href.startsWith("/admin") && !href.startsWith("/api") && !href.startsWith("/media") && !href.startsWith("/brand")
const isAdmin = (href: string) => href.startsWith("/admin") && !href.startsWith("/admin/kirish")

test.describe("Sayt bo‘ylab to‘liq aylanish", () => {
  test.setTimeout(20 * 60_000)

  for (const width of WIDTHS) {
    test(`ommaviy sayt va barcha ichki havolalar, ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      const problems: Problem[] = []
      // Kompyuterda barcha havolalar, telefon va planshetda har yo'nalishdan bittadan
      const visited = await crawl(page, PUBLIC, width, isPublic, problems, width === 1440 ? PER_PATTERN : 1)
      // Arxiv mavsumi ham ochilsin
      const archive = await page.evaluate(async () => {
        const seasons = (await (await fetch("/api/public/seasons")).json()) as { id: string; status: string }[]
        return seasons.find((s) => s.status === "FINISHED")?.id ?? null
      })
      if (archive) await crawl(page, ["/", "/jadval", "/pley-off", "/statistika"].map((p) => `${p}?mavsum=${archive}`), width, () => false, problems)
      // Mavjud bo'lmagan sahifa chiroyli 404 bilan chiqadi va xatosiz
      await page.goto("/mavjud-emas-sahifa")
      await expect(page.getByRole("heading", { name: "Sahifa topilmadi" })).toBeVisible()
      // Tekshiruvning o'zi ishlayaptimi: ataylab noto'g'ri manzillarda muammo topilishi shart
      const control: Problem[] = []
      const found = watch(page)
      await inspect(page, found, "/mavjud-emas-sahifa", width, control)
      await inspect(page, found, "/jamoalar/00000000-0000-0000-0000-000000000000", width, control)
      expect(control.map((c) => c.kind), "tekshiruv 404 ni ushlamadi").toContain("404")
      expect(control.filter((c) => c.url.startsWith("/jamoalar/")).length, "tekshiruv noto‘g‘ri jamoa sahifasini ushlamadi").toBeGreaterThan(0)
      console.log(`${width}px: ${visited} ta ommaviy sahifa tekshirildi`)
      expect(problems, JSON.stringify(problems, null, 2)).toEqual([])
    })

    test(`admin paneli: barcha bo‘limlar, natija va bayonnoma sahifalari, ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await loginAsAdmin(page)
      const problems: Problem[] = []
      const visited = await crawl(page, ADMIN, width, isAdmin, problems, width === 1440 ? PER_PATTERN : 1)
      console.log(`${width}px: ${visited} ta admin sahifasi tekshirildi`)
      expect(problems, JSON.stringify(problems, null, 2)).toEqual([])
    })
  }
})

test.describe("Kirill yozuvida ham butun sayt sig'adi va xatosiz ishlaydi", () => {
  test.setTimeout(15 * 60_000)

  for (const width of [375, 1440]) {
    test(`kirill: ommaviy sayt va admin paneli, ${width}px`, async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem("pol-script", "cyrl"))
      await page.setViewportSize({ width, height: 900 })
      const problems: Problem[] = []
      await crawl(page, PUBLIC, width, isPublic, problems, 1)
      await expect(page.locator("html")).toHaveAttribute("lang", "uz-Cyrl")
      // Matn haqiqatan kirillcha: sarlavhada lotin harfi qolmagan
      await page.goto("/jadval")
      await expect(page.locator("main h1").first()).not.toHaveText(/[A-Za-z]/)
      await loginAsAdmin(page)
      await crawl(page, ADMIN, width, isAdmin, problems, 1)
      expect(problems, JSON.stringify(problems, null, 2)).toEqual([])
    })
  }
})

/** Brauzer ichidan CSRF bilan API so'rovi — javob holat kodini qaytaradi */
async function api(page: Page, method: string, url: string, body?: unknown) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const read = () => document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/)?.[1]
      if (!read()) await fetch("/api/auth/me")
      const token = read()
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...(token ? { "X-XSRF-TOKEN": decodeURIComponent(token) } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      return res.status
    },
    { method, url, body },
  )
}

test.describe("Rollar: har bir yordamchi faqat o‘z bo‘limlarini ko‘radi va o‘zgartira oladi", () => {
  test.setTimeout(10 * 60_000)

  const ROLES = [
    { role: "ADMIN", open: ADMIN.filter((u) => !u.startsWith("/admin/sozlamalar")), closed: [] as string[] },
    { role: "RESULT_ENTRY", open: ["/admin", "/admin/natijalar", "/admin/hisobotlar", "/admin/hisobim"], closed: ["/admin/jamoalar", "/admin/oyinlar", "/admin/ramziy-jamoa", "/admin/yangiliklar", "/admin/sozlamalar", "/admin/tashriflar"] },
    { role: "EDITOR", open: ["/admin", "/admin/yangiliklar", "/admin/homiylar", "/admin/hisobim"], closed: ["/admin/jamoalar", "/admin/natijalar", "/admin/guruhlar", "/admin/ramziy-jamoa", "/admin/sozlamalar"] },
  ] as const
  const missing = "00000000-0000-0000-0000-000000000000"

  test("rollar bo‘yicha sahifalar va server ruxsatlari", async ({ page, browser }) => {
    await loginAsAdmin(page)
    // Bosh tashkilotchi uchun nazorat: mavjud bo'lmagan jamoani o'chirish — 404 (ruxsat bor, faqat topilmadi)
    expect(await api(page, "DELETE", `/api/admin/teams/${missing}`)).toBe(404)

    for (const { role, open, closed } of ROLES) {
      const username = `sinov_${role.toLowerCase()}`
      const password = `Sinov-${role}-2026`
      const created = await api(page, "POST", "/api/admin/users", { username, displayName: `Sinov ${role}`, role, password })
      expect(created, `${role} yaratilmadi`).toBe(200)

      const ctx = await browser.newContext({ baseURL: test.info().project.use.baseURL })
      const p = await ctx.newPage()
      const found = watch(p)
      const problems: Problem[] = []
      await p.goto("/admin/kirish")
      await p.getByLabel("Login").fill(username)
      await p.getByLabel("Parol", { exact: true }).fill(password)
      await p.getByRole("button", { name: "Kirish" }).click()
      await expect(p).toHaveURL(/\/admin$/)
      for (const url of open) {
        const { roleClosed } = await inspect(p, found, url, 1440, problems)
        expect(roleClosed, `${role}: ${url} ochiq bo‘lishi kerak`).toBe(false)
      }
      for (const url of closed) {
        await p.goto(url)
        await expect(p.getByText("Bu bo‘lim sizning rolingiz uchun yopiq"), `${role}: ${url} yopiq bo‘lishi kerak`).toBeVisible()
      }
      // Server ham ruxsat bermaydi (interfeysni chetlab o'tilsa ham)
      if (role === "ADMIN") expect(await api(p, "GET", "/api/admin/users")).toBe(403)
      if (role === "RESULT_ENTRY") {
        expect(await api(p, "DELETE", `/api/admin/teams/${missing}`)).toBe(403)
        expect(await api(p, "DELETE", `/api/admin/news/${missing}`)).toBe(403)
      }
      if (role === "EDITOR") {
        expect(await api(p, "DELETE", `/api/admin/teams/${missing}`)).toBe(403)
        expect(await api(p, "DELETE", `/api/admin/news/${missing}`)).toBe(404)
      }
      // Ochiq sahifalarda kutilgan 403 lar bo'lmasligi kerak; API sinovlaridagi 403/404 hisobga olinmaydi
      const pageProblems = problems.filter((x) => !(x.kind.startsWith("HTTP 40") && x.detail.includes(missing)))
      expect(pageProblems, JSON.stringify(pageProblems, null, 2)).toEqual([])
      await ctx.close()
    }
  })
})
