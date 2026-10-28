import { describe, expect, it } from "vitest"
import { defaultSeasonRules } from "@/api/defaults"
import { groupOptions, seededRandom, shuffle } from "../draw"
import { advancementUpdates, createBracket, isPlayInRound, playoffPlan, qualifiersFor, type GroupFinish, type TeamRecord } from "../playoff"
import type { Match } from "../types"

/*
 * Har mavsumda jamoalar soni har xil bo'ladi (20, 25, 30, 32 ...). Har bir son va sayt taklif qiladigan har bir guruh varianti uchun:
 * guruhlar → jadval (tasodifiy va hammasi teng) → teng holatlar qur'asi → setka → final o'ynalguncha — hech qayerda uzilish bo'lmasin.
 */

const DEFAULT = defaultSeasonRules()
/** Tashkilotchi nizomda chiqadiganlar sonini o'zgartirishi mumkin: standart, faqat g'oliblar, ko'proq jamoa */
const RULE_SETS = [
  { name: "standart nizom", rules: DEFAULT },
  { name: "faqat guruh g'oliblari", rules: { ...DEFAULT, qualifiersBySize: { 3: 1, 4: 1, 5: 1, 6: 1 } } },
  { name: "ko'proq jamoa chiqadi", rules: { ...DEFAULT, qualifiersBySize: { 3: 2, 4: 3, 5: 4, 6: 5 } } },
]

type Mode = "random" | "flat"

/** Guruh jadvali: tasodifiy natijalar yoki hamma jamoa bir xil (eng ko'p teng holat) */
function table(prefix: string, size: number, mode: Mode, random: () => number): TeamRecord[] {
  const rows = Array.from({ length: size }, (_, i) => {
    const played = size - 1
    if (mode === "flat") return { seasonTeamId: `${prefix}${i}`, played, points: played, goalDiff: 0, goalsFor: played, fairPlay: 0 }
    const points = Math.floor(random() * (played * 3 + 1))
    return { seasonTeamId: `${prefix}${i}`, played, points, goalDiff: Math.floor(random() * 7) - 3, goalsFor: Math.floor(random() * 6), fairPlay: Math.floor(random() * 3) }
  })
  return rows.sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor)
}

/** Qur'a natijasi o'rin bo'yicha birlashtiriladi — server va mock bilan bir xil (bir o'rinda bir nechta alohida teng holat) */
function drawLots(plan: ReturnType<typeof playoffPlan>, lots: Record<number, string[]>, random: () => number) {
  for (const tie of plan.ties) {
    const order = shuffle(tie.seasonTeamIds, random)
    lots[tie.position] = [...(lots[tie.position] ?? []).filter((id) => !order.includes(id)), ...order]
  }
}

/** Setkani final o'ynalguncha o'tkazadi; har o'yinda g'olib tasodifiy */
function playOut(matches: Match[], random: () => number) {
  const byId = new Map(matches.map((m) => [m.id, { ...m }]))
  const order = ["R64", "R32", "R16", "QF", "SF", "THIRD", "F"]
  const sorted = [...byId.values()].sort((a, b) => order.indexOf(a.playoffRound!) - order.indexOf(b.playoffRound!) || a.bracketIndex! - b.bracketIndex!)
  const played = new Map<string, Set<string>>()
  for (const m of sorted) {
    const current = byId.get(m.id)!
    expect(current.homeId, `${current.playoffRound} ${current.bracketIndex}: uy jamoasi yo'q`).toBeTruthy()
    expect(current.awayId, `${current.playoffRound} ${current.bracketIndex}: mehmon jamoasi yo'q`).toBeTruthy()
    expect(current.homeId).not.toBe(current.awayId)
    const round = played.get(current.playoffRound!) ?? new Set<string>()
    for (const t of [current.homeId!, current.awayId!]) {
      expect(round.has(t), `${t} bir bosqichda ikki marta o'ynayapti`).toBe(false)
      round.add(t)
    }
    played.set(current.playoffRound!, round)
    current.status = "FINISHED"
    current.winnerId = random() < 0.5 ? current.homeId : current.awayId
    for (const u of advancementUpdates(current)) {
      const next = byId.get(u.matchId)!
      if (u.slot === "home") next.homeId = u.seasonTeamId
      else next.awayId = u.seasonTeamId
    }
  }
  return [...byId.values()].find((m) => m.playoffRound === "F")!.winnerId
}

