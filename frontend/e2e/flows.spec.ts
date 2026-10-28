import path from "node:path"
import { expect, test } from "@playwright/test"
import { collectErrors, loginAsAdmin, noHorizontalScroll, openNewDraftSeason, TINY_PNG } from "./helpers"

const PUBLIC_PAGES = ["/", "/oyinlar", "/jadval", "/pley-off", "/jamoalar", "/futbolchilar", "/statistika", "/ramziy-jamoa", "/yangiliklar", "/mavsumlar", "/chempionlar", "/homiylar", "/liga-haqida", "/nizom", "/maxfiylik"]

const KIRILL_OUT = path.resolve(import.meta.dirname, "../../docs/screenshots/10-kirill")
const CYRILLIC = /[\u0400-\u04FF]/

test.describe("Lotin ↔ kirill yozuvi", () => {
  test("butun sayt kirillchaga o‘tadi, tanlov saqlanadi, qidiruv kirillcha so‘rov bilan ishlaydi va lotinchaga qaytadi", async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto("/")
    await page.getByRole("button", { name: "Кирилл ёзувига ўтиш" }).click()
    await expect(page.locator("html")).toHaveAttribute("lang", "uz-Cyrl")
    await expect(page.getByRole("link", { name: "Ўйинлар" }).first()).toBeVisible()
    await page.screenshot({ path: path.join(KIRILL_OUT, "bosh-sahifa-kompyuter.png") })

    // Sahifa almashganda React chizgan yangi matn ham darhol kirillcha
    await page.getByRole("link", { name: "Жадвал" }).first().click()
    await expect(page).toHaveURL(/\/jadval/)
    await expect(page.locator("main h1").first()).toHaveText(CYRILLIC)
    await expect(page.locator("main")).not.toContainText("guruhi")

    // Qayta yuklanganda tanlov saqlanadi
    await page.reload()
    await expect(page.locator("main h1").first()).toHaveText(CYRILLIC)

    // Qidiruv: kirillcha so'rov lotincha saqlangan nomni topadi
    await page.goto("/jamoalar")
    const cards = page.locator('main a[href^="/jamoalar/"]')
    await expect(cards.nth(1)).toBeVisible()
    const before = await cards.count()
    await page.getByRole("searchbox").fill("Лочин")
    await expect(cards).toHaveCount(1)
    expect(before).toBeGreaterThan(1)
    await expect(cards.first()).toContainText("Лочин")

    // Telefonda ham sig'adi
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto("/")
    await noHorizontalScroll(page)
    await page.screenshot({ path: path.join(KIRILL_OUT, "bosh-sahifa-telefon.png") })

    // Lotinchaga qaytish — sahifani qayta yuklamasdan
    await page.getByRole("button", { name: "Lotin yozuviga o‘tish" }).click()
    await expect(page.locator("html")).toHaveAttribute("lang", "uz")
    await expect(page.getByRole("link", { name: "O‘yinlar" }).first()).toBeVisible()
    await expect(page.locator("body")).not.toContainText("Ўйинлар")
    expect(errors).toEqual([])
  })
})

