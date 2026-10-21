import { expect, test, type APIRequestContext, type Page } from "@playwright/test"
import { collectErrors, loginAsAdmin } from "./helpers"

/**
 * Google va Telegram uchun: har bir sahifaning o'z nomi va tavsifi bor; server sahifani qaysi nom bilan bersa,
 * sayt ichida o'tilganda ham aynan shu nom qo'yiladi; admin panel va «topilmadi» Google'ga ko'rsatilmaydi;
 * robots.txt va sitemap.xml dagi barcha manzillar ochiladi.
 */

const BACKEND = "http://localhost:18081"
const STATIC = ["/", "/oyinlar", "/jadval", "/pley-off", "/jamoalar", "/futbolchilar", "/statistika", "/ramziy-jamoa", "/yangiliklar", "/mavsumlar", "/chempionlar", "/homiylar", "/liga-haqida", "/nizom", "/maxfiylik"]

const decode = (s: string) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")

/** Server bergan sahifa: holat kodi, nom, tavsif va asosiy manzil */
async function serverPage(request: APIRequestContext, path: string) {
  const res = await request.get(BACKEND + path)
  const html = await res.text()
  const pick = (re: RegExp) => {
    const m = html.match(re)
    return m ? decode(m[1]) : null
  }
  return {
    status: res.status(),
    title: pick(/<title>([^<]*)<\/title>/),
    description: pick(/<meta name="description" content="([^"]*)"/),
    canonical: pick(/<link rel="canonical" href="([^"]*)"/),
  }
}

/** Server sahifa nomini o'zi qo'yadimi (backend static papkasida markerli yangi build bo'lsa) */
async function serverRendersMeta(request: APIRequestContext) {
  const page = await serverPage(request, "/jadval")
  return page.title?.startsWith("Turnir jadvali") ?? false
}

/** Ro'yxat sahifasidagi birinchi ichki havola (masalan, /jamoalar → /jamoalar/<id>) */
async function firstLink(page: Page, list: string, prefix: string) {
  await page.goto(list)
  const link = page.locator(`main a[href^="${prefix}"]`).first()
  await link.waitFor()
  return (await link.getAttribute("href"))!.split("?")[0]
}

async function clientMeta(page: Page) {
  return page.evaluate(() => ({
    description: document.querySelector('meta[name="description"]')?.getAttribute("content") ?? null,
    canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null,
    robots: document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? null,
    titles: document.querySelectorAll("title").length,
  }))
}

