/*
 * To'liq jarayon BO'SH bazadan, faqat brauzer orqali (tashkilotchi qanday ishlasa, shunday):
 * mavsum ochish → jamoalar (logotip va futbolchilar bilan) → qur'a (juftliklar o'zi tuziladi) → sanalarni admin belgilaydi →
 * natijalar (gol muallifini bir bosishda belgilash) → setka o'zi tuziladi → sana belgilash →
 * final → mavsumni yakunlash → saytda chempion va to'purar.
 */
import path from "node:path"
import { expect, test, type Page } from "@playwright/test"
import { loginAsAdmin, TINY_PNG } from "./helpers"

const OUT = path.resolve(import.meta.dirname, "../../docs/screenshots/06-bosqich")
const TEAMS = [
  { name: "Qizil Olma", short: "QOL", village: "Olmazor", players: "9 Karimov Sardor hujumchi\n1 Aliyev Vali darvozabon" },
  { name: "Ko‘k Lochin", short: "KLO", village: "Oqtepa" },
  { name: "Yashil Vodiy", short: "YVO", village: "Chelak" },
  { name: "Oq Burgut", short: "OBU", village: "Payariq" },
]
const SCORER = { team: "Qizil Olma", player: "Sardor Karimov" }

function isoDate(daysFromToday: number) {
  const d = new Date(Date.now() + 5 * 3600_000 + daysFromToday * 86_400_000)
  return d.toISOString().slice(0, 10)
}

const EMPTY_PUBLIC = ["/", "/oyinlar", "/jadval", "/pley-off", "/jamoalar", "/futbolchilar", "/statistika", "/ramziy-jamoa", "/yangiliklar", "/mavsumlar", "/chempionlar", "/homiylar", "/liga-haqida", "/nizom", "/maxfiylik"]
const EMPTY_ADMIN = ["/admin", "/admin/mavsumlar", "/admin/jamoalar", "/admin/futbolchilar", "/admin/guruhlar", "/admin/oyinlar", "/admin/natijalar", "/admin/pley-off", "/admin/ramziy-jamoa", "/admin/yangiliklar", "/admin/homiylar", "/admin/hisobotlar", "/admin/tashriflar", "/admin/sozlamalar", "/admin/hisobim"]

