import { useMemo } from "react"
import { useSeasonBundle } from "@/api/hooks"
import type { PublicPlayer, SeasonBundle, TeamView } from "@/api/types"
import type { Group, ID, MatchEvent, Venue } from "@/domain/types"
import { useSeason } from "./use-season"

export interface SeasonIndex {
  bundle: SeasonBundle
  team: (id: ID | null | undefined) => TeamView | undefined
  player: (id: ID | null | undefined) => PublicPlayer | undefined
  group: (id: ID | null | undefined) => Group | undefined
  venue: (id: ID | null | undefined) => Venue | undefined
  numberOf: (playerId: ID) => number | undefined
  teamOfPlayer: (playerId: ID) => ID | undefined
  eventsOf: (matchId: ID) => MatchEvent[]
  groupOfTeam: (seasonTeamId: ID) => Group | undefined
}

export function buildIndex(bundle: SeasonBundle): SeasonIndex {
  const teams = new Map(bundle.teams.map((t) => [t.id, t]))
  const players = new Map(bundle.players.map((p) => [p.id, p]))
  const groups = new Map(bundle.groups.map((g) => [g.id, g]))
  const venues = new Map(bundle.venues.map((v) => [v.id, v]))
  const numbers = new Map(bundle.rosters.map((r) => [r.playerId, r.number]))
  const playerTeam = new Map(bundle.rosters.map((r) => [r.playerId, r.seasonTeamId]))
  const events = new Map<ID, MatchEvent[]>()
  for (const e of bundle.events) events.set(e.matchId, [...(events.get(e.matchId) ?? []), e])
  const teamGroup = new Map<ID, Group>()
  for (const g of bundle.groups) for (const id of g.seasonTeamIds) teamGroup.set(id, g)
  return {
    bundle,
    team: (id) => (id ? teams.get(id) : undefined),
    player: (id) => (id ? players.get(id) : undefined),
    group: (id) => (id ? groups.get(id) : undefined),
    venue: (id) => (id ? venues.get(id) : undefined),
    numberOf: (id) => numbers.get(id),
    teamOfPlayer: (id) => playerTeam.get(id),
    eventsOf: (id) => (events.get(id) ?? []).slice().sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0)),
    groupOfTeam: (id) => teamGroup.get(id),
  }
}

/** Tanlangan mavsum ma'lumotlari va tezkor qidiruv funksiyalari */
export function useSeasonData() {
  const { seasonId } = useSeason()
  const query = useSeasonBundle(seasonId)
  const index = useMemo(() => (query.data ? buildIndex(query.data) : undefined), [query.data])
  return { ...query, index }
}
