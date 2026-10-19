import { describe, expect, it } from "vitest"
import {
  advancementUpdates,
  bracketSeedOrder,
  createBracket,
  isPlayInRound,
  playoffPlan,
  qualifiersFor,
  roundLabel,
  type GroupFinish,
  type PlayoffPlan,
  type TeamRecord,
} from "../playoff"

let uid = 0
const nextId = () => `t${uid++}`

/** size jamoali guruh: jadval tartibida, har jamoa (size-1) ta o'yin o'ynagan, ochkolar kamayib boradi (BracketTest.java bilan bir xil) */
function group(name: string, size: number, qualifiers: number): GroupFinish {
  const table: TeamRecord[] = Array.from({ length: size }, (_, i) => ({
    seasonTeamId: nextId(),
    played: size - 1,
    points: (size - 1 - i) * 3,
    goalDiff: size - 1 - 2 * i,
    goalsFor: 10 - i,
    fairPlay: 0,
  }))
  return { name, table, qualifiers }
}

function groups(fives: number, fours: number) {
  const list: GroupFinish[] = []
  let letter = 65
  for (let i = 0; i < fives; i++) list.push(group(String.fromCharCode(letter++), 5, 3))
  for (let i = 0; i < fours; i++) list.push(group(String.fromCharCode(letter++), 4, 2))
  return list
}

const groupOf = (plan: PlayoffPlan) => new Map(plan.seeds.map((s) => [s.seasonTeamId, s.groupName]))

