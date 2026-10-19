import { countsForTable, FAIR_PLAY_POINTS } from "./standings"
import type { Appearance, ID, Match, MatchEvent } from "./types"

export interface PlayerSeasonStats {
  playerId: ID
  seasonTeamId: ID
  appearances: number
  goals: number
  penaltyGoals: number
  ownGoals: number
  assists: number
  yellow: number
  red: number
}

export interface TeamDiscipline {
  seasonTeamId: ID
  yellow: number
  red: number
  fairPlayPoints: number
  played: number
}

function isGoal(type: MatchEvent["type"]) {
  return type === "GOAL" || type === "PENALTY_GOAL"
}

/**
 * Futbolchilar statistikasi faqat yakunlangan o'yinlar hodisalaridan hisoblanadi.
 * Avtogol futbolchining shaxsiy gollariga qo'shilmaydi (raqib jamoa hisobiga yoziladi).
 */
export function computePlayerStats(matches: Match[], events: MatchEvent[], appearances: Appearance[]): PlayerSeasonStats[] {
  const finished = new Set(matches.filter((m) => m.status === "FINISHED").map((m) => m.id))
  const stats = new Map<string, PlayerSeasonStats>()

  const get = (playerId: ID, seasonTeamId: ID) => {
    const key = `${playerId}:${seasonTeamId}`
    let s = stats.get(key)
    if (!s) {
      s = { playerId, seasonTeamId, appearances: 0, goals: 0, penaltyGoals: 0, ownGoals: 0, assists: 0, yellow: 0, red: 0 }
      stats.set(key, s)
    }
    return s
  }

  for (const a of appearances) {
    if (finished.has(a.matchId)) get(a.playerId, a.seasonTeamId).appearances++
  }

  for (const e of events) {
    if (!finished.has(e.matchId)) continue
    if (e.playerId) {
      const s = get(e.playerId, e.seasonTeamId)
      if (isGoal(e.type)) {
        s.goals++
        if (e.type === "PENALTY_GOAL") s.penaltyGoals++
      } else if (e.type === "OWN_GOAL") s.ownGoals++
      else if (e.type === "YELLOW") s.yellow++
      else if (e.type === "SECOND_YELLOW") {
        s.yellow++
        s.red++
      } else if (e.type === "RED") s.red++
    }
    if (isGoal(e.type) && e.assistId) get(e.assistId, e.seasonTeamId).assists++
  }

  return [...stats.values()]
}

export function topScorers(stats: PlayerSeasonStats[], nameOf: (playerId: ID) => string) {
  return stats
    .filter((s) => s.goals > 0)
    .sort(
      (a, b) =>
        b.goals - a.goals ||
        a.penaltyGoals - b.penaltyGoals ||
        b.assists - a.assists ||
        nameOf(a.playerId).localeCompare(nameOf(b.playerId), "uz"),
    )
}

export function topAssists(stats: PlayerSeasonStats[], nameOf: (playerId: ID) => string) {
  return stats
    .filter((s) => s.assists > 0)
    .sort((a, b) => b.assists - a.assists || b.goals - a.goals || nameOf(a.playerId).localeCompare(nameOf(b.playerId), "uz"))
}

export function computeTeamDiscipline(teamIds: ID[], matches: Match[], events: MatchEvent[]): TeamDiscipline[] {
  const finished = matches.filter(countsForTable)
  const finishedIds = new Set(finished.map((m) => m.id))
  const rows = new Map<ID, TeamDiscipline>(
    teamIds.map((id) => [id, { seasonTeamId: id, yellow: 0, red: 0, fairPlayPoints: 0, played: 0 }]),
  )
  for (const m of finished) {
    const h = rows.get(m.homeId)
    const a = rows.get(m.awayId)
    if (h) h.played++
    if (a) a.played++
  }
  for (const e of events) {
    if (!finishedIds.has(e.matchId)) continue
    const row = rows.get(e.seasonTeamId)
    if (!row) continue
    if (e.type === "YELLOW") row.yellow++
    if (e.type === "SECOND_YELLOW") {
      row.yellow++
      row.red++
    }
    if (e.type === "RED") row.red++
    row.fairPlayPoints += FAIR_PLAY_POINTS[e.type] ?? 0
  }
  return [...rows.values()].sort((a, b) => a.fairPlayPoints - b.fairPlayPoints || b.played - a.played)
}

/** Ikki jamoa o'rtasidagi barcha mavsumlardagi uchrashuvlar (doimiy jamoa ID'si bo'yicha) */
export function headToHead<T extends Match>(matches: T[], teamA: ID, teamB: ID, teamOf: (seasonTeamId: ID) => ID | undefined): T[] {
  return matches
    .filter((m) => {
      if (m.status !== "FINISHED" || !m.homeId || !m.awayId) return false
      const h = teamOf(m.homeId)
      const a = teamOf(m.awayId)
      return (h === teamA && a === teamB) || (h === teamB && a === teamA)
    })
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff))
}
