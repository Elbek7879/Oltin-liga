import { roundLabel } from "./playoff"
import type { Appearance, ID, Match, MatchEvent, MatchStage, PlayoffRoundKey, Position, RoundTeam, RoundTeamSlotKey } from "./types"

/**
 * Ramziy jamoa: tur (yoki pley-off bosqichi) tugagach tanlanadigan 5 futbolchi.
 * Gollar, uzatmalar va quruq o'yinlar shu turdagi o'yin natijalaridan hisoblanadi — qo'lda kiritilmaydi.
 */

export interface RoundTeamSlotMeta {
  key: RoundTeamSlotKey
  label: string
  /** To'liq nomi: ikki yarim himoyachi chap va o'ng deb ajratiladi (tanlash oynasi, ekran o'quvchi) */
  fullLabel: string
  /** Tanlash oynasida shu pozitsiyadagilar birinchi ko'rsatiladi */
  position: Position
}

/** Maydonda yuqoridan pastga: hujumchi, yarim himoyachilar (chap, o'ng), himoyachi, darvozabon */
export const ROUND_TEAM_SLOTS: RoundTeamSlotMeta[] = [
  { key: "FW", label: "Hujumchi", fullLabel: "Hujumchi", position: "FW" },
  { key: "MF_L", label: "Yarim himoyachi", fullLabel: "Chap yarim himoyachi", position: "MF" },
  { key: "MF_R", label: "Yarim himoyachi", fullLabel: "O‘ng yarim himoyachi", position: "MF" },
  { key: "DF", label: "Himoyachi", fullLabel: "Himoyachi", position: "DF" },
  { key: "GK", label: "Darvozabon", fullLabel: "Darvozabon", position: "GK" },
]

export const slotMeta = (key: RoundTeamSlotKey) => ROUND_TEAM_SLOTS.find((s) => s.key === key)!

export interface RoundOption {
  /** "GROUP:1" yoki "PLAYOFF:QF" */
  key: string
  stage: MatchStage
  round: number | null
  playoffRound: PlayoffRoundKey | null
  label: string
  /** Bekor qilinganlardan tashqari o'yinlar */
  matches: Match[]
  /** Barcha o'yinlar yakunlangan — ramziy jamoa tanlash mumkin */
  complete: boolean
}

export const roundKeyOf = (t: Pick<RoundTeam, "stage" | "round" | "playoffRound">) => (t.stage === "GROUP" ? `GROUP:${t.round}` : `PLAYOFF:${t.playoffRound}`)

const PLAYOFF_ORDER: PlayoffRoundKey[] = ["R64", "R32", "R16", "QF", "SF", "THIRD", "F"]

/** Mavsumdagi turlar va pley-off bosqichlari (o'yin tartibida) */
export function roundOptions(matches: Match[]): RoundOption[] {
  const live = matches.filter((m) => m.status !== "CANCELLED")
  const options: RoundOption[] = []
  const rounds = [...new Set(live.filter((m) => m.stage === "GROUP" && m.round != null).map((m) => m.round!))].sort((a, b) => a - b)
  for (const r of rounds) {
    const list = live.filter((m) => m.stage === "GROUP" && m.round === r)
    options.push({ key: `GROUP:${r}`, stage: "GROUP", round: r, playoffRound: null, label: `${r}-tur`, matches: list, complete: list.every((m) => m.status === "FINISHED") })
  }
  for (const pr of PLAYOFF_ORDER) {
    const list = live.filter((m) => m.stage === "PLAYOFF" && m.playoffRound === pr)
    if (list.length === 0) continue
    options.push({ key: `PLAYOFF:${pr}`, stage: "PLAYOFF", round: null, playoffRound: pr, label: roundLabel(pr, matches), matches: list, complete: list.every((m) => m.status === "FINISHED") })
  }
  return options
}

export interface PlayerRoundStats {
  playerId: ID
  seasonTeamId: ID
  /** Shu turda maydonga tushgan (tarkib kiritilmagan o'yinda — jamoaning barcha futbolchilari) */
  played: boolean
  goals: number
  assists: number
  /** Jamoa natijasi: g'alaba, durang, mag'lubiyat (o'yin bo'lmasa null) */
  result: "W" | "D" | "L" | null
  /** Jamoa hisobi, masalan «2:0» (o'z jamoasi birinchi) */
  score: string | null
  /** Jamoa o'tkazib yuborgan gollar */
  conceded: number | null
}

const GOALS = new Set<MatchEvent["type"]>(["GOAL", "PENALTY_GOAL"])

