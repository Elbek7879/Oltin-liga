import type { PitchPlayer } from "@/components/league/round-team-pitch"
import { ROUND_TEAM_SLOTS, roundKeyOf, roundOptions, roundStats, type PlayerRoundStats, type RoundOption } from "@/domain/round-team"
import type { ID, RoundTeam, RoundTeamSlotKey } from "@/domain/types"
import type { SeasonIndex } from "@/hooks/use-season-data"
import { formatDateRange } from "./format"

/** Maydondagi futbolchi kartasi uchun ma'lumot: ism, jamoa, raqam, rasm va shu turdagi ko'rsatkichlar */
export function toPitchPlayer(index: SeasonIndex, stats: Map<ID, PlayerRoundStats>, slot: RoundTeamSlotKey, playerId: ID, seasonTeamId?: ID): PitchPlayer {
  const p = index.player(playerId)
  const s = stats.get(playerId)
  return {
    firstName: p?.firstName ?? "Noma’lum",
    lastName: p?.lastName ?? "futbolchi",
    number: index.numberOf(playerId),
    photoUrl: p?.photoUrl,
    team: index.team(seasonTeamId ?? s?.seasonTeamId ?? index.teamOfPlayer(playerId)),
    goals: s?.goals ?? 0,
    assists: s?.assists ?? 0,
    cleanSheet: slot === "GK" && s?.conceded === 0,
  }
}

export interface PublishedRoundTeam {
  team: RoundTeam
  /** Manzil uchun: guruh bosqichida tur raqami («3»), pley-offda bosqich kaliti («sf») */
  slug: string
  /** «3-tur», «Yarim final» */
  label: string
  /** «16–17-oktabr» */
  dates: string | null
  option: RoundOption | undefined
  players: Partial<Record<RoundTeamSlotKey, PitchPlayer & { playerId: ID }>>
}

export const roundTeamSlug = (t: Pick<RoundTeam, "stage" | "round" | "playoffRound">) =>
  t.stage === "GROUP" ? String(t.round) : String(t.playoffRound).toLowerCase()

/** Saytda e'lon qilingan ramziy jamoalar: eng oxirgi tur birinchi */
export function publishedRoundTeams(index: SeasonIndex): PublishedRoundTeam[] {
  const options = roundOptions(index.bundle.matches)
  const order = new Map(options.map((o, i) => [o.key, i]))
  return (index.bundle.roundTeams ?? [])
    .filter((t) => t.published)
    .map((team) => {
      const option = options.find((o) => o.key === roundKeyOf(team))
      const stats = option
        ? roundStats(option, { events: index.bundle.events, appearances: index.bundle.appearances, rosters: index.bundle.rosters })
        : new Map<ID, PlayerRoundStats>()
      const players: PublishedRoundTeam["players"] = {}
      for (const { key } of ROUND_TEAM_SLOTS) {
        const s = team.slots.find((x) => x.slot === key)
        if (s) players[key] = { ...toPitchPlayer(index, stats, key, s.playerId, s.seasonTeamId), playerId: s.playerId }
      }
      return {
        team,
        slug: roundTeamSlug(team),
        label: option?.label ?? (team.round != null ? `${team.round}-tur` : "Pley-off"),
        dates: option ? formatDateRange(option.matches.map((m) => m.kickoff)) : null,
        option,
        players,
      }
    })
    .sort((a, b) => (order.get(roundKeyOf(b.team)) ?? -1) - (order.get(roundKeyOf(a.team)) ?? -1))
}
