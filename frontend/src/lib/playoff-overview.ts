import type { SeasonBundle } from "@/api/types"
import {
  firstRoundFor,
  groupFinishes,
  playoffPlan,
  qualifiersFor,
  ROUND_LABELS,
  seedLotsFrom,
  type PlayoffPlan,
} from "@/domain/playoff"
import type { Group, ID, Match } from "@/domain/types"

/** Pley-off holati: admin paneli, bosh panel va muxlislar sahifasi uchun yagona hisob */
export interface PlayoffOverview {
  playoff: Match[]
  /** Kamida bitta pley-off o'yini o'tkazilgan — setka qotgan */
  started: boolean
  groupMatches: Match[]
  /** Guruh bosqichida qolgan o'yinlar */
  unfinished: number
  complete: boolean
  /** Joriy jadvallar bo'yicha reja (setka tuzilmagan bo'lsa — taxminiy) */
  plan: PlayoffPlan
  /** Pley-offga chiqishga ta'sir qiladigan, qur'a talab qiladigan guruh tengliklari */
  groupTies: { group: Group; teamIds: ID[] }[]
  /** Sanasi hali belgilanmagan pley-off o'yinlari */
  unconfirmed: Match[]
  groups: { group: Group; size: number; qualifiers: number }[]
}

export function playoffOverview(bundle: SeasonBundle): PlayoffOverview {
  const { matches, groups, standings, season } = bundle
  const playoff = matches.filter((m) => m.stage === "PLAYOFF")
  const groupMatches = matches.filter((m) => m.stage === "GROUP")
  const unfinished = groupMatches.filter((m) => m.status !== "FINISHED" && m.status !== "CANCELLED").length
  const sorted = [...groups].sort((a, b) => a.order - b.order)
  const plan = playoffPlan(groupFinishes(sorted, standings, season.rules), seedLotsFrom(bundle.lots ?? []))

  const groupTies: PlayoffOverview["groupTies"] = []
  for (const g of sorted) {
    const q = qualifiersFor(season.rules, g.seasonTeamIds.length)
    const rows = standings[g.id] ?? []
    const byPoints = new Map<number, typeof rows>()
    for (const r of rows) if (r.unresolvedTie) byPoints.set(r.points, [...(byPoints.get(r.points) ?? []), r])
    const teamIds = [...byPoints.values()].filter((c) => c.some((r) => r.position <= q)).flat().map((r) => r.seasonTeamId)
    if (teamIds.length > 0) groupTies.push({ group: g, teamIds })
  }

  return {
    playoff,
    started: playoff.some((m) => m.status === "FINISHED" || m.status === "LIVE"),
    groupMatches,
    unfinished,
    complete: groupMatches.length > 0 && unfinished === 0,
    plan,
    groupTies,
    unconfirmed: playoff.filter((m) => m.timeConfirmed === false),
    groups: sorted.map((g) => ({ group: g, size: g.seasonTeamIds.length, qualifiers: qualifiersFor(season.rules, g.seasonTeamIds.length) })),
  }
}

/** «20 ta jamoa chiqadi: 12 tasi to‘g‘ridan-to‘g‘ri 1/8 finalga, 8 tasi saralash o‘yinlarida (4 o‘yin)» */
export function planSummary(plan: Pick<PlayoffPlan, "seeds" | "bracketSize" | "playIns" | "error">) {
  if (plan.error || plan.bracketSize === 0) return plan.error ?? "Pley-off uchun yetarli jamoa yo‘q."
  const first = ROUND_LABELS[firstRoundFor(plan.bracketSize)!].toLowerCase()
  const n = plan.seeds.length
  if (plan.playIns.length === 0) return `${n} ta jamoa chiqadi — pley-off ${first}dan boshlanadi.`
  const direct = n - plan.playIns.length * 2
  return `${n} ta jamoa chiqadi: ${direct} tasi to‘g‘ridan-to‘g‘ri ${first}ga, ${plan.playIns.length * 2} tasi saralash o‘yinlarida (${plan.playIns.length} ta o‘yin) bo‘sh joylar uchun o‘ynaydi.`
}

/** Sana tasdiqlanmagan o'yin uchun matn */
export const UNCONFIRMED_DATE = "Sana belgilanmagan"
