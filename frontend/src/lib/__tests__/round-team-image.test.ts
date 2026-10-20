import { describe, expect, it } from "vitest"
import { formatDateRange } from "../format"
import { roundTeamCaption, roundTeamFileName, roundTeamImageInCyrillic, type RoundTeamImageData } from "../round-team-image"

describe("tur sanalari", () => {
  it("bir kun, bir oy ichida va oylar oralig'i Toshkent vaqti bo'yicha", () => {
    expect(formatDateRange([])).toBeNull()
    expect(formatDateRange(["2026-10-16T15:00:00+05:00", "2026-10-16T18:00:00+05:00"])).toBe("16-oktabr")
    expect(formatDateRange(["2026-10-17T15:00:00+05:00", "2026-10-16T15:00:00+05:00"])).toBe("16–17-oktabr")
    expect(formatDateRange(["2026-09-30T15:00:00+05:00", "2026-10-02T15:00:00+05:00"])).toBe("30-sentabr – 2-oktabr")
    // UTC bo'yicha kechagi kun, Toshkentda esa ertasi tong
    expect(formatDateRange(["2026-10-16T20:30:00Z"])).toBe("17-oktabr")
  })
})

const data: RoundTeamImageData = {
  numeral: "3",
  stage: "-tur",
  title: "Ramziy jamoa",
  subtitle: "16–17-oktabr o‘yinlarining eng yaxshi futbolchilari",
  season: "2026-yil, 1-mavsum",
  venue: "Birlik Arena",
  site: "",
  label: "3-tur",
  players: [
    { slot: "FW", position: "Hujumchi", firstName: "Sardor", lastName: "Karimov", teamName: "Lochin", team: null, number: 9, photoUrl: null, stats: "2 gol", goals: 2 },
    { slot: "GK", position: "Darvozabon", firstName: "Akmal", lastName: "Saidov", teamName: "Qayirma", team: null, number: 1, photoUrl: null, stats: "Darvozasini quruq saqladi", goals: 0 },
  ],
}

describe("ramziy jamoa posti", () => {
  it("darvozabondan boshlanadi, ko'rsatkichlar yoziladi, sayt manzili bo'lmasa liga nomi bilan tugaydi", () => {
    expect(roundTeamCaption(data).split("\n")).toEqual([
      "3-tur ramziy jamoasi",
      "Darvozabon: Akmal Saidov (Qayirma), darvozasini quruq saqladi",
      "Hujumchi: Sardor Karimov (Lochin), 2 gol",
      "Payariq Oltin Ligasi",
    ])
    expect(roundTeamCaption({ ...data, site: "payariqliga.uz" }).split("\n").at(-1)).toBe("Payariq Oltin Ligasi, payariqliga.uz")
  })

  it("kirill yozuvida rasm va post ham kirillcha, sayt manzili va fayl nomi lotincha qoladi", () => {
    const cyr = roundTeamImageInCyrillic({ ...data, site: "payariqliga.uz" })
    expect(cyr.title).toBe("Рамзий жамоа")
    expect(cyr.players[0].lastName).toBe("Каримов")
    const caption = roundTeamCaption(cyr)
    expect(caption).toContain("рамзий жамоаси")
    expect(caption).toContain("Пайариқ Олтин Лигаси, payariqliga.uz")
    expect(roundTeamFileName(data, 2026)).toBe("payariq-ramziy-jamoa-3-tur-2026.png")
  })
})
