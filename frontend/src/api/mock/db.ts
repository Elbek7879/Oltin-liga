import type { Appearance, AuditEntry, Group, ID, LeagueSettings, Match, MatchEvent, News, Player, PointAdjustment, RosterEntry, RoundTeam, Season, SeasonAward, SeasonTeam, Sponsor, Team, Venue } from "@/domain/types"
import type { UserAccount } from "../types"

/** Namunaviy rejimdagi butun ma'lumotlar bazasi (3-bosqichda PostgreSQL bilan almashtiriladi) */
export interface LeagueDb {
  version: number
  seededAt: string
  settings: LeagueSettings
  seasons: Season[]
  teams: Team[]
  seasonTeams: SeasonTeam[]
  players: Player[]
  rosters: RosterEntry[]
  groups: Group[]
  venues: Venue[]
  matches: Match[]
  events: MatchEvent[]
  appearances: Appearance[]
  adjustments: PointAdjustment[]
  awards: SeasonAward[]
  news: News[]
  sponsors: Sponsor[]
  audit: AuditEntry[]
  /** Teng holatdagi qur'a natijalari */
  lots?: { seasonId: ID; scope: string; order: ID[] }[]
  roundTeams?: (RoundTeam & { seasonId: ID })[]
  /** Namunaviy akkauntlar (parollar saqlanmaydi) */
  users?: UserAccount[]
}

export const DB_VERSION = 2