test.describe("Ommaviy sayt", () => {
  test("bosh sahifa loginsiz ochiladi va asosiy bloklar ko‘rinadi", async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto("/")
    await expect(page.getByRole("heading", { name: "Eng yaqin o‘yinlar" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Oxirgi natijalar" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Guruhlar jadvali" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "To‘purarlar" })).toBeVisible()
    await expect(page.getByText("Jonli").first()).toBeVisible()
    expect(errors).toEqual([])
  })

  for (const width of [375, 768, 1440]) {
    test(`${width}px kenglikda sahifalar gorizontal surilmaydi va xatosiz ochiladi`, async ({ page }) => {
      const errors = collectErrors(page)
      await page.setViewportSize({ width, height: 900 })
      for (const path of PUBLIC_PAGES) {
        await page.goto(path)
        await expect(page.locator("main h1").first()).toBeAttached()
        await page.waitForLoadState("networkidle")
        await noHorizontalScroll(page)
      }
      expect(errors).toEqual([])
    })
  }

  test("arxiv mavsumini tanlash mumkin va chempion ko‘rinadi", async ({ page }) => {
    await page.goto("/mavsumlar")
    await page.getByRole("button", { name: "2025-yil mavsumini ochish" }).click()
    await expect(page.getByText("Siz 2025-yil mavsumi arxivini ko‘ryapsiz.")).toBeVisible()
    await expect(page.getByText("2025-yil chempioni")).toBeVisible()
    await page.goto("/pley-off")
    await expect(page.getByText("Final", { exact: true }).first()).toBeVisible()
  })

  test("«Mening jamoam»: jamoa tanlanadi va bosh sahifada uning holati ko‘rinadi", async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto("/jamoalar")
    await page.locator('main a[href^="/jamoalar/"]').first().click()
    const toggle = page.getByRole("button", { name: "Mening jamoam qilish" })
    await expect(toggle).toBeVisible()
    const name = await page.locator("main h1").first().innerText()
    await toggle.click()
    await expect(page.getByRole("button", { name: "Mening jamoam", exact: true })).toHaveAttribute("aria-pressed", "true")
    await page.goto("/")
    const panel = page.getByRole("region", { name: "Mening jamoam" })
    await expect(panel.getByRole("link", { name })).toBeVisible()
    await expect(panel.getByText("Jadvalda")).toBeVisible()
    await expect(panel.getByText(/-o‘rin, [A-Z] guruhi/)).toBeVisible()
    // Jadvalda o'z jamoasi ajratib ko'rsatiladi
    await page.goto("/jadval")
    await expect(page.locator("tr.bg-gold-soft", { hasText: name })).toHaveCount(1)
    expect(errors).toEqual([])
  })

  test("o‘yin sahifasida Telegram uchun natija rasmi tayyorlanadi", async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto("/oyinlar?tab=natijalar")
    await page.locator('main a[href^="/oyinlar/"]').first().click()
    await page.getByRole("button", { name: "Natija rasmi" }).click()
    const dialog = page.getByRole("dialog")
    const img = dialog.getByRole("img")
    await expect(img).toBeVisible({ timeout: 15_000 })
    expect(await img.evaluate((el: HTMLImageElement) => [el.naturalWidth, el.naturalHeight])).toEqual([1080, 1350])
    await expect(dialog.getByRole("button", { name: "Yuklab olish" })).toBeEnabled()
    await dialog.getByText("Post matni").click()
    await expect(dialog.locator("pre")).toContainText("Payariq Oltin Ligasi")
    expect(errors).toEqual([])
  })

  test("admin «O‘yinlar» bo‘limidan anons rasmi yuklab olinadi, rasmda localhost yo‘q", async ({ page }) => {
    const errors = collectErrors(page)
    await loginAsAdmin(page)
    await page.goto("/admin/oyinlar")
    await page.getByRole("combobox", { name: "Holat" }).click()
    await page.getByRole("option", { name: "Rejalashtirilgan" }).click()
    await page.getByRole("button", { name: /^Anons rasmi:/ }).first().click()
    const dialog = page.getByRole("dialog")
    await expect(dialog.getByRole("heading", { name: "Anons rasmi" })).toBeVisible()
    await expect(dialog.getByRole("img")).toBeVisible({ timeout: 15_000 })
    await dialog.getByText("Post matni").click()
    await expect(dialog.locator("pre")).not.toContainText("localhost")
    const download = page.waitForEvent("download")
    await dialog.getByRole("button", { name: "Yuklab olish" }).click()
    expect((await download).suggestedFilename()).toMatch(/^payariq-anons-.+\.png$/)
    expect(errors).toEqual([])
  })

  test("nizom sahifasi pley-offga kim chiqishini tushuntiradi", async ({ page }) => {
    await page.goto("/jadval")
    await page.getByRole("link", { name: /Musobaqa nizomi/ }).first().click()
    await expect(page).toHaveURL(/\/nizom/)
    await expect(page.getByText("4 jamoali guruhdan —")).toBeVisible()
    await expect(page.getByText("5 jamoali guruhdan —")).toBeVisible()
    await expect(page.getByRole("heading", { name: "Kartochkalar va diskvalifikatsiya" })).toBeVisible()
  })

  test("o‘yin sahifasi voqealar va o‘zaro o‘yinlarni ko‘rsatadi", async ({ page }) => {
    await page.goto("/oyinlar?tab=natijalar")
    await page.locator('a[href^="/oyinlar/"]').first().click()
    await expect(page.getByRole("heading", { name: "O‘yin voqealari" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "O‘zaro o‘yinlar" })).toBeVisible()
  })
})

test.describe("Jonli yangilanish", () => {
  test("admin gol kiritganda muxlis sahifasi qayta yuklanmasdan yangilanadi va «GOL!» xabari chiqadi", async ({ page, context }) => {
    const seasons = await (await page.request.get("/api/public/seasons")).json()
    const active = seasons.find((s: { status: string }) => s.status === "ACTIVE")
    const bundle = await (await page.request.get(`/api/public/seasons/${active.id}/bundle`)).json()
    const live = bundle.matches.find((m: { status: string }) => m.status === "LIVE")
    const homeName = bundle.teams.find((t: { id: string }) => t.id === live.homeId).name
    const next = `${live.homeScore + (live.homeExtra ?? 0) + 1} : ${live.awayScore + (live.awayExtra ?? 0)}`

    // Muxlis o'yin sahifasini ochib turibdi
    await page.goto(`/oyinlar/${live.id}`)
    await expect(page.getByRole("heading", { name: "O‘yin voqealari" })).toBeVisible()

    // Admin boshqa oynada gol kiritadi
    const admin = await context.newPage()
    await loginAsAdmin(admin)
    await admin.goto(`/admin/natijalar/${live.id}`)
    await admin.getByRole("button", { name: `${homeName}: gol qo‘shish` }).click()
    await admin.getByRole("dialog").getByRole("listitem").first().getByRole("button").click()
    await admin.getByRole("button", { name: "Natijani saqlash" }).click()
    await expect(admin.getByText("O‘yin holati saqlandi")).toBeVisible()

    // Muxlis sahifasi o'zi yangilandi: xabar, «GOL!» belgisi va yangi hisob
    await expect(page.getByText(new RegExp(`^GOL! ${homeName}`))).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(next).first()).toBeVisible()
    await expect(page.getByRole("status").filter({ hasText: /^GOL!$/ })).toBeVisible()
  })
})

