import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"
import { collectErrors, loginAsAdmin, noHorizontalScroll, openNewDraftSeason, TINY_PNG } from "./helpers"

/** Saytdagi «Murojaat» bo'limi va admin panelidagi «Arizalar» */

/** Ma'lumot bilan to'lgan holatda ham WCAG 2.2 AA (a11y.spec bo'sh holatni tekshiradi) */
async function noA11yViolations(page: Page) {
  // Bildirishnoma (toast) paydo bo'layotganda yarim shaffof — kontrast animatsiya tugagach tekshiriladi
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"))
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze()
  expect(result.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(", ")}`)).toEqual([])
}

async function fillTeamApplication(page: Page, team: string) {
  await page.getByLabel("Jamoa nomi").fill(team)
  await page.locator('input[type="file"]').setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: TINY_PNG })
  await expect(page.getByAltText("Tanlangan logotip")).toBeVisible()
  for (let i = 0; i < 10; i++) {
    await page.locator(`#ap-p${i}-first`).fill(`Futbolchi${String.fromCharCode(65 + i)}`)
    await page.locator(`#ap-p${i}-last`).fill("Sinovov")
    await page.locator(`#ap-p${i}-pos`).click()
    await page.getByRole("option", { name: i === 0 ? "Darvozabon" : i < 4 ? "Himoyachi" : "Hujumchi", exact: true }).click()
  }
  await expect(page.getByText("10/10 to‘ldirildi")).toBeVisible()
  await page.getByRole("checkbox", { name: /Ogohlantirish bilan tanishdim/ }).click()
}

test.describe("murojaat va arizalar", () => {
  test("jamoa saytdan ariza yuboradi, admin belgini ko‘radi va qabul qiladi — jamoa yangi mavsumga 10 futbolchi bilan qo‘shiladi", async ({ page }) => {
    const errors = collectErrors(page)
    const team = `Ariza ${Date.now().toString(36)}`
    await page.setViewportSize({ width: 375, height: 800 })
    await page.goto("/murojaat")
    await page.getByRole("link", { name: /Yangi mavsumga ariza/ }).click()
    await expect(page.getByRole("note")).toContainText("shu nom")

    // Bo'sh forma yuborilmaydi: sababi har maydon ostida
    await page.getByRole("button", { name: "Arizani yuborish" }).click()
    await expect(page.getByText("Jamoa nomini kiriting (kamida 2 ta belgi)")).toBeVisible()
    await expect(page.getByText("Jamoa logotipini tanlang.")).toBeVisible()
    await expect(page.getByLabel("Jamoa nomi")).toBeFocused()
    await noA11yViolations(page)

    await fillTeamApplication(page, team)
    await noHorizontalScroll(page)
    await page.getByRole("button", { name: "Arizani yuborish" }).click()
    await expect(page.getByRole("heading", { name: "Arizangiz yuborildi" })).toBeVisible()

    // Shu nomli ariza ko'rib chiqilmoqda — ikkinchisi qabul qilinmaydi
    await page.getByRole("button", { name: "Yana murojaat yuborish" }).click()
    await page.getByRole("link", { name: /Yangi mavsumga ariza/ }).click()
    await fillTeamApplication(page, team.toUpperCase())
    await page.getByRole("button", { name: "Arizani yuborish" }).click()
    await expect(page.getByRole("alert").filter({ hasText: "ko‘rib chiqilmoqda" })).toBeVisible()

    await page.setViewportSize({ width: 1440, height: 900 })
    await loginAsAdmin(page)
    await expect(page.getByRole("link", { name: /^Arizalar \(\d+ ta yangi\)$/ }).first()).toBeVisible()
    const season = await openNewDraftSeason(page)

    await page.goto("/admin/arizalar")
    const card = page.getByRole("article", { name: team })
    await expect(card).toContainText("Futbolchilar (10)")
    await noA11yViolations(page)
    await card.getByRole("button", { name: "Qabul qilish" }).click()
    // Mavsum tanlanmaydi — jamoa o'zi yangi (tayyorlanayotgan) mavsumga qo'shiladi
    const dialog = page.getByRole("dialog")
    await expect(dialog).toContainText(`Jamoa qo‘shiladigan mavsum: ${season}`)
    await expect(dialog.getByRole("combobox")).toHaveCount(0)
    await dialog.getByRole("button", { name: "Qabul qilish" }).click()
    await expect(page.getByText(`«${team}» ${season}ga qo‘shildi: 10 ta futbolchi tarkibga yozildi.`)).toBeVisible()

    // Endi «Ko‘rib chiqilgan» ro'yxatida, jamoa esa «Jamoalar» bo'limida
    await page.getByRole("button", { name: /Ko‘rib chiqilgan/ }).click()
    await expect(page.getByRole("article", { name: team })).toContainText(`${season}ga qo‘shilgan`)
    await noA11yViolations(page)
    await page.goto("/admin/jamoalar")
    await expect(page.getByText(team, { exact: true }).first()).toBeVisible()
    expect(errors.filter((e) => !e.includes("409"))).toEqual([])
  })

  test("taklif yoki shikoyat: muxlis matn yuboradi, admin «Taklif va shikoyatlar»da o‘qiydi", async ({ page }) => {
    const body = `Sinov shikoyati ${Date.now().toString(36)}: o‘yin vaqti oldindan e’lon qilinsin`
    await page.goto("/murojaat?tur=taklif")
    await page.getByRole("button", { name: "Yuborish" }).click()
    await expect(page.getByText("Murojaat turini tanlang")).toBeVisible()
    await page.getByText("Shikoyat", { exact: true }).click()
    await page.getByLabel("Matn").fill(body)
    await page.getByLabel("Ismingiz").fill("Sinov muxlisi")
    await page.getByRole("button", { name: "Yuborish" }).click()
    await expect(page.getByRole("heading", { name: "Murojaatingiz yuborildi" })).toBeVisible()

    await loginAsAdmin(page)
    await page.goto("/admin/arizalar?tur=murojaat")
    const message = page.getByRole("article").filter({ hasText: body })
    await expect(message).toContainText("Shikoyat")
    await expect(message).toContainText("Sinov muxlisi")
    await noA11yViolations(page)
    await message.getByRole("button", { name: "O‘qildi" }).click()
    await expect(message.getByText("Yangi", { exact: true })).toHaveCount(0)
  })
})
