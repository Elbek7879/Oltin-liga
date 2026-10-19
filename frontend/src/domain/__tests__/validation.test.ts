import { describe, expect, it } from "vitest"
import { computePlayerStats } from "../stats"
import { deriveOutcome, validateResult, type ResultInput } from "../validation"
import { played } from "./helpers"

const rosters: Record<string, Set<string>> = { H: new Set(["h1", "h2", "h3"]), A: new Set(["a1", "a2"]) }
const roster = (t: string) => rosters[t] ?? new Set<string>()
const name = (t: string) => (t === "H" ? "Uy" : "Mehmon")
const group = { stage: "GROUP" as const, homeId: "H", awayId: "A" }
const playoff = { stage: "PLAYOFF" as const, homeId: "H", awayId: "A" }

const base = (patch: Partial<ResultInput> = {}): ResultInput => ({ status: "FINISHED", homeScore: 0, awayScore: 0, events: [], ...patch })

describe("validateResult", () => {
  it("hisob va gol mualliflari soni mos bo‘lsa xato bermaydi", () => {
    const r = validateResult(group, base({ homeScore: 2, awayScore: 1, events: [
      { type: "GOAL", seasonTeamId: "H", playerId: "h1" },
      { type: "PENALTY_GOAL", seasonTeamId: "H", playerId: "h2" },
      { type: "GOAL", seasonTeamId: "A", playerId: "a1" },
    ] }), roster, name)
    expect(r.errors).toEqual([])
  })

  it("gollar soni hisobga mos kelmasa tushunarli xato beradi", () => {
    const r = validateResult(group, base({ homeScore: 3, awayScore: 1, events: [{ type: "GOAL", seasonTeamId: "H", playerId: "h1" }] }), roster, name)
    expect(r.errors.some((e) => e.includes("Uy: hisobda 3 ta gol, kiritilgan gollar esa 1 ta"))).toBe(true)
    expect(r.errors.some((e) => e.includes("Mehmon"))).toBe(true)
  })

  it("avtogolni raqib jamoa hisobiga yozadi", () => {
    const r = validateResult(group, base({ homeScore: 1, awayScore: 0, events: [{ type: "OWN_GOAL", seasonTeamId: "A", playerId: "a2" }] }), roster, name)
    expect(r.errors).toEqual([])
  })

  it("boshqa jamoa futbolchisini gol muallifi sifatida qabul qilmaydi", () => {
    const r = validateResult(group, base({ homeScore: 1, events: [{ type: "GOAL", seasonTeamId: "H", playerId: "a1" }] }), roster, name)
    expect(r.errors.some((e) => e.includes("tarkibida yo‘q"))).toBe(true)
  })

  it("rejalashtirilgan o‘yinga gol kiritishga ruxsat bermaydi", () => {
    const r = validateResult(group, { status: "SCHEDULED", homeScore: null, awayScore: null, events: [{ type: "GOAL", seasonTeamId: "H", playerId: "h1" }] }, roster, name)
    expect(r.errors.length).toBe(1)
  })

  it("pley-offda durang bo‘lsa qo‘shimcha vaqt va penaltilarni talab qiladi", () => {
    expect(validateResult(playoff, base({ homeScore: 1, awayScore: 1, events: [
      { type: "GOAL", seasonTeamId: "H", playerId: "h1" },
      { type: "GOAL", seasonTeamId: "A", playerId: "a1" },
    ] }), roster, name).errors[0]).toContain("Qo‘shimcha vaqt")

    const pensEqual = validateResult(playoff, base({ homeScore: 0, awayScore: 0, homeExtra: 0, awayExtra: 0, homePens: 3, awayPens: 3 }), roster, name)
    expect(pensEqual.errors.some((e) => e.includes("g‘olib bo‘lishi kerak"))).toBe(true)

    const ok = validateResult(playoff, base({ homeScore: 0, awayScore: 0, homeExtra: 0, awayExtra: 0, homePens: 4, awayPens: 3 }), roster, name)
    expect(ok.errors).toEqual([])
  })

  it("noma’lum muallifli gol uchun ogohlantirish beradi, lekin saqlashga ruxsat beradi", () => {
    const r = validateResult(group, base({ homeScore: 1, events: [{ type: "GOAL", seasonTeamId: "H", playerId: null }] }), roster, name)
    expect(r.errors).toEqual([])
    expect(r.warnings.length).toBe(1)
  })
})

describe("deriveOutcome", () => {
  it("texnik mag‘lubiyatni 3:0 deb yozadi", () => {
    expect(deriveOutcome(group, base({ forfeitLoser: "away" }))).toMatchObject({ homeScore: 3, awayScore: 0, decidedBy: "FORFEIT", winnerId: "H" })
  })
  it("penaltilar g‘olibini aniqlaydi", () => {
    expect(deriveOutcome(playoff, base({ homeScore: 1, awayScore: 1, homeExtra: 0, awayExtra: 0, homePens: 2, awayPens: 4 }))).toMatchObject({ decidedBy: "PENALTIES", winnerId: "A" })
  })
  it("guruh bosqichida durangda g‘olib yo‘q", () => {
    expect(deriveOutcome(group, base({ homeScore: 2, awayScore: 2 })).winnerId).toBeNull()
  })
})

describe("computePlayerStats", () => {
  it("avtogolni futbolchi gollariga qo‘shmaydi, assistni hisoblaydi", () => {
    const m = played("H", "A", 2, 1)
    const stats = computePlayerStats(
      [m],
      [
        { id: "1", matchId: m.id, type: "GOAL", seasonTeamId: "H", playerId: "h1", assistId: "h2" },
        { id: "2", matchId: m.id, type: "OWN_GOAL", seasonTeamId: "A", playerId: "a1" },
        { id: "3", matchId: m.id, type: "GOAL", seasonTeamId: "A", playerId: "a2" },
        { id: "4", matchId: m.id, type: "YELLOW", seasonTeamId: "H", playerId: "h1" },
      ],
      [],
    )
    const get = (id: string) => stats.find((s) => s.playerId === id)!
    expect(get("h1")).toMatchObject({ goals: 1, yellow: 1 })
    expect(get("h2")).toMatchObject({ assists: 1, goals: 0 })
    expect(get("a1")).toMatchObject({ goals: 0, ownGoals: 1 })
    expect(get("a2").goals).toBe(1)
  })
})
