/*
 * Haqiqiy ishlayotgan saytdan skrinshotlar oladi (bosqich hisoboti uchun).
 * Natija: docs/screenshots/06-bosqich/*.png
 * 6-bosqich: jahon chempionati tizimi — moslashuvchan guruhlar va pley-off, tezkor gol/kartochka,
 * diskvalifikatsiya, natija rasmi, bayonnoma, «Mening jamoam», nizom va mavsum yo'l xaritasi.
 */
import path from "node:path"
import { expect, test, type Page } from "@playwright/test"
import { loginAsAdmin } from "./helpers"

const OUT = path.resolve(import.meta.dirname, "../../docs/screenshots/06-bosqich")
const SIZES = { telefon: { width: 375, height: 812 }, kompyuter: { width: 1440, height: 900 } }

async function shot(page: Page, name: string, fullPage = true) {
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(600)
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage })
}

test.describe.configure({ mode: "serial" })

test("muxlis: jadval, pley-off, nizom, «Mening jamoam» va natija rasmi", async ({ page }) => {
  test.setTimeout(240_000)
  for (const size of ["kompyuter", "telefon"] as const) {
    await page.setViewportSize(SIZES[size])
    await page.goto("/")
    await expect(page.getByRole("heading", { name: "Mening jamoam" })).toBeVisible()
    await shot(page, `m01-bosh-sahifa-taklif-${size}`, false)
    await page.goto("/jadval")
    await shot(page, `m02-jadval-${size}`)
    await page.goto("/pley-off")
    await shot(page, `m03-pley-off-${size}`)
    await page.goto("/nizom")
    await shot(page, `m04-nizom-${size}`)
    await page.goto("/statistika?tab=kartochkalar")
    await shot(page, `m05-diskvalifikatsiya-${size}`, false)
  }

  // «Mening jamoam»: jamoa sahifasida yulduzcha → bosh sahifada jamoa holati
  await page.setViewportSize(SIZES.telefon)
  await page.goto("/jamoalar")
  await page.locator('main a[href^="/jamoalar/"]').first().click()
  await page.getByRole("button", { name: "Mening jamoam qilish" }).click()
  await shot(page, "m06-jamoa-sahifasi-telefon", false)
  await page.goto("/")
  await page.locator("#my-team-title").scrollIntoViewIfNeeded()
  await shot(page, "m07-mening-jamoam-telefon", false)

  // O'yin sahifasidan natija rasmi
  await page.setViewportSize(SIZES.kompyuter)
  await page.goto("/oyinlar?tab=natijalar")
  await page.locator('main a[href^="/oyinlar/"]').first().click()
  await page.getByRole("button", { name: "Natija rasmi" }).click()
  await expect(page.getByRole("dialog").getByRole("img")).toBeVisible({ timeout: 15_000 })
  await shot(page, "m08-natija-rasmi-kompyuter", false)
})

test("tashkilotchi: yo‘l xaritasi, futbolchilar, tezkor gol, pley-off va bayonnoma", async ({ page }) => {
  test.setTimeout(240_000)
  await page.setViewportSize(SIZES.kompyuter)
  await loginAsAdmin(page)
  await shot(page, "a01-boshqaruv-paneli-kompyuter", false)
  await page.getByText("Barcha bosqichlar").click()
  await page.getByRole("region", { name: "Mavsum bosqichlari" }).screenshot({ path: path.join(OUT, "a02-yol-xaritasi.png") })

  // Jamoa qo'shish oynasida ixtiyoriy futbolchilar bo'limi
  await page.goto("/admin/jamoalar")
  await page.getByRole("button", { name: "Jamoa qo‘shish" }).click()
  await page.getByLabel("Jamoa nomi").fill("Yangi Hayot")
  await page.getByRole("button", { name: /Futbolchilarni hozir kiritish/ }).click()
  await page.getByRole("button", { name: "Ro‘yxatni qo‘yish" }).click()
  await page.getByLabel("Har qatorda bitta futbolchi").fill("1 Karimov Sardor darvozabon\n5 Toshmatov Anvar\n10 Aliyev Vali hujumchi")
  await page.getByRole("button", { name: "Qatorlarga ajratish" }).click()
  await shot(page, "a03-jamoa-va-futbolchilar-kompyuter", false)
  await page.keyboard.press("Escape")

  // Futbolchilarni ro'yxat bilan qo'shish (xato qatorlar darhol ko'rsatiladi)
  await page.goto("/admin/futbolchilar")
  await page.getByRole("button", { name: "Ro‘yxatdan qo‘shish" }).click()
  await shot(page, "a04-royxatdan-qoshish-kompyuter", false)
  await page.keyboard.press("Escape")

  await page.goto("/admin/guruhlar")
  await shot(page, "a05-guruhlar-qura-kompyuter")
  await page.goto("/admin/sozlamalar")
  await shot(page, "a06-sozlamalar-qoidalar-kompyuter")

  // Natija kiritish: «Gol» → o'yinchini bosish (saqlanmaydi)
  for (const size of ["kompyuter", "telefon"] as const) {
    await page.setViewportSize(SIZES[size])
    await page.goto("/admin/natijalar")
    const item = page.locator('[data-testid="admin-match"][data-status="SCHEDULED"]').first()
    const home = (await item.getAttribute("data-home-name"))!
    await item.getByRole("link", { name: "Natija kiritish" }).click()
    await shot(page, `a07-natija-kiritish-${size}`, false)
    await page.getByRole("button", { name: `${home}: gol qo‘shish` }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await shot(page, `a08-gol-muallifi-${size}`, false)
    await page.keyboard.press("Escape")
  }

  await page.setViewportSize(SIZES.kompyuter)
  await page.goto("/admin/pley-off")
  await shot(page, "a09-pley-off-admin-kompyuter")
  await page.goto("/admin/natijalar")
  await page.getByRole("link", { name: "Bayonnoma" }).first().click()
  await expect(page.getByRole("heading", { name: "O‘yin bayonnomasi" })).toBeVisible()
  await shot(page, "a10-bayonnoma-kompyuter")
  await page.setViewportSize(SIZES.telefon)
  await page.goto("/admin")
  await shot(page, "a11-boshqaruv-paneli-telefon", false)
})