test.describe("Admin paneli", () => {
  test("loginsiz admin paneliga kirib bo‘lmaydi", async ({ page }) => {
    await page.goto("/admin/jamoalar")
    await expect(page).toHaveURL(/\/admin\/kirish/)
  })

  test("natija kiritilganda turnir jadvali avtomatik yangilanadi", async ({ page }) => {
    const errors = collectErrors(page)
    await loginAsAdmin(page)
    await page.goto("/admin/natijalar")
    const item = page.locator('[data-testid="admin-match"][data-status="SCHEDULED"]').first()
    const homeName = (await item.getAttribute("data-home-name"))!
    expect(homeName).toBeTruthy()

    await page.goto("/jadval")
    const teamRow = () => page.locator("tr", { has: page.getByRole("link", { name: homeName, exact: true }) })
    const row = teamRow()
    const before = Number(await row.locator('[data-col="points"]').innerText())
    const playedBefore = Number(await row.locator("td").nth(2).innerText())

    await page.goto("/admin/natijalar")
    await page.locator('[data-testid="admin-match"][data-status="SCHEDULED"]').first().getByRole("link", { name: "Natija kiritish" }).click()
    await expect(page.getByRole("heading", { name: "Natija kiritish" })).toBeVisible()

    // Uy jamoasi 2:0 hisobida yutadi; gollar ro'yxati avtomatik ikki qatorga ko'payadi
    await page.getByRole("button", { name: `${homeName} gollari: oshirish` }).click()
    await page.getByRole("button", { name: `${homeName} gollari: oshirish` }).click()
    await expect(page.getByText("2-gol")).toBeVisible()
    await page.getByRole("combobox", { name: "Gol muallifi" }).first().click()
    await page.getByRole("option").nth(1).click()
    await expect(page.getByText("Ma’lumotlar mos. Saqlashga tayyor.")).toBeVisible()
    await page.getByRole("button", { name: "Natijani saqlash" }).click()
    await expect(page.getByText("Natija saqlandi. Jadval va statistika yangilandi.")).toBeVisible()

    await page.goto("/jadval")
    const after = Number(await teamRow().locator('[data-col="points"]').innerText())
    const playedAfter = Number(await teamRow().locator("td").nth(2).innerText())
    expect(after).toBe(before + 3)
    expect(playedAfter).toBe(playedBefore + 1)

    // Natijani tahrirlash: durangga o'zgartirilsa, ochko qayta hisoblanadi (ikki marta qo'shilmaydi)
    await page.goto("/admin/natijalar")
    await page.getByRole("tab", { name: "Yakunlangan" }).click()
    await page.locator(`[data-testid="admin-match"][data-home-name="${homeName}"]`).first().getByRole("link", { name: "Tahrirlash" }).click()
    const awayPlus = page.getByRole("button", { name: /gollari: oshirish/ }).nth(1)
    await awayPlus.click()
    await awayPlus.click()
    await page.getByRole("button", { name: "Natijani saqlash" }).click()
    await expect(page.getByText("Natija saqlandi. Jadval va statistika yangilandi.")).toBeVisible()
    await page.goto("/jadval")
    const afterEdit = Number(await teamRow().locator('[data-col="points"]').innerText())
    expect(afterEdit).toBe(before + 1)
    expect(errors).toEqual([])
  })

  test("gol muallifi bir bosishda belgilanadi: hisob oshadi va gol o‘yinchi nomiga yoziladi", async ({ page }) => {
    const errors = collectErrors(page)
    await loginAsAdmin(page)
    await page.goto("/admin/natijalar")
    const item = page.locator('[data-testid="admin-match"][data-status="SCHEDULED"]').first()
    const homeName = (await item.getAttribute("data-home-name"))!
    await item.getByRole("link", { name: "Natija kiritish" }).click()
    await page.getByRole("button", { name: `${homeName}: gol qo‘shish` }).click()
    const dialog = page.getByRole("dialog")
    const player = dialog.getByRole("listitem").first().getByRole("button")
    const playerName = (await player.locator("span.truncate").innerText()).trim()
    await player.click()
    await expect(dialog).toBeHidden()
    await expect(page.locator(`output[aria-label="${homeName} gollari"]`)).toHaveText("1")
    await expect(page.getByRole("combobox", { name: "Gol muallifi" }).first()).toContainText(playerName)
    await page.getByRole("button", { name: "Natijani saqlash" }).click()
    await expect(page.getByText("Natija saqlandi. Jadval va statistika yangilandi.")).toBeVisible()
    await expect(page.getByText("Natija saqlandi:")).toBeVisible()
    await page.goto("/statistika")
    await expect(page.getByRole("link", { name: playerName }).first()).toBeVisible()
    expect(errors).toEqual([])
  })

  test("ro‘yxatda yo‘q futbolchi gol oynasining o‘zidan qo‘shiladi va gol uning nomiga yoziladi", async ({ page }) => {
    const errors = collectErrors(page)
    const lastName = `Yangiboyev${Date.now().toString(36).slice(-3)}`
    await loginAsAdmin(page)
    await page.goto("/admin/natijalar")
    const item = page.locator('[data-testid="admin-match"][data-status="SCHEDULED"]').first()
    const homeName = (await item.getAttribute("data-home-name"))!
    await item.getByRole("link", { name: "Natija kiritish" }).click()
    await page.getByRole("button", { name: `${homeName}: gol qo‘shish` }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByRole("button", { name: "Yangi futbolchi" }).click()
    const form = dialog.getByRole("form", { name: `${homeName}: yangi futbolchi` })
    // Noto'g'ri raqam tushunarli xabar bilan rad etiladi, oyna yopilmaydi
    await form.getByLabel("Ism").fill("Sardorbek")
    await form.getByLabel("Familiya").fill(lastName)
    await form.getByLabel("Raqam").fill("0")
    await form.getByRole("button", { name: "Qo‘shish va gol yozish" }).click()
    await expect(form.getByRole("alert")).toContainText("1 dan 99 gacha")
    await form.getByLabel("Raqam").fill("88")
    await form.getByRole("button", { name: "Qo‘shish va gol yozish" }).click()
    await expect(page.getByText(`Sardorbek ${lastName} ${homeName} tarkibiga qo‘shildi`)).toBeVisible()
    await expect(dialog).toBeHidden()
    await expect(page.locator(`output[aria-label="${homeName} gollari"]`)).toHaveText("1")
    await expect(page.getByRole("combobox", { name: "Gol muallifi" }).first()).toContainText(`Sardorbek ${lastName}`)
    await page.getByRole("button", { name: "Natijani saqlash" }).click()
    await expect(page.getByText("Natija saqlandi. Jadval va statistika yangilandi.")).toBeVisible()
    // Futbolchi jamoa tarkibida, gol esa to'purarlar ro'yxatida
    await page.goto("/statistika")
    await expect(page.getByRole("link", { name: `Sardorbek ${lastName}` }).first()).toBeVisible()
    expect(errors).toEqual([])
  })

  test("bayonnoma chop etishga tayyor: tarkiblar va bo‘sh kataklar", async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto("/admin/natijalar")
    await page.getByRole("link", { name: "Bayonnoma" }).first().click()
    await expect(page.getByRole("heading", { name: "O‘yin bayonnomasi" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Chop etish" })).toBeVisible()
    await expect(page.getByRole("columnheader", { name: "Futbolchi" }).first()).toBeVisible()
  })

  test("boshqaruv panelida mavsum yo‘l xaritasi keyingi qadamni ko‘rsatadi", async ({ page }) => {
    await loginAsAdmin(page)
    const map = page.getByRole("region", { name: "Mavsum bosqichlari" })
    await expect(map).toBeVisible()
    await expect(map.getByText(/^\d+ \/ \d+ bajarildi$/)).toBeVisible()
    await map.getByText("Barcha bosqichlar").click()
    await expect(map.getByText("Qur’a: guruhlarni tuzish")).toBeVisible()
  })

  test("noto‘g‘ri ma’lumot bilan natija saqlanmaydi va sababi tushuntiriladi", async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto("/admin/natijalar")
    await page.locator('[data-testid="admin-match"][data-status="SCHEDULED"]').first().getByRole("link", { name: "Natija kiritish" }).click()
    // Futbolchi tanlanmagan kartochka — xato
    await page.getByRole("region", { name: "Kartochkalar" }).getByRole("button").first().click()
    await page.getByRole("button", { name: "Natijani saqlash" }).click()
    await expect(page.getByText("Saqlashdan oldin tuzating")).toBeVisible()
    await expect(page.getByText("Kartochka uchun futbolchini tanlang.")).toBeVisible()
    await expect(page).toHaveURL(/\/admin\/natijalar\/.+/)
  })

  test("qur’adan keyin jamoa qo‘shilmaydi; yangi mavsumga jamoa logotip bilan qo‘shiladi", async ({ page }) => {
    const name = `Sinov ${Date.now().toString(36)}`
    await loginAsAdmin(page)
    // Joriy mavsumda qur'a tashlangan — mavsum jamoalari qulflangan
    await page.goto("/admin/jamoalar")
    await expect(page.getByText("Qur’a tashlangan — guruhlar shakllangan.")).toBeVisible()
    await expect(page.getByRole("button", { name: "Jamoa qo‘shish" })).toHaveCount(0)
    // Yangi mavsum ochilsa, panel o'zi unga o'tadi va jamoa aynan o'sha mavsumga qo'shiladi
    const season = await openNewDraftSeason(page)
    await page.goto("/admin/jamoalar")
    await page.getByRole("button", { name: "Jamoa qo‘shish" }).click()
    await expect(page.getByText(new RegExp(`«${season}» \\(\\d{4}, tayyorlanmoqda\\) mavsumiga qo‘shish`))).toBeVisible()
    await page.getByRole("button", { name: "Jamoani qo‘shish" }).click()
    await expect(page.getByText("Jamoa nomini kiriting (kamida 2 ta harf)")).toBeVisible()
    await page.getByLabel("Jamoa nomi").fill(name)
    await page.getByLabel("Qisqa nomi").fill("SIN")
    await page.getByRole("textbox", { name: "Qishloq" }).fill("Sinov")
    await page.locator("input[type=file]").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: TINY_PNG })
    await expect(page.getByRole("button", { name: "Boshqa rasm" })).toBeVisible()
    await page.getByRole("button", { name: "Jamoani qo‘shish" }).click()
    await expect(page.getByText(`«${name}» jamoasi qo‘shildi`)).toBeVisible()
    const row = page.locator("#admin-main li", { hasText: name })
    await expect(row).toBeVisible()
    await expect(row.locator("img")).toHaveAttribute("src", /^\/media\/[0-9a-f-]+\.(webp|png)$/)
  })

  test("maydon qo‘shiladi va o‘yin belgilashda tanlash mumkin", async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto("/admin/sozlamalar?tab=maydonlar")
    await page.getByRole("textbox", { name: "Maydon nomi" }).fill("Yangi sinov maydoni")
    await page.getByRole("textbox", { name: "Qishloq" }).fill("Payariq")
    await page.getByRole("button", { name: "Qo‘shish" }).click()
    await expect(page.getByText("Maydon qo‘shildi")).toBeVisible()
    await expect(page.locator("#admin-main").getByText("Yangi sinov maydoni")).toBeVisible()
    await page.goto("/admin/oyinlar")
    await page.getByRole("button", { name: "O‘yin qo‘shish" }).click()
    await page.getByLabel("Maydon").click()
    await expect(page.getByRole("option", { name: "Yangi sinov maydoni" })).toBeVisible()
  })

  test("telefonda admin paneli pastki menyu bilan ishlaydi", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await loginAsAdmin(page)
    await noHorizontalScroll(page)
    await page.getByRole("navigation", { name: "Pastki menyu" }).getByRole("link", { name: "Natijalar" }).click()
    await expect(page.getByRole("heading", { name: "Natijalar" })).toBeVisible()
    await noHorizontalScroll(page)
  })
})

