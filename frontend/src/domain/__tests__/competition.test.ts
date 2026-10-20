import { describe, expect, it } from "vitest"
import { createSeed } from "@/api/mock/seed"
import { checkDraw, groupSizes, randomDraw, seededRandom } from "../draw"
import { addMinutesToTime, canDeleteGroupMatch, durationLabel, findScheduleConflicts, findVenueConflicts, nextMatchQueue, placeholderKickoff, primaryVenueId, roundRobin, venueBusyMinutes } from "../schedule"
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
  it("o‘yin davomiyligidan kam farq bilan o‘sha stadionga o‘yin qo‘yilsa ogohlantiradi (2×20 — 1 soat)", () => {
    expect(venueBusyMinutes()).toBe(60)
    expect(venueBusyMinutes(25)).toBe(70)
    expect(durationLabel(60)).toBe("1 soat")
    expect(durationLabel(70)).toBe("1 soat 10 daqiqa")
    // 2×20: soatma-soat 4–5 ta o'yin to'qnashmaydi
    expect(findVenueConflicts({ id: "new", venueId: "arena", kickoff: "2026-05-02T16:50:00+05:00" }, [busy])).toEqual([busy])
    expect(findVenueConflicts({ id: "new", venueId: "arena", kickoff: "2026-05-02T17:00:00+05:00" }, [busy])).toEqual([])
    // Uzunroq o'yin (2×45) — 2 soat
    expect(findVenueConflicts({ id: "new", venueId: "arena", kickoff: "2026-05-02T17:00:00+05:00" }, [busy], venueBusyMinutes(45))).toEqual([busy])
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

describe("navbatdagi o‘yinlar (kuniga 4–5 o‘yin)", () => {
  /** Guruhlar bo'yicha sanasiz juftliklar — qur'adan keyingi holat */
  function fixtures(groups: Record<string, string[]>) {
    const list: Match[] = []
    for (const [groupId, teams] of Object.entries(groups)) {
      for (const p of roundRobin(teams)) {
        list.push({ id: `${groupId}-${p.round}-${p.homeId}`, stage: "GROUP", groupId, round: p.round, homeId: p.homeId, awayId: p.awayId, status: "SCHEDULED", timeConfirmed: false, kickoff: "2026-11-01T12:00:00+05:00" } as Match)
      }
    }
    return list
  }
  const teamsOf = (ms: Match[]) => ms.flatMap((m) => [m.homeId, m.awayId])

  it("turlar tartibida, tur ichida guruhlar tartibida; bir kunda jamoa takrorlanmaydi", () => {
    const all = fixtures({ A: ["a1", "a2", "a3", "a4"], B: ["b1", "b2", "b3", "b4"], C: ["c1", "c2", "c3", "c4"] })
    const day = nextMatchQueue(all, ["A", "B", "C"], 5)
    expect(day.map((m) => `${m.groupId}${m.round}`)).toEqual(["A1", "A1", "B1", "B1", "C1"])
    expect(new Set(teamsOf(day)).size).toBe(10)
  })

  it("bitta 4 jamoali guruhda kuniga faqat 2 ta o‘yin chiqadi — hech kim kuniga ikki marta o‘ynamaydi", () => {
    const all = fixtures({ A: ["a1", "a2", "a3", "a4"] })
    const day1 = nextMatchQueue(all, ["A"], 5)
    expect(day1.map((m) => m.round)).toEqual([1, 1])
    // Birinchi kun saqlandi — navbatga 2-tur chiqadi
    const after = all.map((m) => (day1.includes(m) ? { ...m, timeConfirmed: true } : m))
    expect(nextMatchQueue(after, ["A"], 5).map((m) => m.round)).toEqual([2, 2])
  })

  it("navbatda qolgan o‘yin jamoasining keyingi tur o‘yini undan oldin chiqmaydi", () => {
    // 1-turning ikkinchi o'yini qoldirildi (sanasiz), 2-tur ham sanasiz: o'sha jamoalar 2-turga o'tib ketmaydi
    const all = fixtures({ A: ["a1", "a2", "a3", "a4"] })
    const firstDone = all.map((m, i) => (i === 0 ? { ...m, timeConfirmed: true, status: "FINISHED" as const } : m))
    const day = nextMatchQueue(firstDone, ["A"], 5)
    expect(day).toHaveLength(1)
    expect(day[0].round).toBe(1)
  })

  it("sanasi belgilangan, yakunlangan va bekor qilingan o‘yinlar navbatga kirmaydi; vaqtlar oralig‘i hisoblanadi", () => {
    const all = fixtures({ A: ["a1", "a2", "a3", "a4"] }).map((m, i) => (i < 2 ? { ...m, timeConfirmed: true } : i === 2 ? { ...m, status: "CANCELLED" as const } : m))
    expect(nextMatchQueue(all, ["A"], 5).every((m) => m.timeConfirmed === false && m.status === "SCHEDULED")).toBe(true)
    expect(addMinutesToTime("15:00", 60)).toBe("16:00")
    expect(addMinutesToTime("15:30", 4 * 60)).toBe("19:30")
    expect(addMinutesToTime("23:30", 60)).toBeNull()
  })
})

describe("guruh o‘yinini o‘chirish (davra tizimi buzilmasin)", () => {
  const base = { stage: "GROUP", groupId: "A", homeId: "a1", awayId: "a2", status: "SCHEDULED", timeConfirmed: true, kickoff: "2026-11-01T12:00:00+05:00" }
  it("juftlikning yagona o‘yini o‘chirilmaydi, qo‘lda qo‘shilgan ortiqchasi o‘chiriladi", () => {
    const only = { ...base, id: "m1" } as Match
    expect(canDeleteGroupMatch(only, [only], 1)).toBe(false)
    const extra = { ...base, id: "m2", homeId: "a2", awayId: "a1" } as Match
    expect(canDeleteGroupMatch(extra, [only, extra], 1)).toBe(true)
    // Ikki davrali turnirda ikkala o'yin ham kerak
    expect(canDeleteGroupMatch(extra, [only, extra], 2)).toBe(false)
    expect(canDeleteGroupMatch({ ...only, status: "FINISHED" } as Match, [only, extra], 1)).toBe(false)
  })
})
