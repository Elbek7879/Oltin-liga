import fs from "node:fs"
import path from "node:path"
import { expect, type Page } from "@playwright/test"

/** Sahifadagi konsol xatolarini yig'adi */
export function collectErrors(page: Page) {
  const errors: string[] = []
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text())
  })
  page.on("pageerror", (err) => errors.push(err.message))
  return errors
}

/** Lokal sinov admini: backend/.env faylidagi qiymatlar (fayl git'ga tushmaydi) */
function adminCredentials() {
  const env = fs.readFileSync(path.resolve(import.meta.dirname, "../../backend/.env"), "utf8")
  const get = (key: string) => env.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1]?.trim() ?? ""
  return { username: get("ADMIN_USERNAME"), password: get("ADMIN_PASSWORD") }
}

export async function loginAsAdmin(page: Page) {
  const { username, password } = adminCredentials()
  await page.goto("/admin/kirish")
  // Yorliqlar lotin yoki kirill yozuvida bo'lishi mumkin
  await page.getByLabel(/^(Login|Логин)$/).fill(username)
  await page.getByLabel(/^(Parol|Парол)$/).fill(password)
  await page.getByRole("button", { name: /^(Kirish|Кириш)$/ }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

/**
 * Yangi (tayyorlanayotgan) mavsum ochadi — qur'asi hali tashlanmagan, jamoa qo'shish ochiq.
 * Admin panel o'zi shu mavsumga o'tadi. Qaytaradi: mavsum nomi.
 */
export async function openNewDraftSeason(page: Page, name = `Sinov mavsumi ${Date.now().toString(36)}`) {
  await page.goto("/admin/mavsumlar")
  await page.getByRole("button", { name: "Yangi mavsum" }).click()
  await page.getByLabel("Nomi").fill(name)
  await page.getByRole("button", { name: "Mavsumni yaratish" }).click()
  await expect(page.getByText(`«${name}» yaratildi`)).toBeVisible()
  return name
}

/** Admin panelni yana joriy (boshlangan) mavsumga qaytaradi */
export async function backToActiveSeason(page: Page) {
  await page.evaluate(() => localStorage.removeItem("pol-season"))
  await page.reload()
}

export async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow, "sahifa gorizontal suriladi").toBeLessThanOrEqual(0)
}

/** 1x1 PNG — logotip yuklash sinovi uchun */
export const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
)
