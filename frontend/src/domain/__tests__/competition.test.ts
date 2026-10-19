import { describe, expect, it } from "vitest"
import { createSeed } from "@/api/mock/seed"
import { checkDraw, groupSizes, randomDraw, seededRandom } from "../draw"
import { findScheduleConflicts, findVenueConflicts, placeholderKickoff, primaryVenueId, roundRobin } from "../schedule"
import { goalsFromEvents } from "../validation"
import type { Match } from "../types"

describe("roundRobin", () => {
  for (const n of [4, 5, 6]) {
    it(`${n} ta jamoada har juftlik bir marta o‘ynaydi va turda jamoa takrorlanmaydi`, () => {
      const teams = Array.from({ length: n }, (_, i) => `T${i}`)
      const pairs = roundRobin(teams)
      expect(pairs.length).toBe((n * (n - 1)) / 2)
      const keys = new Set(pairs.map((p) => [p.homeId, p.awayId].sort().join("-")))
      expect(keys.size).toBe(pairs.length)
      const rounds = new Map<number, string[]>()
      for (const p of pairs) rounds.set(p.round, [...(rounds.get(p.round) ?? []), p.homeId, p.awayId])
      for (const list of rounds.values()) expect(new Set(list).size).toBe(list.length)
    })
  }

  it("ikki davrali formatda uy va mehmon almashadi", () => {
    const pairs = roundRobin(["A", "B", "C", "D"], 2)
    expect(pairs.length).toBe(12)
    const ab = pairs.filter((p) => [p.homeId, p.awayId].sort().join() === "A,B")
    expect(ab.length).toBe(2)
    expect(ab[0].homeId).toBe(ab[1].awayId)
  })

  it("sanasiz o‘yinning tartib vaqti turlar ketma-ketligini saqlaydi", () => {
    expect(placeholderKickoff("2026-05-02", 1)).toBe("2026-05-02T12:00:00+05:00")
    expect(placeholderKickoff("2026-05-02", 3)).toBe("2026-05-16T12:00:00+05:00")
  })
})

describe("stadion bandligi", () => {
  const busy = { id: "x", homeId: "A", awayId: "B", venueId: "arena", kickoff: "2026-05-02T16:00:00+05:00", status: "SCHEDULED" } as Match
  it("2 soatdan kam farq bilan o‘sha stadionga o‘yin qo‘yilsa ogohlantiradi", () => {
    expect(findVenueConflicts({ id: "new", venueId: "arena", kickoff: "2026-05-02T17:00:00+05:00" }, [busy])).toEqual([busy])
    expect(findVenueConflicts({ id: "new", venueId: "arena", kickoff: "2026-05-02T18:00:00+05:00" }, [busy])).toEqual([])
    expect(findVenueConflicts({ id: "new", venueId: "boshqa", kickoff: "2026-05-02T16:00:00+05:00" }, [busy])).toEqual([])
    expect(findVenueConflicts({ id: "x", venueId: "arena", kickoff: "2026-05-02T16:00:00+05:00" }, [busy])).toEqual([])
    expect(findVenueConflicts({ id: "new", venueId: "arena", kickoff: "2026-05-02T16:00:00+05:00" }, [{ ...busy, status: "POSTPONED" }])).toEqual([])
  })

  it("namunaviy taqvimda bitta stadionda ustma-ust o‘yin yo‘q", () => {
    const db = createSeed()
    expect(db.venues).toHaveLength(1)
    for (const m of db.matches) expect(findVenueConflicts(m, db.matches)).toEqual([])
  })

  it("asosiy stadion — eng ko‘p o‘yin o‘tgani, o‘yin bo‘lmasa birinchisi", () => {
    const venues = [{ id: "maydon" }, { id: "arena" }]
    expect(primaryVenueId(venues, [{ venueId: "arena" }, { venueId: "arena" }, { venueId: "maydon" }])).toBe("arena")
    expect(primaryVenueId(venues, [])).toBe("maydon")
    expect(primaryVenueId([], [])).toBeNull()
  })
})

describe("findScheduleConflicts", () => {
  it("bir jamoaga yaqin vaqtda ikkinchi o‘yin belgilansa ogohlantiradi", () => {
    const existing = { id: "x", homeId: "A", awayId: "B", kickoff: "2026-05-02T16:00:00+05:00", status: "SCHEDULED" } as Match
    const conflicts = findScheduleConflicts({ id: "new", homeId: "C", awayId: "A", kickoff: "2026-05-02T18:00:00+05:00" }, [existing])
    expect(conflicts).toEqual([{ matchId: "x", teamId: "A", kickoff: existing.kickoff }])
    expect(findScheduleConflicts({ id: "new", homeId: "C", awayId: "A", kickoff: "2026-05-09T18:00:00+05:00" }, [existing])).toEqual([])
  })
})

describe("qur’a", () => {
  it("30 ta jamoani 8 guruhga muvozanatli taqsimlaydi", () => {
    expect(groupSizes(30, 8)).toEqual([4, 4, 4, 4, 4, 4, 3, 3])
    const teams = Array.from({ length: 30 }, (_, i) => `T${i}`)
    const groups = randomDraw(teams, 8, seededRandom(7))
    expect(groups.map((g) => g.teamIds.length)).toEqual([4, 4, 4, 4, 4, 4, 3, 3])
    expect(new Set(groups.flatMap((g) => g.teamIds)).size).toBe(30)
    expect(checkDraw(groups, teams).ok).toBe(true)
  })

  it("bir jamoa ikki guruhga tushsa xato beradi", () => {
    const check = checkDraw([{ name: "A", teamIds: ["x", "y"] }, { name: "B", teamIds: ["x", "z"] }], ["x", "y", "z"])
    expect(check.ok).toBe(false)
    expect(check.errors[0]).toContain("ikki guruhga")
  })
})


describe("namunaviy ma’lumotlar", () => {
  it("har bir yakunlangan o‘yinda gollar soni hisobga teng", () => {
    const db = createSeed(new Date("2026-10-15T09:00:00Z"))
    const finished = db.matches.filter((m) => m.status === "FINISHED" || m.status === "LIVE")
    expect(finished.length).toBeGreaterThan(30)
    for (const m of finished) {
      if (m.decidedBy === "FORFEIT") continue
      const events = db.events.filter((e) => e.matchId === m.id)
      const goals = goalsFromEvents(events, m.homeId!, m.awayId!)
      expect(goals.home).toBe(m.homeScore! + (m.homeExtra ?? 0))
      expect(goals.away).toBe(m.awayScore! + (m.awayExtra ?? 0))
    }
  })

  it("2025-mavsum chempioni final g‘olibiga teng", () => {
    const db = createSeed(new Date("2026-10-15T09:00:00Z"))
    const final = db.matches.find((m) => m.seasonId === "s2025" && m.playoffRound === "F")!
    const champion = db.awards.find((a) => a.seasonId === "s2025" && a.type === "CHAMPION")!
    expect(final.decidedBy).toBe("PENALTIES")
    expect(champion.seasonTeamId).toBe(final.winnerId)
  })
})
