import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"
import { loginAsAdmin } from "./helpers"

/**
 * Avtomatik accessibility tekshiruvi (WCAG 2.2 AA qoidalari, axe-core).
 * Avtomatik vosita muammolarning bir qismini topadi; klaviatura va ekran o'quvchi
 * bilan qo'lda tekshiruv ham hisobotda alohida yozilgan.
 */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]

const PUBLIC = ["/", "/oyinlar", "/jadval", "/pley-off", "/jamoalar", "/futbolchilar", "/statistika", "/ramziy-jamoa", "/yangiliklar", "/mavsumlar", "/chempionlar", "/homiylar", "/liga-haqida", "/nizom"]
const ADMIN = ["/admin", "/admin/natijalar", "/admin/oyinlar", "/admin/guruhlar", "/admin/jamoalar", "/admin/futbolchilar", "/admin/pley-off", "/admin/ramziy-jamoa", "/admin/mavsumlar", "/admin/yangiliklar", "/admin/homiylar", "/admin/hisobotlar", "/admin/sozlamalar", "/admin/sozlamalar?tab=foydalanuvchilar", "/admin/hisobim"]

async function audit(page: Page, label: string) {
  await page.waitForLoadState("networkidle")
  const result = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  return result.violations.map((v) => ({
    page: label,
    rule: v.id,
    impact: v.impact,
    help: v.help,
    targets: v.nodes.slice(0, 4).map((n) => `${n.target.join(" ")} :: ${n.any[0]?.message ?? ""}`),
  }))
}

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.addInitScript((t) => localStorage.setItem("pol-theme", t), theme)
}

for (const theme of ["light", "dark"] as const) {
  for (const width of [375, 1440]) {
    test(`ommaviy sayt: ${theme} rejim, ${width}px`, async ({ page }) => {
      await setTheme(page, theme)
      await page.setViewportSize({ width, height: 900 })
      const found = []
      for (const url of PUBLIC) {
        await page.goto(url)
        await expect(page.locator("main h1").first()).toBeAttached()
        found.push(...(await audit(page, url)))
      }
      expect(found, JSON.stringify(found, null, 2)).toEqual([])
    })

    test(`admin paneli: ${theme} rejim, ${width}px`, async ({ page }) => {
      await setTheme(page, theme)
      await page.setViewportSize({ width, height: 900 })
      await page.goto("/admin/kirish")
      const found = await audit(page, "/admin/kirish")
      await loginAsAdmin(page)
      for (const url of ADMIN) {
        await page.goto(url)
        await expect(page.locator("main h1").first()).toBeVisible()
        found.push(...(await audit(page, url)))
      }
      // Natija kiritish formasi
      await page.goto("/admin/natijalar")
      await page.locator('[data-testid="admin-match"]').first().getByRole("link", { name: /Natija kiritish|Tahrirlash|Ko‘rish/ }).click()
      await expect(page.getByRole("button", { name: "Natijani saqlash" })).toBeVisible()
      found.push(...(await audit(page, "natija kiritish")))
      // Bayonnoma
      await page.getByRole("link", { name: "Bayonnoma" }).click()
      await expect(page.getByRole("heading", { name: "O‘yin bayonnomasi" })).toBeVisible()
      found.push(...(await audit(page, "bayonnoma")))
      expect(found, JSON.stringify(found, null, 2)).toEqual([])
    })
  }
}

test.describe("Klaviatura bilan boshqarish", () => {
  test("birinchi Tab «Asosiy mazmunga o‘tish» havolasini ochadi va u asosiy qismga olib o‘tadi", async ({ page }) => {
    await page.goto("/")
    await expect(page.locator("main h1").first()).toBeAttached()
    await page.keyboard.press("Tab")
    await expect(page.getByRole("link", { name: "Asosiy mazmunga o‘tish" })).toBeFocused()
    await page.keyboard.press("Enter")
    await page.keyboard.press("Tab")
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest("main")))).toBe(true)
  })

  test("admin dialogi klaviatura bilan ochiladi, fokus ichida qoladi va Esc bilan yopiladi", async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto("/admin/oyinlar")
    const open = page.getByRole("button", { name: "O‘yin qo‘shish" })
    await open.focus()
    await page.keyboard.press("Enter")
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    for (let i = 0; i < 15; i++) await page.keyboard.press("Tab")
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    await page.keyboard.press("Escape")
    await expect(dialog).toBeHidden()
    await expect(open).toBeFocused()
  })
})