/** Tur bo'yicha har bir futbolchining ko'rsatkichlari (mavsum tarkibidagi barcha futbolchilar uchun) */
export function roundStats(
  option: Pick<RoundOption, "matches">,
  data: { events: MatchEvent[]; appearances: Appearance[]; rosters: { playerId: ID; seasonTeamId: ID }[] },
): Map<ID, PlayerRoundStats> {
  const finished = option.matches.filter((m) => m.status === "FINISHED")
  const ids = new Set(finished.map((m) => m.id))
  const teamGame = new Map<ID, { result: "W" | "D" | "L"; scored: number; conceded: number }>()
  for (const m of finished) {
    if (!m.homeId || !m.awayId) continue
    const h = (m.homeScore ?? 0) + (m.homeExtra ?? 0)
    const a = (m.awayScore ?? 0) + (m.awayExtra ?? 0)
    const outcome = (side: ID, f: number, c: number): "W" | "D" | "L" => (m.winnerId ? (m.winnerId === side ? "W" : "L") : f > c ? "W" : f < c ? "L" : "D")
    teamGame.set(m.homeId, { result: outcome(m.homeId, h, a), scored: h, conceded: a })
    teamGame.set(m.awayId, { result: outcome(m.awayId, a, h), scored: a, conceded: h })
  }
  const appearancesOf = new Map<ID, Set<ID>>()
  for (const a of data.appearances) if (ids.has(a.matchId)) appearancesOf.set(a.matchId, (appearancesOf.get(a.matchId) ?? new Set()).add(a.playerId))
  // Tarkib kiritilmagan o'yinda jamoaning hamma futbolchisi o'ynagan deb hisoblanadi
  const teamsWithoutLineup = new Set<ID>()
  for (const m of finished) if (!appearancesOf.has(m.id)) [m.homeId, m.awayId].forEach((t) => t && teamsWithoutLineup.add(t))
  const appeared = new Set([...appearancesOf.values()].flatMap((s) => [...s]))

  const goals = new Map<ID, number>()
  const assists = new Map<ID, number>()
  for (const e of data.events) {
    if (!ids.has(e.matchId)) continue
    if (GOALS.has(e.type) && e.playerId) goals.set(e.playerId, (goals.get(e.playerId) ?? 0) + 1)
    if (GOALS.has(e.type) && e.assistId) assists.set(e.assistId, (assists.get(e.assistId) ?? 0) + 1)
  }

  const stats = new Map<ID, PlayerRoundStats>()
  for (const r of data.rosters) {
    const game = teamGame.get(r.seasonTeamId)
    stats.set(r.playerId, {
      playerId: r.playerId,
      seasonTeamId: r.seasonTeamId,
      played: Boolean(game) && (appeared.has(r.playerId) || teamsWithoutLineup.has(r.seasonTeamId) || goals.has(r.playerId) || assists.has(r.playerId)),
      goals: goals.get(r.playerId) ?? 0,
      assists: assists.get(r.playerId) ?? 0,
      result: game?.result ?? null,
      score: game ? `${game.scored}:${game.conceded}` : null,
      conceded: game?.conceded ?? null,
    })
  }
  return stats
}

/** Tanlashga yordam: o'rin uchun ball (katta — yaxshiroq) */
export function slotScore(slot: RoundTeamSlotKey, s: PlayerRoundStats) {
  const win = s.result === "W" ? 1 : 0
  const draw = s.result === "D" ? 1 : 0
  const clean = s.conceded === 0 ? 1 : 0
  switch (slot) {
    case "GK":
      return clean * 5 + win * 3 + draw - (s.conceded ?? 0) * 0.5
    case "DF":
      return clean * 3 + win * 2 + draw + s.goals * 3 + s.assists * 2
    case "MF_L":
    case "MF_R":
      return s.goals * 3 + s.assists * 3 + win
    case "FW":
      return s.goals * 4 + s.assists * 2 + win
  }
}

/**
 * «Avtomatik taklif»: har bir o'ringa shu pozitsiyadagi, turda o'ynagan eng yaxshi futbolchi.
 * Pozitsiyasi kiritilmagan futbolchi ham qatnashadi (pozitsiyasi aniq bo'lganlardan keyin).
 * Bir futbolchi bir marta; munosib nomzod bo'lmasa o'rin bo'sh qoladi — admin o'zi tanlaydi.
 * `keep` — admin allaqachon tanlagan o'rinlar: ular o'zgarmaydi, faqat bo'sh o'rinlar to'ldiriladi.
 */
export function suggestRoundTeam(
  stats: Map<ID, PlayerRoundStats>,
  positionOf: (playerId: ID) => Position | null | undefined,
  keep: Partial<Record<RoundTeamSlotKey, ID>> = {},
) {
  const result: Partial<Record<RoundTeamSlotKey, ID>> = { ...keep }
  const used = new Set<ID>(Object.values(keep))
  const order: RoundTeamSlotKey[] = ["GK", "FW", "MF_L", "MF_R", "DF"]
  for (const slot of order) {
    if (result[slot]) continue
    const want = slotMeta(slot).position
    const candidates = [...stats.values()]
      .filter((s) => s.played && !used.has(s.playerId))
      .map((s) => {
        const pos = positionOf(s.playerId)
        // Aniq pozitsiya — ustun; pozitsiyasi yo'q — keyin. Darvozabon o'rniga faqat darvozabon,
        // darvozabon esa maydon o'yinchisi o'rniga taklif qilinmaydi
        const fit = pos === want ? 2 : slot === "GK" || pos === "GK" ? -1 : pos == null ? 1 : 0
        return { s, fit, score: slotScore(slot, s) }
      })
      .filter((c) => c.fit >= 1 || (c.fit === 0 && c.score > 0))
      .sort((a, b) => b.fit - a.fit || b.score - a.score || a.s.playerId.localeCompare(b.s.playerId))
    const best = candidates[0]
    if (best && (best.fit === 2 || best.score > 0)) {
      result[slot] = best.s.playerId
      used.add(best.s.playerId)
    }
  }
  return result
}
