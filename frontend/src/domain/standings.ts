import type { FormResult, ID, Match, MatchEvent, PointAdjustment, SeasonRules, Tiebreaker } from "./types"

export interface StandingRow {
  seasonTeamId: ID
  position: number
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDiff: number
  /** Jarima yoki bonus ochkolari yig'indisi (odatda 0) */
  adjustment: number
  points: number
  fairPlay: number
  /** Oxirgi 5 ta o'yin, eskidan yangiga */
  form: FormResult[]
  /** Mezonlar orqali ajratib bo'lmagan teng jamoalar (qur'a kerak) */
  unresolvedTie: boolean
}

export const FAIR_PLAY_POINTS: Record<string, number> = {
  YELLOW: 1,
  SECOND_YELLOW: 3,
  RED: 3,
}

export const TIEBREAKER_LABELS: Record<Tiebreaker, string> = {
  H2H_POINTS: "O‘zaro o‘yinlardagi ochkolar",
  H2H_GOAL_DIFF: "O‘zaro o‘yinlardagi to‘plar farqi",
  H2H_GOALS: "O‘zaro o‘yinlarda urilgan gollar",
  GOAL_DIFF: "Umumiy to‘plar farqi",
  GOALS_FOR: "Urilgan gollar soni",
  WINS: "G‘alabalar soni",
  FAIR_PLAY: "Fair Play (kamroq kartochka)",
}

/** Faqat yakunlangan va hisobi bor o'yinlar jadvalga ta'sir qiladi */
export function countsForTable(m: Match): m is Match & { homeId: ID; awayId: ID; homeScore: number; awayScore: number } {
  return (
    m.status === "FINISHED" &&
    m.homeId != null &&
    m.awayId != null &&
    m.homeScore != null &&
    m.awayScore != null
  )
}

interface Tally {
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  points: number
}

function emptyTally(): Tally {
  return { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 }
}

function tallyMatches(teamIds: ID[], matches: Match[], rules: SeasonRules): Map<ID, Tally> {
  const set = new Set(teamIds)
  const table = new Map<ID, Tally>(teamIds.map((id) => [id, emptyTally()]))
  for (const m of matches) {
    if (!countsForTable(m) || !set.has(m.homeId) || !set.has(m.awayId)) continue
    const home = table.get(m.homeId)!
    const away = table.get(m.awayId)!
    home.played++
    away.played++
    home.goalsFor += m.homeScore
    home.goalsAgainst += m.awayScore
    away.goalsFor += m.awayScore
    away.goalsAgainst += m.homeScore
    if (m.homeScore > m.awayScore) {
      home.won++
      away.lost++
      home.points += rules.pointsWin
      away.points += rules.pointsLoss
    } else if (m.homeScore < m.awayScore) {
      away.won++
      home.lost++
      away.points += rules.pointsWin
      home.points += rules.pointsLoss
    } else {
      home.drawn++
      away.drawn++
      home.points += rules.pointsDraw
      away.points += rules.pointsDraw
    }
  }
  return table
}

export interface StandingsInput {
  teamIds: ID[]
  /** Guruhning barcha o'yinlari (holatidan qat'i nazar) */
  matches: Match[]
  events?: MatchEvent[]
  adjustments?: PointAdjustment[]
  rules: SeasonRules
  /** Hal bo'lmagan tenglikda barqaror tartib uchun (masalan, jamoa nomi) */
  nameOf?: (id: ID) => string
  /** Qur'a natijasi: barcha mezonlar ajrata olmagan jamoalar shu tartibda joylashadi */
  lotOrder?: ID[]
}

/**
 * Guruh jadvalini noldan hisoblaydi. Funksiya sof (pure): bir xil kirishga
 * har doim bir xil natija beradi, shuning uchun natija tahrirlanganda
 * hech qanday o'yin ikki marta hisobga olinmaydi.
 */
