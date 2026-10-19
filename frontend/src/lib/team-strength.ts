import type { SeasonBundle } from "@/api/types"
import type { ID, PlayoffRoundKey } from "@/domain/types"

/** Pley-offda qaysi bosqichda to'xtagani uchun ball (chempion — eng yuqori) */
const LOST_IN: Record<PlayoffRoundKey, number> = { R64: 30, R32: 40, R16: 50, QF: 60, SF: 75, THIRD: 75, F: 90 }

/**
 * O'tgan mavsum natijalari bo'yicha jamoalar kuchi (jamoa id → ball):
 * pley-offdagi eng uzoq bosqich (chempion 100, finalchi 90, 3-o'rin 80 ...), so'ng guruhdagi o'yin boshiga ochko.
 * O'tgan mavsumda qatnashmagan jamoalar ro'yxatda bo'lmaydi.
 */
export function previousStrength(prev: SeasonBundle): Map<ID, number> {
  const stage = new Map<ID, number>()
  const bump = (id: ID | null | undefined, score: number) => {
    if (id) stage.set(id, Math.max(stage.get(id) ?? 0, score))
  }
  for (const m of prev.matches) {
    if (m.stage !== "PLAYOFF" || m.status !== "FINISHED" || !m.winnerId || !m.playoffRound) continue
    const loser = m.winnerId === m.homeId ? m.awayId : m.homeId
    if (m.playoffRound === "F") {
      bump(m.winnerId, 100)
      bump(loser, 90)
    } else if (m.playoffRound === "THIRD") {
      bump(m.winnerId, 80)
      bump(loser, 75)
    } else {
      bump(loser, LOST_IN[m.playoffRound])
    }
  }
  const ppg = new Map<ID, number>()
  for (const rows of Object.values(prev.standings)) for (const r of rows) ppg.set(r.seasonTeamId, r.played ? r.points / r.played : 0)

  const result = new Map<ID, number>()
  for (const t of prev.teams) result.set(t.teamId, (stage.get(t.id) ?? 0) + (ppg.get(t.id) ?? 0))
  return result
}