test.describe("Foydalanuvchilar va rollar", () => {
  test("bosh tashkilotchi yordamchi qo‘shadi, yordamchi faqat o‘z bo‘limlarini ko‘radi va parolini almashtiradi", async ({ page }) => {
    const errors = collectErrors(page)
    await loginAsAdmin(page)
    await page.goto("/admin/sozlamalar?tab=foydalanuvchilar")
    await page.getByRole("button", { name: "Yordamchi qo‘shish" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByLabel("Ism-familiyasi").fill("Akmal Karimov")
    await dialog.getByLabel("Login").fill("akmal")
    await dialog.getByRole("button", { name: "Yaratish" }).click()
    const password = await dialog.locator("#u-password").inputValue()
    expect(password).toMatch(/^[\w]{4}-[\w]{4}-[\w]{4}$/)
    await dialog.getByRole("button", { name: "Yordamchini qo‘shish" }).click()
    await expect(dialog.getByRole("heading", { name: "Akkaunt tayyor" })).toBeVisible()
    await expect(dialog.getByText(password)).toBeVisible()
    await dialog.getByRole("button", { name: "Tayyor" }).click()
    await expect(page.getByText("Akmal Karimov", { exact: true })).toBeVisible()
    await expect(page.getByText("Natija kirituvchi, login:")).toBeVisible()

    // Yordamchi bilan kirish: menyuda faqat o'z bo'limlari
    await page.getByRole("button", { name: "Chiqish" }).click()
    await page.getByLabel("Login").fill("akmal")
    await page.getByLabel("Parol", { exact: true }).fill(password)
    await page.getByRole("button", { name: "Kirish" }).click()
    await expect(page).toHaveURL(/\/admin$/)
    const nav = page.getByRole("navigation", { name: "Boshqaruv menyusi" })
    await expect(nav.getByRole("link", { name: "Natijalar" })).toBeVisible()
    await expect(nav.getByRole("link", { name: "Jamoalar" })).toHaveCount(0)
    await expect(nav.getByRole("link", { name: "Sozlamalar" })).toHaveCount(0)
    await page.goto("/admin/jamoalar")
    await expect(page.getByText("Bu bo‘lim sizning rolingiz uchun yopiq")).toBeVisible()

    // O'z parolini almashtirish
    await page.goto("/admin/hisobim")
    await expect(page.getByText("Natija kirituvchi", { exact: true })).toBeVisible()
    await page.locator("#pw-current").fill(password)
    await page.locator("#pw-new").fill("Yangi-Parol-2026")
    await page.locator("#pw-repeat").fill("Yangi-Parol-2026")
    await page.getByRole("button", { name: "Parolni almashtirish" }).click()
    await expect(page.getByText("Parol almashtirildi")).toBeVisible()
    expect(errors).toEqual([])
  })
})

test.describe("Ramziy jamoa", () => {
  /** Joriy mavsumning ommaviy ma'lumotlari: saytda faqat e'lon qilingan ramziy jamoalar chiqadi */
  async function publicRoundTeams(page: import("@playwright/test").Page) {
    const seasons: { id: string; status: string }[] = await (await page.request.get("/api/public/seasons")).json()
    const active = seasons.find((s) => s.status === "ACTIVE")!
    const bundle = await (await page.request.get(`/api/public/seasons/${active.id}/bundle`)).json()
    return bundle.roundTeams as { slots: { slot: string; playerId: string }[] }[]
  }

  test("admin tur tugagach 5 futbolchini tanlaydi, rasm yuklaydi, qoralamani saqlaydi, e’lon qiladi va o‘chiradi", async ({ page }) => {
    const errors = collectErrors(page)
    await loginAsAdmin(page)
    await page.goto("/admin/ramziy-jamoa")
    await expect(page.getByRole("heading", { name: "Ramziy jamoa", level: 1 })).toBeVisible()
    await expect(page.getByText("Hali tanlanmagan")).toBeVisible()
    await expect(page.getByRole("button", { name: "E’lon qilish (0/5)" })).toBeDisabled()
    const round = (await page.getByLabel("Tur", { exact: true }).textContent())!.trim()
    expect(round).toMatch(/^\d+-tur$/)

    // Darvozabon: ro'yxatda faqat shu turda o'ynagan darvozabonlar, jamoa natijasi bilan
    const picker = page.locator("aside[aria-labelledby=rt-picker-title]")
    await page.getByRole("button", { name: "Darvozabon: bo‘sh" }).click()
    await expect(picker.getByRole("heading", { name: "Darvozabon tanlang" })).toBeVisible()
    await expect(picker.getByRole("button", { name: "Faqat darvozabonlar" })).toHaveAttribute("aria-pressed", "true")
    await expect(picker.getByText(/\d+:\d+ (g‘alaba|durang|mag‘lubiyat)/).first()).toBeVisible()
    const keeperRow = picker.locator("li button").first()
    const keeper = (await keeperRow.locator("span.truncate").first().textContent())!.trim()
    await keeperRow.click()
    await expect(page.getByRole("button", { name: `Darvozabon: ${keeper}` })).toBeVisible()
    await expect(page.getByRole("button", { name: "E’lon qilish (1/5)" })).toBeDisabled()

    // Rasm yuklash: maydonda va tanlash oynasida odamcha o'rniga rasm chiqadi
    await picker.locator("input[type=file]").setInputFiles({ name: "rasm.png", mimeType: "image/png", buffer: TINY_PNG })
    await expect(page.getByText(`${keeper}ning rasmi saqlandi`)).toBeVisible()
    await expect(picker.getByRole("img", { name: `${keeper} rasmi` })).toHaveAttribute("src", /^\/media\/[0-9a-f-]+\.(webp|png)$/)
    await expect(page.getByRole("button", { name: `Darvozabon: ${keeper}` }).locator("img")).toHaveAttribute("src", /^\/media\//)

    // Qolgan o'rinlarni avtomatik taklif to'ldiradi; admin tanlagan darvozabon o'zgarmaydi
    await page.getByRole("button", { name: "Avtomatik taklif" }).click()
    await expect(page.getByText("4 ta o‘ringa futbolchi qo‘yildi")).toBeVisible()
    await expect(page.getByRole("button", { name: `Darvozabon: ${keeper}` })).toBeVisible()
    await expect(page.getByRole("button", { name: /: bo‘sh$/ })).toHaveCount(0)

    // Qoralama saytda ko'rinmaydi
    await page.getByRole("button", { name: "Qoralama saqlash" }).click()
    await expect(page.getByText("Qoralama saqlandi. Saytda ko‘rinmaydi.")).toBeVisible()
    await expect(page.getByText("Qoralama: saytda ko‘rinmaydi")).toBeVisible()
    expect(await publicRoundTeams(page)).toHaveLength(0)

    // E'lon qilish: sahifa qayta ochilganda ham saqlangan, saytda 5 o'rin bilan chiqadi
    await page.getByRole("button", { name: "E’lon qilish (5/5)" }).click()
    await expect(page.getByText(`${round} ramziy jamoasi saytda e’lon qilindi`)).toBeVisible()
    await page.reload()
    await expect(page.getByText(/^Saytda e’lon qilingan/)).toBeVisible()
    await expect(page.getByRole("button", { name: `Darvozabon: ${keeper}` })).toBeVisible()
    const shown = await publicRoundTeams(page)
    expect(shown).toHaveLength(1)
    expect(shown[0].slots.map((s) => s.slot).sort()).toEqual(["DF", "FW", "GK", "MF_L", "MF_R"])

    // Saytda: «Ramziy jamoa» bo'limi, bosh sahifadagi blok va yuklab olinadigan rasm
    const adminUrl = page.url()
    await page.goto("/ramziy-jamoa")
    await expect(page.getByRole("heading", { name: "Ramziy jamoa", level: 1 })).toBeVisible()
    await expect(page.getByRole("heading", { name: `${round} ramziy jamoasi` })).toBeVisible()
    const list = page.locator("section[aria-labelledby=rt-list-title] ol > li")
    await expect(list).toHaveCount(5)
    await expect(list.filter({ hasText: keeper })).toContainText("darvozabon")
    await expect(list.first().getByRole("link")).toHaveAttribute("href", /^\/futbolchilar\//)
    await page.getByRole("button", { name: "Rasmni yuklab olish" }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog.getByRole("img")).toBeVisible({ timeout: 15_000 })
    await dialog.getByText("Post matni").click()
    await expect(dialog.locator("pre")).toContainText(`Darvozabon: ${keeper}`)
    await expect(dialog.locator("pre")).not.toContainText("localhost")
    const size = await dialog.getByRole("img").evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])
    expect(size).toEqual([1080, 1350])
    const download = page.waitForEvent("download")
    await dialog.getByRole("button", { name: "Yuklab olish" }).click()
    expect((await download).suggestedFilename()).toMatch(/^payariq-ramziy-jamoa-\d+-tur-\d{4}\.png$/)
    await page.keyboard.press("Escape")
    await page.goto("/")
    const teaser = page.locator("section[aria-labelledby=rt-teaser-title]")
    await expect(teaser.getByRole("heading", { name: `${round} ramziy jamoasi` })).toBeVisible()
    await expect(teaser.locator("li")).toHaveCount(5)
    await page.goto(adminUrl)

    // E'lon qilingandan keyin almashtirish: o'zgarish bo'lmaguncha tugma o'chiq
    const publishChanges = page.getByRole("button", { name: "O‘zgarishlarni e’lon qilish" })
    await expect(publishChanges).toBeDisabled()
    await page.getByRole("button", { name: /^Hujumchi:/ }).click()
    await picker.getByRole("button", { name: /^Faqat hujumchilar/ }).click()
    await picker.locator("li button[aria-pressed=false]").first().click()
    await expect(page.getByText("Saqlanmagan o‘zgarishlar bor")).toBeVisible()
    await publishChanges.click()
    await expect(page.getByText("O‘zgarishlar saytda e’lon qilindi")).toBeVisible()

    // Saytdan olish va o'chirish
    await page.getByRole("button", { name: "Saytdan olish", exact: true }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Saytdan olish", exact: true }).click()
    await expect(page.getByText(`${round} ramziy jamoasi saytdan olindi`)).toBeVisible()
    expect(await publicRoundTeams(page)).toHaveLength(0)
    await page.getByRole("button", { name: "O‘chirish", exact: true }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "O‘chirish", exact: true }).click()
    await expect(page.getByText(`${round} ramziy jamoasi o‘chirildi`)).toBeVisible()
    await expect(page.getByText("Hali tanlanmagan")).toBeVisible()
    await expect(page.getByRole("button", { name: /: bo‘sh$/ })).toHaveCount(5)
    expect(errors).toEqual([])
  })

  test("telefonda o‘rin bosilganda tanlash oynasi pastdan ochiladi", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await loginAsAdmin(page)
    await page.goto("/admin/ramziy-jamoa")
    await noHorizontalScroll(page)
    // Ikki yarim himoyachi o'rni ekran o'quvchida ham ajraladi
    await expect(page.getByRole("button", { name: "Chap yarim himoyachi: bo‘sh" })).toHaveCount(1)
    await expect(page.getByRole("button", { name: "O‘ng yarim himoyachi: bo‘sh" })).toHaveCount(1)
    await page.getByRole("button", { name: "Himoyachi: bo‘sh", exact: true }).click()
    const sheet = page.getByRole("dialog", { name: "Himoyachi tanlang" })
    await expect(sheet).toBeVisible()
    await sheet.locator("li button").first().click()
    await expect(sheet.getByRole("button", { name: "Maydondan olish" })).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("button", { name: /^Himoyachi: (?!bo‘sh)/ })).toBeVisible()
    await noHorizontalScroll(page)
  })
})