/** Bo'sh baza (yangi o'rnatilgan sayt): har bir sahifa telefonda va kompyuterda xatosiz, tushunarli bo'sh holat bilan ochiladi */
async function sweepEmpty(page: Page, urls: string[]) {
  const problems: string[] = []
  const onConsole = (m: { type(): string; text(): string }) => {
    if (m.type() === "error") problems.push(`konsol: ${m.text()}`)
  }
  const onError = (e: Error) => problems.push(`JS xato: ${e.message}`)
  const onResponse = (r: { status(): number; url(): string }) => {
    if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`)
  }
  page.on("console", onConsole)
  page.on("pageerror", onError)
  page.on("response", onResponse)
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const url of urls) {
      await page.goto(url)
      await page.waitForLoadState("networkidle")
      await expect(page.locator("main h1").first()).toBeAttached()
      const state = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        error: (document.querySelector("main")?.textContent ?? "").includes("Ma’lumotni yuklab bo‘lmadi"),
      }))
      if (state.overflow > 0) problems.push(`${url}, ${width}px: gorizontal scroll ${state.overflow}px`)
      if (state.error) problems.push(`${url}, ${width}px: «Ma’lumotni yuklab bo‘lmadi»`)
    }
  }
  page.off("console", onConsole)
  page.off("pageerror", onError)
  page.off("response", onResponse)
  await page.setViewportSize({ width: 1280, height: 720 })
  expect(problems, problems.join("\n")).toEqual([])
}

/** Natija kiritish. scorer berilsa — shu jamoa uchun bitta gol «Gol» tugmasi va o'yinchini bosish bilan yoziladi */
async function enterResult(page: Page, plan: (home: string, away: string) => { home: number; away: number; quick?: "home" | "away" }) {
  const plus = page.getByRole("button", { name: /gollari: oshirish/ })
  const home = (await plus.first().getAttribute("aria-label"))!.replace(" gollari: oshirish", "")
  const away = (await plus.nth(1).getAttribute("aria-label"))!.replace(" gollari: oshirish", "")
  const p = plan(home, away)
  let h = p.home
  let a = p.away
  if (p.quick) {
    await page.getByRole("button", { name: `${SCORER.team}: gol qo‘shish` }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByRole("button", { name: new RegExp(SCORER.player) }).click()
    await expect(dialog).toBeHidden()
    if (p.quick === "home") h--
    else a--
  }
  for (let i = 0; i < h; i++) await plus.first().click()
  for (let i = 0; i < a; i++) await plus.nth(1).click()
  await expect(page.getByText("Ma’lumotlar mos. Saqlashga tayyor.")).toBeVisible()
  await page.getByRole("button", { name: "Natijani saqlash" }).click()
  await expect(page.getByText("Natija saqlandi. Jadval va statistika yangilandi.")).toBeVisible()
  await expect(page).toHaveURL(/\/admin\/natijalar$/)
  return { home, away }
}

test("bo‘sh bazadan chempion aniqlangunga qadar to‘liq jarayon", async ({ page }) => {
  // Bo'sh sayt: muxlisga tushunarli xabar
  await page.goto("/")
  await expect(page.getByText("Birinchi mavsum tez orada boshlanadi")).toBeVisible()
  await sweepEmpty(page, EMPTY_PUBLIC)

  // 1. Kirish va birinchi mavsum
  await loginAsAdmin(page)
  await expect(page.getByText("Birinchi mavsumni yarating")).toBeVisible()
  await sweepEmpty(page, EMPTY_ADMIN)
  await page.goto("/admin")
  // «Mavsum ochish» darhol yangi mavsum oynasini ochadi
  await page.getByRole("link", { name: "Mavsum ochish" }).click()
  await expect(page.getByRole("dialog", { name: "Yangi mavsum" })).toBeVisible()
  await page.getByLabel("Nomi").fill("Sinov mavsumi")
  await page.getByRole("button", { name: "Mavsumni yaratish" }).click()
  await expect(page.getByText("«Sinov mavsumi» yaratildi")).toBeVisible()
  await page.getByRole("button", { name: "Boshlash" }).click()
  await expect(page.getByText("«Sinov mavsumi» boshlandi")).toBeVisible()

  // 2. Maydon
  await page.goto("/admin/sozlamalar?tab=maydonlar")
  await page.getByRole("textbox", { name: "Maydon nomi" }).fill("Sinov stadioni")
  await page.getByRole("button", { name: "Qo‘shish" }).click()
  await expect(page.getByText("Maydon qo‘shildi")).toBeVisible()

  // 3. To'rtta jamoa: birinchisi logotip va futbolchilar ro'yxati bilan (ixtiyoriy bo'lim)
  await page.goto("/admin/jamoalar")
  for (const [i, t] of TEAMS.entries()) {
    await page.getByRole("button", { name: "Jamoa qo‘shish" }).click()
    await page.getByLabel("Jamoa nomi").fill(t.name)
    await page.getByLabel("Qisqa nomi").fill(t.short)
    await page.getByRole("textbox", { name: "Qishloq" }).fill(t.village)
    if (i === 0) {
      await page.locator("input[type=file]").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: TINY_PNG })
      await expect(page.getByRole("button", { name: "Boshqa rasm" })).toBeVisible()
    }
    if (t.players) {
      await page.getByRole("button", { name: /Futbolchilarni hozir kiritish/ }).click()
      await page.getByRole("button", { name: "Ro‘yxatni qo‘yish" }).click()
      await page.getByLabel("Har qatorda bitta futbolchi").fill(t.players)
      await page.getByRole("button", { name: "Qatorlarga ajratish" }).click()
      await expect(page.getByLabel("1-qator: familiya")).toHaveValue("Karimov")
      await page.screenshot({ path: path.join(OUT, "flow-01-jamoa-futbolchilar.png") })
      await page.getByRole("button", { name: "Jamoani qo‘shish" }).click()
      await expect(page.getByText(`«${t.name}» jamoasi 2 ta futbolchi bilan qo‘shildi`)).toBeVisible()
    } else {
      await page.getByRole("button", { name: "Jamoani qo‘shish" }).click()
      await expect(page.getByText(`«${t.name}» jamoasi qo‘shildi`)).toBeVisible()
    }
  }
  await expect(page.getByRole("dialog")).toBeHidden()

  // 4. Qur'a
  await page.goto("/admin/guruhlar")
  await page.getByRole("button", { name: "Qur’a tashlash" }).click()
  await page.getByRole("button", { name: "Tasdiqlash va saqlash" }).click()
  await page.getByRole("button", { name: "Ha, saqlash" }).click()
  await expect(page.getByText("Guruhlar saqlandi va juftliklar tuzildi. Endi «O‘yinlar» bo‘limida sana va vaqtlarni belgilang.")).toBeVisible()

  // 4a. Qur'adan keyin mavsum ishtirokchilari qulflanadi: jamoa qo'shib bo'lmaydi
  await page.goto("/admin/jamoalar")
  await expect(page.getByText("Qur’a tashlangan — guruhlar shakllangan.")).toBeVisible()
  await expect(page.getByRole("button", { name: "Jamoa qo‘shish" })).toHaveCount(0)
  await expect(page.getByRole("switch", { name: /mavsumida ishtirok/ }).first()).toBeDisabled()
  // Jamoa esdan chiqqan bo'lsa: natija yo'q ekan, qur'ani bekor qilib, qaytadan tashlash mumkin
  await page.goto("/admin/guruhlar")
  await page.getByRole("button", { name: "Qur’ani bekor qilish" }).click()
  await page.getByRole("button", { name: "Ha, bekor qilish" }).click()
  await expect(page.getByText("Qur’a bekor qilindi. Jamoalarni o‘zgartirib, qur’ani qaytadan tashlang.")).toBeVisible()
  await page.goto("/admin/jamoalar")
  await expect(page.getByRole("button", { name: "Jamoa qo‘shish" })).toBeVisible()
  await expect(page.getByText("Qur’a tashlangan — guruhlar shakllangan.")).toHaveCount(0)
  await page.goto("/admin/guruhlar")
  await page.getByRole("button", { name: "Qur’a tashlash" }).click()
  await page.getByRole("button", { name: "Tasdiqlash va saqlash" }).click()
  await page.getByRole("button", { name: "Ha, saqlash" }).click()
  await expect(page.getByText("Guruhlar saqlandi va juftliklar tuzildi. Endi «O‘yinlar» bo‘limida sana va vaqtlarni belgilang.")).toBeVisible()

  // 5. Juftliklar qur'adan keyin o'zi tuzildi (3 tur × 2 o'yin). Sanani faqat admin qo'yadi — «Navbatdagi o'yinlar»
  //    kunma-kun chiqadi. 4 jamoali guruhda bir jamoa kuniga bir marta o'ynaydi: har kunga 2 ta o'yin navbatga chiqadi.
  //    O'tgan sanalar — natijalar darhol kiritiladi.
  await page.goto("/admin/oyinlar")
  await expect(page.getByRole("heading", { name: "Navbatdagi o‘yinlar" })).toBeVisible()
  await expect(page.getByText("Sanasi belgilanmagan barcha o‘yinlar (6)")).toBeVisible()
  const times = page.getByLabel(/: boshlanish vaqti$/)
  for (let day = 0; day < 3; day++) {
    await expect(times).toHaveCount(2)
    await expect(times.first()).toHaveValue("")
    await page.getByLabel("O‘yin kuni").fill(isoDate(-21 + day * 7))
    await page.getByLabel("Birinchi o‘yin vaqti").fill("10:00")
    await page.getByRole("button", { name: "Kun va vaqtlarni qo‘yish" }).click()
    // Vaqtlar o'yin davomiyligi bilan ketma-ket: 2×20 daqiqa — har 1 soatda
    await expect(times.nth(0)).toHaveValue("10:00")
    await expect(times.nth(1)).toHaveValue("11:00")
    if (day === 0) {
      await page.screenshot({ path: path.join(OUT, "flow-02-sanalar.png") })
      // Telefonda ham navbat bloki sig'adi, gorizontal surilish yo'q
      await page.setViewportSize({ width: 375, height: 812 })
      await page.getByRole("heading", { name: "Navbatdagi o‘yinlar" }).scrollIntoViewIfNeeded()
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
      await page.screenshot({ path: path.join(OUT, "flow-02b-navbat-telefon.png"), fullPage: true })
      await page.setViewportSize({ width: 1280, height: 720 })
    }
    await page.getByRole("button", { name: "Saqlash (2)" }).click()
    await expect(page.getByText("2 ta o‘yin sanasi saqlandi — saytda ko‘rinadi").first()).toBeVisible()
  }
  await expect(page.getByText("Barcha o‘yinlarning sanasi belgilangan.", { exact: false })).toBeVisible()

  // 6. Guruh natijalari. Qizil Olma o'yinlarida u 2:0 yutadi (bitta gol — Sardor Karimov, tezkor tugma bilan),
  //    qolgan o'yinlarda uy jamoasi har xil hisobda yutadi (teng holat kamroq bo'lishi uchun)
  for (let i = 0; i < 6; i++) {
    await page.goto("/admin/natijalar")
    await page.getByRole("link", { name: "Natija kiritish" }).first().click()
    await enterResult(page, (home, away) =>
      home === SCORER.team ? { home: 2, away: 0, quick: "home" } : away === SCORER.team ? { home: 0, away: 2, quick: "away" } : { home: (i % 3) + 1, away: 0 },
    )
    if (i === 0) {
      // Saqlangach — Telegram uchun natija rasmi taklif qilinadi
      await expect(page.getByText("Natija saqlandi:")).toBeVisible()
      await page.getByRole("status").getByRole("button", { name: "Natija rasmi" }).click()
      await expect(page.getByRole("dialog").getByRole("img")).toBeVisible({ timeout: 15_000 })
      await page.screenshot({ path: path.join(OUT, "flow-03-natija-rasmi.png") })
      await page.keyboard.press("Escape")
    }
  }

  // 7. Turnir jadvali avtomatik hisoblandi: 4 jamoa × 3 o'yin, jami 18 ochko; to'purar ro'yxatda
  await page.goto("/jadval")
  await expect(page.locator('[data-col="points"]')).toHaveCount(4)
  const points = await page.locator('[data-col="points"]').allInnerTexts()
  expect(points.reduce((sum, p) => sum + Number(p), 0)).toBe(18)
  await page.goto("/statistika")
  await expect(page.getByRole("link", { name: SCORER.player })).toBeVisible()

  // 8. Setka o'zi tuzildi (1 guruhdan 2 jamoa → final). Teng holat bo'lsa — qur'a tashlanadi
  await page.goto("/admin/pley-off")
  const lot = page.getByRole("button", { name: "Qur’a tashlash" })
  const dateInput = page.locator('input[type="date"]').first()
  await expect(dateInput.or(lot)).toBeVisible()
  if (await lot.isVisible()) {
    await lot.click()
    await page.getByRole("dialog").getByRole("button", { name: "Qur’a tashlash" }).click()
    await expect(page.getByText("Qur’a tashlandi. Natija jadval va setkada ko‘rinadi.")).toBeVisible()
  }
  await expect(dateInput).toBeVisible()

  // Muxlislarga sana hali belgilanmagani aniq ko'rinadi
  const site = await page.context().newPage()
  await site.goto("/pley-off")
  await expect(site.getByText("Sana belgilanmagan").first()).toBeVisible()

  // Admin faqat sana va vaqtni belgilaydi
  await dateInput.fill(isoDate(0))
  await page.locator('input[type="time"]').first().fill("16:00")
  await page.getByRole("button", { name: "Saqlash (1)" }).click()
  await expect(page.getByText("1 ta o‘yin sanasi saqlandi — saytda ko‘rinadi")).toBeVisible()
  await page.screenshot({ path: path.join(OUT, "flow-04-pley-off-sana.png"), fullPage: true })
  await site.reload()
  await expect(site.getByText("16:00").first()).toBeVisible()
  await site.close()

  // 9. Final: bayonnoma chop etishga tayyor, keyin natija 2:1
  await page.goto("/admin/natijalar")
  await page.getByRole("link", { name: "Bayonnoma" }).first().click()
  await expect(page.getByRole("heading", { name: "O‘yin bayonnomasi" })).toBeVisible()
  await expect(page.getByText("Final").first()).toBeVisible()
  await page.goto("/admin/natijalar")
  await page.getByRole("link", { name: "Natija kiritish" }).first().click()
  const { home: champion } = await enterResult(page, () => ({ home: 2, away: 1 }))

  // 10. Mavsumni yakunlash
  await page.goto("/admin/mavsumlar")
  await page.getByRole("button", { name: "Yakunlash" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.locator("li", { hasText: "Chempion" })).toContainText(champion)
  await dialog.getByRole("button", { name: "Mavsumni yakunlash" }).click()
  await expect(page.getByText("Sinov mavsumi yakunlandi va arxivga o‘tkazildi")).toBeVisible()

  // 11. Saytda: chempion tarixi, arxiv va nizom
  await page.goto("/chempionlar")
  await expect(page.getByRole("heading", { name: champion })).toBeVisible()
  await page.screenshot({ path: path.join(OUT, "flow-05-chempion.png"), fullPage: true })
  await page.goto("/")
  await expect(page.getByText("Mavsum finali")).toBeVisible()
  await page.goto("/nizom")
  await expect(page.getByRole("heading", { name: "Pley-offga kim chiqadi" })).toBeVisible()
})
