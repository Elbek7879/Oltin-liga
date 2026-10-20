import { describe, expect, it } from "vitest"
import { roundOptions, roundStats, suggestRoundTeam } from "../round-team"
import type { Appearance, Match, MatchEvent, Position } from "../types"

const m = (id: string, round: number | null, home: string, away: string, hs: number | null, as: number | null, extra: Partial<Match> = {}): Match =>
  ({
    id,
    stage: round == null ? "PLAYOFF" : "GROUP",
    round,
    playoffRound: round == null ? "SF" : null,
    homeId: home,
    awayId: away,
    homeScore: hs,
    awayScore: as,
    status: hs == null ? "SCHEDULED" : "FINISHED",
    kickoff: "2026-10-16T15:00:00+05:00",
    ...extra,
  }) as Match

let n = 0
const ev = (matchId: string, type: MatchEvent["type"], team: string, playerId: string, assistId: string | null = null): MatchEvent => ({
  id: `e${n++}`,
  matchId,
  type,
  minute: 10,
  seasonTeamId: team,
  playerId,
  assistId,
})

// Jamoalar: A (a1 GK, a2 DF, a3 MF, a4 FW), B (b1..b4), C, D — xuddi shu tartibda
const rosters = ["A", "B", "C", "D"].flatMap((t) => [1, 2, 3, 4].map((i) => ({ playerId: `${t.toLowerCase()}${i}`, seasonTeamId: t })))
const POS: Position[] = ["GK", "DF", "MF", "FW"]
const positionOf = (id: string) => POS[Number(id.slice(1)) - 1]

describe("ramziy jamoa: turlar", () => {
  it("turlar tartibda, tugagani belgilanadi, bekor qilingan o‘yin hisobga olinmaydi; pley-off bosqich nomi bilan", () => {
    const opts = roundOptions([
      m("g2a", 2, "A", "C", null, null),
      m("g1a", 1, "A", "B", 2, 0),
      m("g1b", 1, "C", "D", 1, 1),
      m("g1c", 1, "A", "D", null, null, { status: "CANCELLED" }),
      m("sf", null, "A", "C", 3, 1),
    ])
    expect(opts.map((o) => [o.key, o.label, o.complete, o.matches.length])).toEqual([
      ["GROUP:1", "1-tur", true, 2],
      ["GROUP:2", "2-tur", false, 1],
      ["PLAYOFF:SF", "Yarim final", true, 1],
    ])
  })
})

describe("ramziy jamoa: tur ko‘rsatkichlari", () => {
  const round = { matches: [m("g1a", 1, "A", "B", 2, 0), m("g1b", 1, "C", "D", 1, 1)] }
  const events = [ev("g1a", "GOAL", "A", "a4", "a3"), ev("g1a", "PENALTY_GOAL", "A", "a4"), ev("g1b", "OWN_GOAL", "D", "d2"), ev("g1b", "GOAL", "D", "d4")]
  // A–B o'yinida tarkib kiritilgan (b4 o'ynamagan), C–D o'yinida kiritilmagan
  const appearances: Appearance[] = ["a1", "a2", "a3", "a4", "b1", "b2", "b3"].map((p) => ({ matchId: "g1a", seasonTeamId: p[0].toUpperCase(), playerId: p }))
  const stats = roundStats(round, { events, appearances, rosters })

  it("gollar, uzatmalar (avtogol gol hisoblanmaydi), natija va o‘tkazilgan gollar", () => {
    expect(stats.get("a4")).toMatchObject({ goals: 2, assists: 0, result: "W", score: "2:0", conceded: 0, played: true })
    expect(stats.get("a3")).toMatchObject({ goals: 0, assists: 1 })
    expect(stats.get("d2")).toMatchObject({ goals: 0, result: "D", score: "1:1" })
    expect(stats.get("b1")).toMatchObject({ result: "L", conceded: 2 })
  })

  it("tarkib kiritilgan o‘yinda faqat maydonga tushganlar, kiritilmaganida — jamoaning hammasi o‘ynagan", () => {
    expect(stats.get("b4")!.played).toBe(false)
    expect(stats.get("b3")!.played).toBe(true)
    expect(stats.get("c1")!.played).toBe(true)
  })

  it("penaltilar seriyasida g‘olib — winnerId bo‘yicha", () => {
    const pens = roundStats({ matches: [m("sf", null, "A", "C", 1, 1, { winnerId: "C" })] }, { events: [], appearances: [], rosters })
    expect(pens.get("a1")!.result).toBe("L")
    expect(pens.get("c1")!.result).toBe("W")
  })

  it("avtomatik taklif: har o‘ringa mos pozitsiyadagi eng yaxshisi, bir futbolchi bir marta", () => {
    const pick = suggestRoundTeam(stats, positionOf)
    expect(pick.GK).toBe("a1") // quruq o'yin va g'alaba
    expect(pick.FW).toBe("a4") // 2 gol
    expect(pick.MF_L).toBe("a3") // gol uzatmasi
    expect(new Set(Object.values(pick)).size).toBe(Object.values(pick).length)
    expect(pick.DF).toBe("a2") // quruq o'yin va g'alaba
  })

  it("o‘ynaganlar bo‘lmasa taklif bo‘sh; darvozabon o‘rniga boshqa pozitsiyadagi o‘yinchi qo‘yilmaydi", () => {
    const none = roundStats({ matches: [m("x", 1, "A", "B", null, null)] }, { events: [], appearances: [], rosters })
    expect(suggestRoundTeam(none, positionOf)).toEqual({})
    const noKeepers = new Map([...stats].filter(([id]) => !id.endsWith("1")))
    expect(suggestRoundTeam(noKeepers, positionOf).GK).toBeUndefined()
    // Pozitsiyasi kiritilmagan futbolchi ham darvozabon o'rniga taklif qilinmaydi
    expect(suggestRoundTeam(stats, () => null).GK).toBeUndefined()
  })

  it("admin tanlagan o‘rinlar saqlanadi, faqat bo‘sh o‘rinlar to‘ldiriladi", () => {
    const pick = suggestRoundTeam(stats, positionOf, { FW: "d4", GK: "c1" })
    expect(pick.FW).toBe("d4")
    expect(pick.GK).toBe("c1")
    expect(pick.MF_L).toBe("a3")
    expect(Object.keys(pick).sort()).toEqual(["DF", "FW", "GK", "MF_L", "MF_R"])
    expect(new Set(Object.values(pick)).size).toBe(5)
  })
})