test.describe("Sinov mavsumi", () => {
  test("bosh tashkilotchi sinov mavsumini ochadi, u saytda ko‘rinmaydi va nomini yozib butunlay o‘chiradi", async ({ page }) => {
    const errors = collectErrors(page)
    const name = `Sinov ${Date.now().toString(36)}`
    const team = `Sinovchi ${Date.now().toString(36).slice(-4)}`
    await loginAsAdmin(page)
    await page.goto("/admin/mavsumlar")
    // Natijasi bor haqiqiy (joriy) mavsumni o'chirish tugmasi yo'q
    const activeRow = page.locator("#admin-main li", { hasText: "Davom etmoqda" }).first()
    await expect(activeRow).toBeVisible()
    await expect(activeRow.getByRole("button", { name: /o‘chirish$/ })).toHaveCount(0)

    await page.getByRole("button", { name: "Yangi mavsum" }).click()
    await page.getByRole("checkbox", { name: /Sinov mavsumi/ }).click()
    await expect(page.getByLabel("Nomi")).toHaveValue("Sinov mavsumi")
    await page.getByLabel("Nomi").fill(name)
    await page.getByRole("button", { name: "Mavsumni yaratish" }).click()
    await expect(page.getByText(`«${name}» sinov mavsumi yaratildi`)).toBeVisible()
    await expect(page.getByRole("note")).toContainText("sinov mavsumi")

    // Sinov mavsumiga jamoa qo'shiladi
    await page.goto("/admin/jamoalar")
    await page.getByRole("button", { name: "Jamoa qo‘shish" }).click()
    await page.getByLabel("Jamoa nomi").fill(team)
    await page.getByLabel("Qisqa nomi").fill("SNV")
    await page.getByRole("textbox", { name: "Qishloq" }).fill("Sinov")
    await page.getByRole("button", { name: "Jamoani qo‘shish" }).click()
    await expect(page.getByText(`«${team}» jamoasi qo‘shildi`)).toBeVisible()

    // Saytda sinov mavsumi yo'q
    const publicSeasons: { name: string }[] = await (await page.request.get("/api/public/seasons")).json()
    expect(publicSeasons.map((s) => s.name)).not.toContain(name)

    // O'chirish: nima o'chishi ko'rsatiladi, nom to'g'ri yozilmaguncha tugma o'chiq
    await page.goto("/admin/mavsumlar")
    const row = page.locator("#admin-main li", { hasText: name })
    await expect(row.getByText("Sinov", { exact: true })).toBeVisible()
    await row.getByRole("button", { name: `«${name}»ni o‘chirish` }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toContainText("1 ta jamoa butunlay o‘chadi")
    const confirm = dialog.getByRole("button", { name: "Butunlay o‘chirish" })
    await expect(confirm).toBeDisabled()
    const input = dialog.getByLabel(/Tasdiqlash uchun mavsum nomini yozing/)
    await input.fill("boshqa nom")
    await expect(confirm).toBeDisabled()
    await input.fill(name)
    await confirm.click()
    await expect(page.getByText(`«${name}» o‘chirildi: 1 ta jamoa, 0 ta futbolchi, 0 ta o‘yin`)).toBeVisible()
    await expect(page.locator("#admin-main li", { hasText: name })).toHaveCount(0)
    await expect(page.getByRole("note")).toHaveCount(0)

    // Jamoa ham o'chdi
    await page.goto("/admin/jamoalar")
    await expect(page.locator("#admin-main").getByText(team)).toHaveCount(0)
    expect(errors).toEqual([])
  })
})

test.describe("Yangi mavsumga jamoalarni ko‘chirish", () => {
  test("o‘tgan mavsum jamoalari futbolchilari bilan ko‘chadi; qatnashmaydigani belgidan chiqariladi va keyin oldingi tarkibi bilan qo‘shiladi", async ({ page }) => {
    const errors = collectErrors(page)
    const name = `Ko‘chirish ${Date.now().toString(36)}`
    await loginAsAdmin(page)
    await page.goto("/admin/mavsumlar")
    await page.getByRole("button", { name: "Yangi mavsum" }).click()
    const dialog = page.getByRole("dialog", { name: "Yangi mavsum" })
    // Sinov mavsumi (keyin butunlay o'chiriladi); sinov belgisi manbani bo'shatadi — qayta tanlanadi
    await dialog.getByRole("checkbox", { name: /Sinov mavsumi/ }).click()
    await dialog.getByLabel("Nomi").fill(name)
    await dialog.getByLabel("Jamoalarni ko‘chirish").click()
    await page.getByRole("option", { name: /jamoalari$/ }).first().click()

    // Hammasi oldindan belgilangan
    const picker = dialog.getByRole("group", { name: "Qaysi jamoalar qatnashadi?" })
    const boxes = picker.getByRole("checkbox")
    const total = await boxes.count()
    expect(total).toBeGreaterThan(2)
    await expect(picker.getByRole("checkbox", { checked: true })).toHaveCount(total)
    const skipped = (await picker.locator("li").first().locator("span.truncate").innerText()).trim()
    await boxes.first().click()
    await expect(picker).toContainText(`${total - 1} / ${total} ta jamoa`)
    await noHorizontalScroll(page)
    await dialog.getByRole("button", { name: "Mavsumni yaratish" }).click()
    await expect(page.getByText(`«${name}» sinov mavsumi yaratildi`)).toBeVisible()

    // Ko'chgan jamoalar tarkibi bilan; belgidan chiqarilgani mavsumda yo'q
    await page.goto("/admin/jamoalar")
    await expect(page.locator("#admin-main").getByText(/\d+ ta futbolchi/).first()).toBeVisible()
    const late = page.getByRole("switch", { name: new RegExp(`^${skipped}:`) })
    await expect(late).not.toBeChecked()
    await expect(page.getByRole("switch", { checked: true })).toHaveCount(total - 1)

    // Kech qaytgan jamoa oldingi tarkibi bilan qo'shiladi
    await late.click()
    await expect(page.getByText(new RegExp(`«${skipped}» mavsumga oldingi tarkibi bilan qo‘shildi: \\d+ ta futbolchi`))).toBeVisible()
    await expect(late).toBeChecked()

    // Sinov mavsumi o'chiriladi
    await page.goto("/admin/mavsumlar")
    await page.locator("#admin-main li", { hasText: name }).getByRole("button", { name: `«${name}»ni o‘chirish` }).click()
    const confirm = page.getByRole("dialog")
    await confirm.getByLabel(/Tasdiqlash uchun mavsum nomini yozing/).fill(name)
    await confirm.getByRole("button", { name: "Butunlay o‘chirish" }).click()
    await expect(page.getByText(new RegExp(`«${name}» o‘chirildi`))).toBeVisible()
    expect(errors).toEqual([])
  })
})
