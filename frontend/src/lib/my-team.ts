import type { TeamView } from "@/api/types"
import { activeSuspensions, type Suspension } from "@/domain/discipline"
import { qualifiersFor, ROUND_SEQUENCE, roundLabel } from "@/domain/playoff"
import { compareMatchOrder } from "@/domain/schedule"
import type { Match } from "@/domain/types"
import type { SeasonIndex } from "@/hooks/use-season-data"
import { totalScore } from "./match"

export type Outcome = "W" | "D" | "L"

export interface MyTeamSummary {
  team: TeamView
  /** Guruhdagi o'rni (guruh tuzilmagan bo'lsa — null) */
  standing: { group: string; position: number; points: number; played: number; inZone: boolean; groupSize: number } | null
  /** Pley-offdagi holat: «Pley-off: Chorak final», «Chempion» va h.k. */
  stage: { label: string; tone: "gold" | "qualify" | "out" } | null
  next: Match | null
  last: { match: Match; outcome: Outcome; score: string } | null
  suspensions: Suspension[]
}

// 3-o'rin uchun o'yin finalga teng bosqich hisoblanadi (jamoa ikkalasida bo'lmaydi)
const roundRank = (m: Match) => ROUND_SEQUENCE.indexOf(m.playoffRound === "THIRD" ? "F" : m.playoffRound!)

export function outcomeFor(m: Match, seasonTeamId: string): Outcome {
  if (m.winnerId) return m.winnerId === seasonTeamId ? "W" : "L"
  const t = totalScore(m)
  if (!t || t.home === t.away) return "D"
  const home = m.homeId === seasonTeamId
  return (home ? t.home > t.away : t.away > t.home) ? "W" : "L"
}

/** Muxlis tanlagan jamoaning joriy mavsumdagi holati: o'rni, keyingi va oxirgi o'yini */
export function myTeamSummary(index: SeasonIndex, teamId: string): MyTeamSummary | null {
  const team = index.bundle.teams.find((t) => t.teamId === teamId)
  if (!team) return null
  const mine = index.bundle.matches.filter((m) => m.homeId === team.id || m.awayId === team.id)
  const byTime = (a: Match, b: Match) => a.kickoff.localeCompare(b.kickoff)

  const live = mine.find((m) => m.status === "LIVE")
  const next = live ?? mine.filter((m) => m.status === "SCHEDULED").sort(compareMatchOrder)[0] ?? null
  const lastMatch = mine.filter((m) => m.status === "FINISHED").sort(byTime).at(-1)
  const last = lastMatch
    ? (() => {
        const t = totalScore(lastMatch)!
        const home = lastMatch.homeId === team.id
        return { match: lastMatch, outcome: outcomeFor(lastMatch, team.id), score: home ? `${t.home}:${t.away}` : `${t.away}:${t.home}` }
      })()
    : null

  const group = index.groupOfTeam(team.id)
  const rows = group ? (index.bundle.standings[group.id] ?? []) : []
  const row = rows.find((r) => r.seasonTeamId === team.id)
  const q = qualifiersFor(index.bundle.season.rules, rows.length)
  const standing =
    group && row
      ? { group: group.name, position: row.position, points: row.points, played: row.played, inZone: row.played > 0 && row.position <= q, groupSize: rows.length }
      : null

  const playoff = mine
    .filter((m) => m.stage === "PLAYOFF" && m.playoffRound)
    .sort((a, b) => roundRank(a) - roundRank(b) || byTime(a, b))
  let stage: MyTeamSummary["stage"] = null
  const deepest = playoff.at(-1)
  if (deepest) {
    const label = roundLabel(deepest.playoffRound!, index.bundle.matches)
    const done = deepest.status === "FINISHED"
    const won = done && outcomeFor(deepest, team.id) === "W"
    if (deepest.playoffRound === "F" && done) stage = won ? { label: "Chempion", tone: "gold" } : { label: "Finalchi (2-o‘rin)", tone: "qualify" }
    else if (deepest.playoffRound === "THIRD" && done) stage = won ? { label: "3-o‘rin", tone: "qualify" } : { label: "4-o‘rin", tone: "out" }
    else if (done && !won) stage = { label: `Pley-offdan chiqdi: ${label}`, tone: "out" }
    else stage = { label: `Pley-off: ${label}`, tone: "qualify" }
  } else if (standing && index.bundle.matches.some((m) => m.stage === "PLAYOFF")) {
    stage = standing.inZone ? null : { label: "Guruhdan chiqa olmadi", tone: "out" }
  }

  const suspensions = activeSuspensions(index.bundle.matches, index.bundle.events).filter((s) => s.seasonTeamId === team.id)
  return { team, standing, stage, next, last, suspensions }
}
