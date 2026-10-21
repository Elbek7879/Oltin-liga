import { expect, test, type Browser, type Page } from "@playwright/test"
import { collectErrors, loginAsAdmin } from "./helpers"

/**
 * Tashrif statistikasi va maxfiylik siyosati.
 * Oddiy brauzer kabi kirish uchun haqiqiy User-Agent beriladi: test brauzeri (HeadlessChrome) robot sifatida sanalmaydi.
 */

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"

interface Stats {
  today: { visitors: number; views: number }
  pages: { path: string; label: string; views: number }[]
}

const stats = (admin: Page) => admin.evaluate(async () => (await (await fetch("/api/admin/visits")).json()) as Stats)

async function fan(browser: Browser, options: { doNotTrack?: boolean } = {}) {
  const context = await browser.newContext({ userAgent: USER_AGENT })
  if (options.doNotTrack) await context.addInitScript(() => Object.defineProperty(Navigator.prototype, "doNotTrack", { get: () => "1" }))
  return context.newPage()
}

test.describe("Tashrif statistikasi", () => {
  test("muxlis kirgan sahifalar sanaladi: bir odam — bir kishi; tashkilotchi va «Kuzatmang» sanalmaydi", async ({ browser, page }) => {
    await loginAsAdmin(page)
    const before = await stats(page)

    // Muxlis: bosh sahifa, menyudan «Jadval» va «Statistika», keyin jadvalni qayta yuklaydi
    const visitor = await fan(browser)
    const errors = collectErrors(visitor)
    await visitor.goto("/")
    await visitor.getByRole("navigation", { name: "Asosiy menyu" }).getByRole("link", { name: "Jadval" }).click()
    await expect(visitor).toHaveURL(/\/jadval$/)
    await visitor.getByRole("navigation", { name: "Asosiy menyu" }).getByRole("link", { name: "Statistika" }).click()
    await expect(visitor).toHaveURL(/\/statistika$/)
    await visitor.goto("/jadval")
    await expect.poll(async () => (await stats(page)).today.views - before.today.views).toBe(4)
    const after = await stats(page)
    expect(after.today.visitors - before.today.visitors).toBe(1)
    expect(after.pages.find((p) => p.path === "/jadval")?.label).toBe("Turnir jadvali")
    expect(errors).toEqual([])

    // Tizimga kirgan tashkilotchi saytni ko'rsa ham, «Kuzatmang» yoqilgan brauzer ham sanalmaydi
    await page.goto("/jadval")
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    const private_ = await fan(browser, { doNotTrack: true })
    const beacons: string[] = []
    private_.on("request", (r) => r.url().includes("/api/public/visit") && beacons.push(r.url()))
    await private_.goto("/jadval")
    await expect(private_.getByRole("heading", { level: 1 })).toBeVisible()
    await private_.waitForTimeout(500)
    expect(beacons).toEqual([])
    expect((await stats(page)).today.views).toBe(after.today.views)
    await visitor.context().close()
    await private_.context().close()
  })

  test("admin «Tashriflar» bo‘limi: sonlar, 30 kunlik grafik va jadval, sahifalar ro‘yxati", async ({ browser, page }) => {
    const visitor = await fan(browser)
    await visitor.goto("/nizom")
    await expect(visitor.getByRole("heading", { level: 1 })).toBeVisible()
    await visitor.context().close()

    await loginAsAdmin(page)
    await page.getByRole("link", { name: "Tashriflar" }).first().click()
    await expect(page).toHaveURL(/\/admin\/tashriflar$/)
    await expect(page).toHaveTitle("Tashriflar — Boshqaruv paneli")
    await expect(page.getByRole("heading", { name: "Tashriflar", level: 1 })).toBeVisible()
    const tiles = page.getByRole("region", { name: "Tashrif buyuruvchilar soni" })
    for (const label of ["Bugun", "So‘nggi 7 kun", "So‘nggi 30 kun", "Jami"]) await expect(tiles.getByText(label, { exact: true })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Kunlik tashrif buyuruvchilar" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Eng ko‘p ochilgan sahifalar" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Musobaqa nizomi" })).toBeVisible()

    // Grafik klaviatura bilan: strelka chapga — kechagi kun
    const chart = page.getByRole("group", { name: /Kunlik grafik/ })
    await chart.focus()
    await expect(page.getByText(/^Bugun:/)).toBeVisible()
    await page.keyboard.press("ArrowLeft")
    await expect(page.getByText(/^Bugun:/)).toHaveCount(0)

    // Jadval ko'rinishi: 30 kun
    await page.getByText("Jadval ko‘rinishida").click()
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(31)
  })
})

test.describe("Maxfiylik siyosati", () => {
  test("sahifa pastidagi havoladan ochiladi va ma’lumotlar haqida tushuntiradi", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("navigation", { name: "Pastki havolalar" }).getByRole("link", { name: "Maxfiylik siyosati" }).click()
    await expect(page).toHaveURL(/\/maxfiylik$/)
    await expect(page.getByRole("heading", { name: "Maxfiylik siyosati", level: 1 })).toBeVisible()
    for (const section of ["Kim javobgar", "Qanday ma’lumot saqlanadi", "Tashrif statistikasi", "Brauzeringizda nima saqlanadi", "Sizning huquqingiz"]) {
      await expect(page.getByRole("heading", { name: section, level: 2 })).toBeVisible()
    }
    await expect(page.getByRole("heading", { name: "Murojaat uchun" })).toBeVisible()
  })
})