test.describe("Google uchun sahifa nomlari", () => {
  test("har bir ommaviy sahifaning o‘z nomi bor va u server bergan nom bilan bir xil", async ({ page, request }) => {
    test.setTimeout(3 * 60_000)
    const errors = collectErrors(page)
    const ssr = await serverRendersMeta(request)
    const dynamic = [
      await firstLink(page, "/jamoalar", "/jamoalar/"),
      await firstLink(page, "/futbolchilar", "/futbolchilar/"),
      await firstLink(page, "/oyinlar?tab=natijalar", "/oyinlar/"),
      await firstLink(page, "/yangiliklar", "/yangiliklar/"),
    ]
    const titles: string[] = []
    for (const path of [...STATIC, ...dynamic]) {
      await page.goto(path)
      // Sahifa o'z nomini qo'ygani asosiy manzildan bilinadi (index.html da u yo'q)
      await expect.poll(async () => new URL((await clientMeta(page)).canonical ?? "http://x/-").pathname, path).toBe(path)
      if (ssr) {
        const server = await serverPage(request, path)
        expect(server.status, path).toBe(200)
        await expect(page, path).toHaveTitle(server.title!)
        expect((await clientMeta(page)).description, path).toBe(server.description)
        expect(new URL(server.canonical!).pathname, path).toBe(path)
      }
      const client = await clientMeta(page)
      expect(client.titles, `${path}: <title> bitta`).toBe(1)
      expect(client.robots, `${path}: Google'dan yashirilmagan`).toBeNull()
      titles.push(await page.title())
    }
    expect(new Set(titles).size, titles.join("\n")).toBe(titles.length)
    if (!ssr) test.info().annotations.push({ type: "eslatma", description: "backend static papkasida eski build — server nomi tekshirilmadi" })
    expect(errors).toEqual([])
  })

  test("sayt ichida o‘tilganda nom yangilanadi, orqaga qaytilganda ham to‘g‘ri; kirill yozuvida yorliq kirillcha", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveTitle(/ — o‘yinlar, natijalar va turnir jadvali$/)
    await page.getByRole("navigation", { name: "Asosiy menyu" }).getByRole("link", { name: "Jadval" }).click()
    await expect(page).toHaveTitle(/^Turnir jadvali — /)
    await page.getByRole("navigation", { name: "Asosiy menyu" }).getByRole("link", { name: "Jamoalar" }).click()
    await expect(page).toHaveTitle(/^Jamoalar — /)
    await page.locator('main a[href^="/jamoalar/"]').first().click()
    const name = (await page.locator("main h1").first().innerText()).trim()
    await expect(page).toHaveTitle(new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} — `))
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /tarkib va mavsumlar bo‘yicha statistika\.$/)
    await page.goBack()
    await expect(page).toHaveTitle(/^Jamoalar — /)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/jamoalar$/)

    // Kirill: yorliqdagi nom kirillcha, Google uchun tavsif lotincha qoladi
    await page.evaluate(() => localStorage.setItem("pol-script", "cyrl"))
    await page.goto("/jadval")
    await expect(page).toHaveTitle(/^Турнир жадвали — /)
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /^Guruhlar jadvali/)
    await page.evaluate(() => localStorage.removeItem("pol-script"))
  })

  test("topilmagan sahifa, admin panel va kirish sahifasi Google’ga ko‘rsatilmaydi", async ({ page, request }) => {
    const ssr = await serverRendersMeta(request)
    for (const path of ["/mavjud-emas-sahifa", "/jamoalar/00000000-0000-0000-0000-000000000000"]) {
      await page.goto(path)
      await expect(page, path).toHaveTitle(/^Sahifa topilmadi — /)
      const client = await clientMeta(page)
      expect(client.robots, path).toBe("noindex")
      expect(client.canonical, path).toBeNull()
      if (ssr) expect((await serverPage(request, path)).status, path).toBe(404)
    }
    await page.goto("/admin/kirish")
    await expect(page).toHaveTitle("Kirish — Boshqaruv paneli")
    expect((await clientMeta(page)).robots).toBe("noindex")
    await loginAsAdmin(page)
    await page.goto("/admin/natijalar")
    await expect(page).toHaveTitle("Natijalar — Boshqaruv paneli")
    expect((await clientMeta(page)).robots).toBe("noindex")
    // Ommaviy saytga qaytilganda noindex olib tashlanadi
    await page.goto("/jadval")
    await expect(page).toHaveTitle(/^Turnir jadvali — /)
    expect((await clientMeta(page)).robots).toBeNull()
  })

  test("robots.txt admin va API ni yopadi; sitemap.xml dagi har bir manzil ochiladi", async ({ request }) => {
    const robots = await request.get(`${BACKEND}/robots.txt`)
    expect(robots.status()).toBe(200)
    const robotsText = await robots.text()
    expect(robotsText).toContain("Disallow: /admin")
    expect(robotsText).toContain("Disallow: /api/")
    expect(robotsText).toContain(`Sitemap: ${BACKEND}/sitemap.xml`)

    const sitemap = await request.get(`${BACKEND}/sitemap.xml`)
    expect(sitemap.status()).toBe(200)
    expect(sitemap.headers()["content-type"]).toContain("xml")
    const locs = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1]))
    for (const p of STATIC) expect(locs).toContain(BACKEND + p)
    for (const prefix of ["/jamoalar/", "/futbolchilar/", "/oyinlar/", "/yangiliklar/"]) expect(locs.some((l) => l.startsWith(BACKEND + prefix)), prefix).toBe(true)
    expect(locs.some((l) => l.includes("/admin")), "admin sitemap'da yo'q").toBe(false)
    expect(new Set(locs).size).toBe(locs.length)
    // Har bir manzil haqiqatan ochiladi (Google 404 topmasin)
    const failed: string[] = []
    for (const loc of locs) {
      const res = await request.get(loc)
      if (res.status() !== 200) failed.push(`${res.status()} ${loc}`)
    }
    expect(failed).toEqual([])
  })
})
