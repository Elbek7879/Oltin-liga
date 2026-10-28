import { describe, expect, it } from "vitest"
import { searchKey, toCyrillic, toLatin } from "../translit"

describe("lotin → kirill (o‘zbek imlosi)", () => {
  const cases: [string, string][] = [
    ["Payariq Oltin Ligasi", "Пайариқ Олтин Лигаси"],
    ["Payariq tumanida", "Пайариқ туманида"],
    ["O‘yinlar", "Ўйинлар"],
    ["G‘olib", "Ғолиб"],
    ["yo‘q", "йўқ"],
    ["Ma’lumotni yuklab bo‘lmadi", "Маълумотни юклаб бўлмади"],
    ["Yangiliklar va e’lonlar", "Янгиликлар ва эълонлар"],
    ["Qur’a tashlash", "Қуръа ташлаш"],
    ["Sorqo'rg'on", "Сорқўрғон"],
    ["Mirzacho‘l Birlik Arena", "Мирзачўл Бирлик Арена"],
    ["Chempionlar", "Чемпионлар"],
    ["Eng yaxshi to‘purar", "Энг яхши тўпурар"],
    ["2026-yil, 4-mavsum", "2026-йил, 4-мавсум"],
    ["Yakshanba, 16-oktabr", "Якшанба, 16-октябр"],
    ["30-sentabrdan", "30-сентябрдан"],
    ["Pozitsiyasi ko‘rsatilmagan", "Позицияси кўрсатилмаган"],
    ["Diskvalifikatsiya", "Дисквалификация"],
    ["operatsion", "операцион"],
    ["Ketsa ham", "Кетса ҳам"],
    ["Payshanba", "Пайшанба"],
    ["Telegram’ga yuborish", "Телеграмга юбориш"],
    ["san’at", "санъат"],
    ["Ho‘kiz", "Ҳўкиз"],
    ["SHAHAR", "ШАҲАР"],
    ["Mening jamoam", "Менинг жамоам"],
    ["Yo‘l xaritasi", "Йўл харитаси"],
    ["Ehtiyot", "Эҳтиёт"],
  ]
  for (const [lat, cyr] of cases) {
    it(`${lat} → ${cyr}`, () => expect(toCyrillic(lat)).toBe(cyr))
  }

  it("havola, domen, e-pochta va qisqartmalar o‘zgarmaydi; kirillcha matn qayta o‘girilmaydi", () => {
    expect(toCyrillic("Sayt: payariqliga.uz, https://t.me/liga")).toBe("Сайт: payariqliga.uz, https://t.me/liga")
    expect(toCyrillic("PNG yoki JPG rasm")).toBe("PNG ёки JPG расм")
    expect(toCyrillic("12:30, 2 × 20")).toBe("12:30, 2 × 20")
    const once = toCyrillic("Navbatdagi o‘yinlar")
    expect(toCyrillic(once)).toBe(once)
  })
})

describe("qidiruv ikkala yozuvda ishlaydi", () => {
  it("kirillcha so‘rov lotincha nomni topadi", () => {
    expect(toLatin("Лочин")).toBe("Lochin")
    expect(searchKey("Сорқўрғон")).toBe(searchKey("Sorqo'rg'on"))
    expect(searchKey("Ўзбекистон")).toBe("ozbekiston")
    expect(searchKey("Qizil Qishloq")).toContain(searchKey("қишлоқ"))
  })
})
