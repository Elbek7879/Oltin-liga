import { describe, expect, it } from "vitest"
// Serverdagi asl matnlar: ikkala tomon bir-biridan ajralib qolmasligi uchun
import java from "../../../../backend/src/main/java/uz/payariq/liga/seo/SeoService.java?raw"
import { adminMeta, matchMeta, newsMeta, normalizePath, notFoundMeta, playerMeta, STATIC_PAGES, staticMeta, teamMeta } from "../seo"

const LEAGUE = "Payariq Oltin Ligasi"

describe("sahifa nomi va tavsifi (serverdagi SeoService bilan bir xil)", () => {
  it("bosh sahifa va doimiy bo‘limlar", () => {
    expect(staticMeta("/", LEAGUE)).toEqual({
      title: `${LEAGUE} — o‘yinlar, natijalar va turnir jadvali`,
      description: `${LEAGUE}: o‘yinlar taqvimi, natijalar, turnir jadvali, to‘purarlar va mavsumlar tarixi.`,
    })
    expect(staticMeta("/jadval/", LEAGUE)).toEqual({
      title: `Turnir jadvali — ${LEAGUE}`,
      description: "Guruhlar jadvali: ochkolar, to‘plar farqi va pley-offga chiqish zonasi.",
    })
    expect(staticMeta("/jamoalar/abc", LEAGUE)).toBeUndefined()
    expect(normalizePath("")).toBe("/")
    expect(normalizePath("nizom//")).toBe("/nizom")
  })

  it("har bir sahifa nomi boshqalarnikidan farq qiladi", () => {
    const titles = ["/", ...Object.keys(STATIC_PAGES)].map((p) => staticMeta(p, LEAGUE)!.title)
    expect(new Set(titles).size).toBe(titles.length)
  })

  it("matnlar serverdagi SeoService.STATIC_PAGES bilan aynan bir xil", () => {
    const server = Object.fromEntries([...java.matchAll(/STATIC_PAGES\.put\("([^"]+)", new String\[\] \{"([^"]+)", "([^"]+)"\}\);/g)].map((m) => [m[1], [m[2], m[3]]]))
    expect(server).toEqual(STATIC_PAGES)
  })

  it("jamoa, futbolchi va yangilik", () => {
    expect(teamMeta({ name: "Lochin", village: "Qizil Qishloq" }, LEAGUE)).toEqual({
      title: `Lochin — ${LEAGUE}`,
      description: "Lochin (Qizil Qishloq): o‘yinlar, natijalar, tarkib va mavsumlar bo‘yicha statistika.",
    })
    expect(teamMeta({ name: "Lochin", village: "  " }, LEAGUE).description).toBe("Lochin: o‘yinlar, natijalar, tarkib va mavsumlar bo‘yicha statistika.")
    expect(playerMeta({ firstName: "Sardor", lastName: "Karimov" }, LEAGUE)).toEqual({
      title: `Sardor Karimov — ${LEAGUE}`,
      description: "Sardor Karimov: o‘yinlar, gollar, assistlar va mavsumlar bo‘yicha statistika.",
    })
    expect(newsMeta({ title: "Mavsum boshlandi", excerpt: " Birinchi tur o‘yinlari shanba kuni. " }, LEAGUE)).toEqual({
      title: `Mavsum boshlandi — ${LEAGUE}`,
      description: "Birinchi tur o‘yinlari shanba kuni.",
    })
    expect(newsMeta({ title: "Mavsum boshlandi", excerpt: "" }, LEAGUE).description).toBe(`${LEAGUE} yangiliklari: Mavsum boshlandi.`)
  })

  it("o‘yin: hisob faqat o‘ynalgan yoki jonli o‘yinda, qo‘shimcha vaqt bilan", () => {
    const base = { homeScore: null, awayScore: null, homeExtra: null, awayExtra: null }
    expect(matchMeta({ ...base, status: "SCHEDULED" }, "Lochin", "Chinor", LEAGUE)).toEqual({
      title: `Lochin – Chinor — ${LEAGUE}`,
      description: "Lochin va Chinor o‘yini: hisob, gollar, kartochkalar va o‘yin tafsilotlari.",
    })
    expect(matchMeta({ ...base, status: "FINISHED", homeScore: 2, awayScore: 1 }, "Lochin", "Chinor", LEAGUE).title).toBe(`Lochin 2:1 Chinor — ${LEAGUE}`)
    expect(matchMeta({ ...base, status: "FINISHED", homeScore: 1, awayScore: 1, homeExtra: 1, awayExtra: 0 }, "Lochin", "Chinor", LEAGUE).title).toBe(`Lochin 2:1 Chinor — ${LEAGUE}`)
    expect(matchMeta({ ...base, status: "LIVE", homeScore: 0, awayScore: 0 }, "Lochin", "Chinor", LEAGUE).title).toBe(`Lochin 0:0 Chinor — ${LEAGUE}`)
    expect(matchMeta({ ...base, status: "FINISHED", homeScore: 2, awayScore: 1 }, "Lochin", null, LEAGUE)).toEqual({
      title: `Pley-off o‘yini — ${LEAGUE}`,
      description: "Pley-off o‘yini: hisob, gollar, kartochkalar va o‘yin tafsilotlari.",
    })
  })

  it("topilmadi va admin panel Google’da ko‘rsatilmaydi", () => {
    expect(notFoundMeta(LEAGUE)).toEqual({ title: `Sahifa topilmadi — ${LEAGUE}`, description: "Bu manzilda sahifa yo‘q.", noindex: true })
    expect(adminMeta(undefined, LEAGUE).title).toBe(`Boshqaruv paneli — ${LEAGUE}`)
    expect(adminMeta("Natijalar", LEAGUE)).toMatchObject({ title: "Natijalar — Boshqaruv paneli", noindex: true })
  })
})