describe.each(RULE_SETS)("jamoalar soni har xil bo'lganda (6–64) guruhlar va pley-off: $name", ({ rules }) => {
  const counts = Array.from({ length: 59 }, (_, i) => i + 6)
  for (const n of counts) {
    it(`${n} ta jamoa`, () => {
      const options = groupOptions(n, (size) => qualifiersFor(rules, size))
      expect(options.length, "kamida bitta variant").toBeGreaterThan(0)
      expect(options.filter((o) => o.recommended)).toHaveLength(1)
      for (const option of options) {
        expect(option.sizes.reduce((a, b) => a + b, 0)).toBe(n)
        expect(Math.max(...option.sizes) - Math.min(...option.sizes)).toBeLessThanOrEqual(1)
        expect(Math.min(...option.sizes)).toBeGreaterThanOrEqual(3)
        for (const mode of ["random", "flat"] as Mode[]) {
          for (let seed = 1; seed <= (mode === "flat" ? 1 : 5); seed++) {
            const random = seededRandom(n * 1000 + option.groups * 10 + seed)
            const groups: GroupFinish[] = option.sizes.map((size, g) => ({
              name: "ABCDEFGHIJKLMNOP"[g],
              table: table("ABCDEFGHIJKLMNOP"[g], size, mode, random),
              qualifiers: qualifiersFor(rules, size),
            }))
            const lots: Record<number, string[]> = {}
            let plan = playoffPlan(groups, lots)
            if (plan.ties.length > 0) {
              drawLots(plan, lots, random)
              plan = playoffPlan(groups, lots)
            }
            const where = `${n} jamoa, ${option.groups} guruh, ${mode} #${seed}`
            // Bitta guruhdan bitta jamoa chiqsa pley-off bo'lmaydi — sayt buni xato sifatida aytadi
            if (option.qualified < 2) {
              expect(plan.error, where).toBeTruthy()
              continue
            }
            expect(plan.error, where).toBeUndefined()
            expect(plan.ties, `${where}: qur'adan keyin ham teng holat qoldi`).toHaveLength(0)
            expect(plan.seeds).toHaveLength(option.qualified)
            expect(plan.bracketSize).toBe(option.bracketSize)
            expect(plan.playIns).toHaveLength(option.playIns)
            expect(new Set(plan.seeds.map((s) => s.seasonTeamId)).size).toBe(option.qualified)

            const matches = createBracket({ seasonId: "s", plan, thirdPlace: true, kickoffFor: () => "2027-06-01T10:00:00+05:00", newId: (() => { let i = 0; return () => `m${i++}` })() })
            const third = plan.bracketSize >= 4 ? 1 : 0
            expect(matches, where).toHaveLength(option.playIns + plan.bracketSize - 1 + third)
            // Saralash bosqichi saytda «Saralash o‘yinlari» deb chiqadi, asosiy bosqichlar o'z nomi bilan
            const rounds = [...new Set(matches.map((m) => m.playoffRound!))]
            const playInRounds = rounds.filter((r) => isPlayInRound(r, matches))
            expect(playInRounds, where).toHaveLength(option.playIns > 0 ? 1 : 0)
            const champion = playOut(matches, random)
            expect(plan.seeds.some((s) => s.seasonTeamId === champion), `${where}: chempion aniqlanmadi`).toBe(true)
          }
        }
      }
    })
  }
})
