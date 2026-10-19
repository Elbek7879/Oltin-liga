import { ROUND_LABELS, roundLabel } from "@/domain/playoff"
import type { Match } from "@/domain/types"
import type { SeasonIndex } from "@/hooks/use-season-data"

export function hasScore(m: Match) {
  return m.homeScore != null && m.awayScore != null && (m.status === "FINISHED" || m.status === "LIVE")
}

/** Asosiy va qo'shimcha vaqt gollari yig'indisi */
export function totalScore(m: Match) {
  if (!hasScore(m)) return null
  return { home: m.homeScore! + (m.homeExtra ?? 0), away: m.awayScore! + (m.awayExtra ?? 0) }
}

export function scoreNote(m: Match): string | null {
  if (m.status !== "FINISHED") return null
  if (m.decidedBy === "FORFEIT") return "Texnik natija"
  if (m.decidedBy === "PENALTIES") return `Penaltilar ${m.homePens}:${m.awayPens}`
  if (m.decidedBy === "EXTRA_TIME") return "Qo‘shimcha vaqtda"
  return null
}

export function winnerSide(m: Match): "home" | "away" | null {
  if (m.status !== "FINISHED") return null
  if (m.winnerId) return m.winnerId === m.homeId ? "home" : "away"
  return null
}

export function stageLabel(m: Match, index?: SeasonIndex) {
  if (m.stage === "PLAYOFF" && m.playoffRound) return index ? roundLabel(m.playoffRound, index.bundle.matches) : ROUND_LABELS[m.playoffRound]
  const group = index?.group(m.groupId)
  const parts = [group ? `${group.name} guruhi` : "Guruh bosqichi"]
  if (m.round) parts.push(`${m.round}-tur`)
  return parts.join(", ")
}

export function sideName(m: Match, side: "home" | "away", index?: SeasonIndex) {
  const id = side === "home" ? m.homeId : m.awayId
  const label = side === "home" ? m.homeLabel : m.awayLabel
  return index?.team(id)?.name ?? label ?? "Aniqlanmagan"
}

/** Ekran o'quvchi dasturlar uchun o'yinning qisqa tavsifi */
export function matchAriaLabel(m: Match, index?: SeasonIndex) {
  const home = sideName(m, "home", index)
  const away = sideName(m, "away", index)
  const t = totalScore(m)
  if (t) {
    const state = m.status === "LIVE" ? `davom etmoqda, ${m.liveMinute ?? ""}-daqiqa` : "yakunlangan"
    return `${home} ${t.home}, ${away} ${t.away}, ${state}`
  }
  return `${home} va ${away}`
}
