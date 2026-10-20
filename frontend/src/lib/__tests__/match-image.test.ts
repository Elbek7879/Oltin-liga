import { describe, expect, it } from "vitest"
import type { Match, MatchEvent } from "@/domain/types"
import { matchCaption, publicSiteName, scorerLines, type MatchImageData } from "../match-image"

const match = { id: "m", homeId: "A", awayId: "B", status: "FINISHED", homeScore: 3, awayScore: 1 } as Match
const players: Record<string, { firstName: string; lastName: string }> = {
  p1: { firstName: "Zafar", lastName: "Ochilov" },
  p2: { firstName: "Jasur", lastName: "Karimov" },
  q1: { firstName: "Bekzod", lastName: "Nazarov" },
}
const index = { player: (id: string | null | undefined) => (id ? (players[id] as never) : undefined) }
let n = 0
const ev = (type: MatchEvent["type"], playerId: string | null, team: string, minute: number | null): MatchEvent => ({
  id: `e${n++}`,
  matchId: "m",
  type,
  minute,
  playerId,
  seasonTeamId: team,
  assistId: null,
})

describe("natija rasmi: gol urganlar", () => {
  it("bir futbolchining gollari bitta qatorga yig‘iladi, penalti belgilanadi", () => {
    const lines = scorerLines(match, [ev("GOAL", "p1", "A", 12), ev("PENALTY_GOAL", "p1", "A", 67), ev("GOAL", "q1", "B", 30)], index)
    expect(lines.home).toEqual(["Zafar Ochilov 12′, 67′ (p)"])
    expect(lines.away).toEqual(["Bekzod Nazarov 30′"])
  })

  it("avtogol foyda olgan jamoa tomonida ko‘rsatiladi", () => {
    const lines = scorerLines(match, [ev("OWN_GOAL", "q1", "B", 80)], index)
    expect(lines.home).toEqual(["Bekzod Nazarov 80′ (a.g.)"])
    expect(lines.away).toEqual([])
  })

  it("muallifi noma’lum gol va daqiqasiz gol ham yoziladi, kartochkalar gol emas", () => {
    const lines = scorerLines(match, [ev("GOAL", null, "A", null), ev("YELLOW", "p2", "A", 40), ev("GOAL", "p2", "A", null)], index)
    expect(lines.home).toEqual(["Muallif noma’lum", "Jasur Karimov"])
  })
})

describe("natija rasmi: post matni", () => {
  const base: MatchImageData = {
    kind: "result",
    badge: "Yakuniy hisob",
    season: "2026-yil, 2-mavsum",
    stage: "A guruhi, 2-tur",
    home: { name: "Qayirma", team: null, scorers: ["Zafar Ochilov 12′"], reds: [], dimmed: false },
    away: { name: "Cho‘rsh", team: null, scorers: [], reds: [], dimmed: true },
    score: { home: 2, away: 0 },
    note: null,
    time: "15:00",
    date: "Shanba, 2026-yil 18-oktabr",
    when: { weekday: "Shanba", day: 18, month: "oktabr", year: 2026 },
    venue: "Mirzacho‘l Birlik Arena",
    site: "",
  }

  it("natija, gollar, sana va stadionni o‘z ichiga oladi", () => {
    expect(matchCaption(base)).toBe(
      ["A guruhi, 2-tur", "Qayirma 2:0 Cho‘rsh", "Gollar: Zafar Ochilov 12′ (Qayirma)", "Shanba, 2026-yil 18-oktabr, 15:00, Mirzacho‘l Birlik Arena", "Payariq Oltin Ligasi"].join("\n"),
    )
  })

  it("anonsda hisob o‘rniga jamoalar, sana belgilanmagan bo‘lsa ogohlantirish", () => {
    const text = matchCaption({ ...base, kind: "preview", score: null, date: null, time: null, when: null, home: { ...base.home, scorers: [] } })
    expect(text.split("\n")[1]).toBe("Qayirma — Cho‘rsh")
    expect(text).toContain("Sana tez orada e’lon qilinadi")
  })

  it("sayt domeni bo‘lsa, oxirgi qatorga qo‘shiladi", () => {
    expect(matchCaption({ ...base, site: "payariqliga.uz" }).split("\n").at(-1)).toBe("Payariq Oltin Ligasi, payariqliga.uz")
  })
})

describe("natija rasmi: sayt manzili", () => {
  it("localhost, IP manzil va port rasmga chiqmaydi", () => {
    for (const host of ["localhost:5173", "127.0.0.1:8080", "192.168.1.20", "[::1]:5173", "liga.localhost", "", "server"]) {
      expect(publicSiteName(host)).toBe("")
    }
  })

  it("haqiqiy domen portsiz va «www.»siz yoziladi", () => {
    expect(publicSiteName("www.payariqliga.uz")).toBe("payariqliga.uz")
    expect(publicSiteName("Payariqliga.uz:443")).toBe("payariqliga.uz")
  })
})

describe("natija rasmi: kirill yozuvida", () => {
  it("rasm ma’lumotlari va post matni kirillcha, sayt domeni o‘zgarmaydi", async () => {
    const { matchImageInCyrillic } = await import("../match-image")
    const d: MatchImageData = {
      kind: "result",
      badge: "Yakuniy hisob",
      season: "2026-yil, 2-mavsum",
      stage: "A guruhi, 2-tur",
      home: { name: "Qayirma", team: null, scorers: ["Zafar Ochilov 12′"], reds: [], dimmed: false },
      away: { name: "Cho‘rsh", team: null, scorers: [], reds: [], dimmed: true },
      score: { home: 2, away: 0 },
      note: null,
      time: "15:00",
      date: "Shanba, 2026-yil 18-oktabr",
      when: { weekday: "Shanba", day: 18, month: "oktabr", year: 2026 },
      venue: "Mirzacho‘l Birlik Arena",
      site: "payariqliga.uz",
    }
    const c = matchImageInCyrillic(d)
    expect(c.badge).toBe("Якуний ҳисоб")
    expect(c.home.name).toBe("Қайирма")
    expect(c.when?.weekday).toBe("Шанба")
    expect(matchCaption(c).split("\n")).toEqual([
      "А гуруҳи, 2-тур",
      "Қайирма 2:0 Чўрш",
      "Голлар: Зафар Очилов 12′ (Қайирма)",
      "Шанба, 2026-йил 18-октабр, 15:00, Мирзачўл Бирлик Арена",
      "Пайариқ Олтин Лигаси, payariqliga.uz",
    ])
  })
})