describe("moslashuvchan pley-off", () => {
  it.each([
    [0, 5, 10, 8, 2],
    [4, 0, 12, 8, 4],
    [0, 9, 18, 16, 2],
    [4, 4, 20, 16, 4],
    [0, 10, 20, 16, 4],
    [8, 0, 24, 16, 8],
    [0, 8, 16, 16, 0],
  ])("%i ta 5 jamoali + %i ta 4 jamoali guruh: %i jamoa chiqadi, setka %i, saralash %i", (fives, fours, qualified, size, playIns) => {
    const plan = playoffPlan(groups(fives, fours))
    expect(plan.error).toBeUndefined()
    expect(plan.seeds).toHaveLength(qualified)
    expect(plan.bracketSize).toBe(size)
    expect(plan.playIns).toHaveLength(playIns)
    expect(plan.slots).toHaveLength(size)
    expect(plan.slots.filter((s) => s.playInIndex !== null)).toHaveLength(playIns)
    expect(plan.seeds.slice(0, fives + fours).every((s) => s.position === 1)).toBe(true)
    expect(plan.playIns.every((p) => p.home.position > 1 && p.away.position > 1)).toBe(true)
  })

  it("bitta guruh jamoalari saralashda ham, birinchi bosqichda ham uchrashmaydi", () => {
    for (const [f, g] of [[4, 4], [0, 9], [8, 0], [0, 5], [4, 0], [0, 8], [1, 1], [0, 2], [0, 10]]) {
      const plan = playoffPlan(groups(f, g))
      const of = groupOf(plan)
      expect(plan.playIns.every((p) => p.home.groupName !== p.away.groupName)).toBe(true)
      for (let i = 0; i < plan.slots.length; i += 2) {
        const a = plan.slots[i].seasonTeamId
        const b = plan.slots[i + 1].seasonTeamId
        if (a && b) expect(of.get(a), `${f}+${g} guruh, ${i / 2}-juftlik`).not.toBe(of.get(b))
      }
    }
  })

  it("har xil hajmdagi guruhlar o‘yin boshiga o‘rtacha ko‘rsatkich bilan solishtiriladi", () => {
    const r = (id: string, played: number, points: number, goalDiff: number, goalsFor: number): TeamRecord => ({ seasonTeamId: id, played, points, goalDiff, goalsFor, fairPlay: 0 })
    const a: GroupFinish = { name: "A", qualifiers: 3, table: [r("five", 4, 10, 6, 9), r("a2", 4, 7, 2, 6), r("a3", 4, 6, 0, 5), r("a4", 4, 3, -3, 3), r("a5", 4, 1, -5, 2)] }
    const b: GroupFinish = { name: "B", qualifiers: 2, table: [r("four", 3, 9, 5, 7), r("b2", 3, 6, 1, 5), r("b3", 3, 3, -2, 3), r("b4", 3, 0, -4, 1)] }
    const plan = playoffPlan([a, b])
    expect(plan.seeds[0].seasonTeamId).toBe("four")
    expect(plan.seeds[1].seasonTeamId).toBe("five")
  })

  it("reytingda to‘liq teng jamoalar qur’a bilan ajratiladi", () => {
    const rec = (id: string): TeamRecord => ({ seasonTeamId: id, played: 3, points: 7, goalDiff: 4, goalsFor: 6, fairPlay: 1 })
    const low = (id: string): TeamRecord => ({ seasonTeamId: id, played: 3, points: 3, goalDiff: 0, goalsFor: 3, fairPlay: 0 })
    const gs: GroupFinish[] = [
      { name: "A", qualifiers: 1, table: [rec("x"), low("ax")] },
      { name: "B", qualifiers: 1, table: [rec("y"), low("by")] },
    ]
    expect(playoffPlan(gs).ties).toEqual([{ position: 1, seasonTeamIds: ["x", "y"] }])
    const withLot = playoffPlan(gs, { 1: ["y", "x"] })
    expect(withLot.ties).toEqual([])
    expect(withLot.seeds[0].seasonTeamId).toBe("y")
  })

  it("saralash g‘olibi setkadagi o‘z joyiga, yarim final g‘olibi finalga, mag‘lubi 3-o‘rin o‘yiniga o‘tadi", () => {
    let id = 0
    const plan = playoffPlan(groups(4, 4))
    const all = createBracket({ seasonId: "s", plan, thirdPlace: true, kickoffFor: () => "2026-06-01T16:00:00+05:00", newId: () => `m${id++}` })
    expect(all).toHaveLength(4 + 8 + 4 + 2 + 1 + 1)
    const byId = new Map(all.map((m) => [m.id, m]))
    const playIns = all.filter((m) => m.playoffRound === "R32")
    expect(playIns).toHaveLength(4)
    for (const p of playIns) {
      const next = byId.get(p.nextMatchId!)!
      expect(next.playoffRound).toBe("R16")
      expect(p.nextSlot === "home" ? next.homeId : next.awayId).toBeNull()
      expect(p.nextSlot === "home" ? next.awayId : next.homeId).not.toBeNull()
    }
    expect(isPlayInRound("R32", all)).toBe(true)
    expect(isPlayInRound("R16", all)).toBe(false)
    expect(roundLabel("R32", all)).toBe("Saralash o‘yinlari")
    const sf = { ...all.find((m) => m.playoffRound === "SF")!, homeId: "h", awayId: "a", status: "FINISHED" as const, winnerId: "h" }
    const fin = all.find((m) => m.playoffRound === "F")!
    const third = all.find((m) => m.playoffRound === "THIRD")!
    expect(advancementUpdates(sf)).toEqual([
      { matchId: fin.id, slot: "home", seasonTeamId: "h" },
      { matchId: third.id, slot: "home", seasonTeamId: "a" },
    ])
  })

  it("klassik tartib, chekka holatlar va guruh hajmi qoidasi", () => {
    expect(bracketSeedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6])
    expect(playoffPlan([group("A", 2, 1)]).error).toContain("kamida 2")
    const three = playoffPlan([group("A", 4, 2), group("B", 4, 1)])
    expect(three.bracketSize).toBe(2)
    expect(three.playIns).toHaveLength(1)
    const rules = { qualifiersPerGroup: 2, qualifiersBySize: { 4: 2, 5: 3 } }
    expect(qualifiersFor(rules, 4)).toBe(2)
    expect(qualifiersFor(rules, 5)).toBe(3)
    expect(qualifiersFor(rules, 3)).toBe(2)
    expect(qualifiersFor({ qualifiersPerGroup: 4, qualifiersBySize: {} }, 3)).toBe(2)
  })
})