export function computeStandings(input: StandingsInput): StandingRow[] {
  const { teamIds, matches, rules } = input
  const events = input.events ?? []
  const adjustments = input.adjustments ?? []
  const nameOf = input.nameOf ?? ((id: ID) => id)

  const tally = tallyMatches(teamIds, matches, rules)
  const finishedIds = new Set(matches.filter(countsForTable).map((m) => m.id))

  const fairPlay = new Map<ID, number>(teamIds.map((id) => [id, 0]))
  for (const e of events) {
    if (!finishedIds.has(e.matchId)) continue
    const pts = FAIR_PLAY_POINTS[e.type]
    if (pts && fairPlay.has(e.seasonTeamId)) fairPlay.set(e.seasonTeamId, fairPlay.get(e.seasonTeamId)! + pts)
  }

  const adj = new Map<ID, number>(teamIds.map((id) => [id, 0]))
  for (const a of adjustments) {
    if (adj.has(a.seasonTeamId)) adj.set(a.seasonTeamId, adj.get(a.seasonTeamId)! + a.points)
  }

  const form = new Map<ID, FormResult[]>(teamIds.map((id) => [id, []]))
  const ordered = matches.filter(countsForTable).sort((a, b) => a.kickoff.localeCompare(b.kickoff))
  for (const m of ordered) {
    const h = form.get(m.homeId)
    const a = form.get(m.awayId)
    const res: FormResult = m.homeScore > m.awayScore ? "W" : m.homeScore < m.awayScore ? "L" : "D"
    h?.push(res)
    a?.push(res === "W" ? "L" : res === "L" ? "W" : "D")
  }

  const totalPoints = (id: ID) => tally.get(id)!.points + adj.get(id)!

  const criterionValue = (criterion: Tiebreaker, id: ID, tiedSet: ID[]): number => {
    const t = tally.get(id)!
    switch (criterion) {
      case "GOAL_DIFF":
        return t.goalsFor - t.goalsAgainst
      case "GOALS_FOR":
        return t.goalsFor
      case "WINS":
        return t.won
      case "FAIR_PLAY":
        return -fairPlay.get(id)!
      case "H2H_POINTS":
      case "H2H_GOAL_DIFF":
      case "H2H_GOALS": {
        const mini = tallyMatches(tiedSet, matches, rules).get(id)!
        if (criterion === "H2H_POINTS") return mini.points
        if (criterion === "H2H_GOAL_DIFF") return mini.goalsFor - mini.goalsAgainst
        return mini.goalsFor
      }
    }
  }

  const unresolved = new Set<ID>()

  // Teng jamoalar to'plamini mezonlar bo'yicha tartiblaydi. Kichikroq teng guruh
  // paydo bo'lsa, mezonlar shu guruh uchun boshidan qayta qo'llanadi (o'zaro o'yinlar qayta hisoblanadi).
  const resolve = (ids: ID[], criterionIndex: number): ID[] => {
    if (ids.length <= 1) return ids
    if (criterionIndex >= rules.tiebreakers.length) {
      // Qur'a tashlangan bo'lsa — uning tartibi; bo'lmasa vaqtincha alifbo tartibi va «*» belgisi
      const lot = input.lotOrder ?? []
      if (ids.every((id) => lot.includes(id))) return [...ids].sort((a, b) => lot.indexOf(a) - lot.indexOf(b))
      ids.forEach((id) => unresolved.add(id))
      return [...ids].sort((a, b) => nameOf(a).localeCompare(nameOf(b), "uz"))
    }
    const criterion = rules.tiebreakers[criterionIndex]
    const values = new Map(ids.map((id) => [id, criterionValue(criterion, id, ids)]))
    const buckets = new Map<number, ID[]>()
    for (const id of ids) {
      const v = values.get(id)!
      buckets.set(v, [...(buckets.get(v) ?? []), id])
    }
    const sortedValues = [...buckets.keys()].sort((a, b) => b - a)
    const result: ID[] = []
    for (const v of sortedValues) {
      const bucket = buckets.get(v)!
      if (bucket.length === 1) result.push(bucket[0])
      else if (bucket.length < ids.length) result.push(...resolve(bucket, 0))
      else result.push(...resolve(bucket, criterionIndex + 1))
    }
    return result
  }

  const byPoints = new Map<number, ID[]>()
  for (const id of teamIds) {
    const p = totalPoints(id)
    byPoints.set(p, [...(byPoints.get(p) ?? []), id])
  }
  const order: ID[] = []
  for (const p of [...byPoints.keys()].sort((a, b) => b - a)) {
    order.push(...resolve(byPoints.get(p)!, 0))
  }

  return order.map((id, index) => {
    const t = tally.get(id)!
    return {
      seasonTeamId: id,
      position: index + 1,
      played: t.played,
      won: t.won,
      drawn: t.drawn,
      lost: t.lost,
      goalsFor: t.goalsFor,
      goalsAgainst: t.goalsAgainst,
      goalDiff: t.goalsFor - t.goalsAgainst,
      adjustment: adj.get(id)!,
      points: totalPoints(id),
      fairPlay: fairPlay.get(id)!,
      form: form.get(id)!.slice(-5),
      unresolvedTie: unresolved.has(id) && t.played > 0,
    }
  })
}
