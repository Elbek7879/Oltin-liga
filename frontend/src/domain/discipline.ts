import { compareMatchOrder } from "./schedule"
import type { ID, Match, MatchEvent } from "./types"

/** Necha sariq kartochkadan keyin o'yinchi bir o'yinni o'tkazib yuboradi */
export const YELLOWS_FOR_BAN = 2

export interface Suspension {
  playerId: ID
  seasonTeamId: ID
  reason: "YELLOWS" | "RED"
  /** Kartochka olingan o'yin */
  fromMatchId: ID
  /** O'tkazib yuboriladigan o'yin (hali belgilanmagan bo'lsa — null) */
  banMatchId: ID | null
  /** Jazo o'tab bo'lindi (o'sha o'yin o'tkazildi) */
  served: boolean
}

export const SUSPENSION_REASON: Record<Suspension["reason"], string> = {
  YELLOWS: `${YELLOWS_FOR_BAN} ta sariq kartochka`,
  RED: "qizil kartochka",
}

/**
 * Diskvalifikatsiyalar (jahon chempionati qoidasi bo'yicha):
 *  - qizil yoki ikkinchi sariq kartochka — jamoaning keyingi o'yinini o'tkazib yuboradi;
 *    shu o'yindagi birinchi sariq kartochka yig'indiga qo'shilmaydi;
 *  - har xil o'yinlarda olingan har 2 ta sariq kartochka — keyingi o'yinni o'tkazib yuboradi.
 * Faqat yakunlangan o'yinlar hisoblanadi; bekor qilingan va qoldirilgan o'yin jazoni o'tash hisoblanmaydi.
 */
export function computeSuspensions(matches: Match[], events: MatchEvent[]): Suspension[] {
  const finished = matches.filter((m) => m.status === "FINISHED").sort((a, b) => a.kickoff.localeCompare(b.kickoff))
  const byMatch = new Map<ID, MatchEvent[]>()
  for (const e of events) byMatch.set(e.matchId, [...(byMatch.get(e.matchId) ?? []), e])
  const yellows = new Map<ID, number>()
  const result: Suspension[] = []

  // Keyingi o'yin tur/bosqich tartibida olinadi — sanasi hali belgilanmagan o'yin ham hisobga kiradi
  const nextMatchOf = (teamId: ID, after: Match) =>
    matches
      .filter((m) => m.id !== after.id && (m.homeId === teamId || m.awayId === teamId) && compareMatchOrder(m, after) > 0 && m.status !== "CANCELLED" && m.status !== "POSTPONED")
      .sort(compareMatchOrder)[0]

  for (const m of finished) {
    const cards = (byMatch.get(m.id) ?? []).filter((e) => e.playerId && (e.type === "YELLOW" || e.type === "SECOND_YELLOW" || e.type === "RED"))
    const players = new Map<ID, MatchEvent[]>()
    for (const e of cards) players.set(e.playerId!, [...(players.get(e.playerId!) ?? []), e])
    for (const [playerId, list] of players) {
      const teamId = list[0].seasonTeamId
      const sentOff = list.some((e) => e.type === "RED" || e.type === "SECOND_YELLOW")
      let reason: Suspension["reason"] | null = null
      if (sentOff) {
        reason = "RED"
      } else {
        const total = (yellows.get(playerId) ?? 0) + list.filter((e) => e.type === "YELLOW").length
        yellows.set(playerId, total % YELLOWS_FOR_BAN)
        if (total >= YELLOWS_FOR_BAN) reason = "YELLOWS"
      }
      if (!reason) continue
      const ban = nextMatchOf(teamId, m)
      result.push({ playerId, seasonTeamId: teamId, reason, fromMatchId: m.id, banMatchId: ban?.id ?? null, served: ban?.status === "FINISHED" })
    }
  }
  return result
}

/** Hozir diskvalifikatsiyada bo'lganlar (jazo hali o'talmagan) */
export const activeSuspensions = (matches: Match[], events: MatchEvent[]) => computeSuspensions(matches, events).filter((s) => !s.served)

/** Shu o'yinni o'tkazib yuborishi kerak bo'lgan o'yinchilar */
export const suspendedFor = (matchId: ID, matches: Match[], events: MatchEvent[]) =>
  computeSuspensions(matches, events).filter((s) => s.banMatchId === matchId)
