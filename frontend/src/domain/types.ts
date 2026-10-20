/*
 * Liga domen modellari. Backend (Spring Boot) DTO'lari ham shu tuzilishga mos bo'ladi.
 * Muhim qoida: ochko, jadval va statistikalar saqlanmaydi — ular faqat
 * o'yinlar (Match) va o'yin hodisalaridan (MatchEvent) hisoblanadi.
 */

export type ID = string

export type SeasonStatus = "DRAFT" | "ACTIVE" | "FINISHED"
export type MatchStatus = "SCHEDULED" | "LIVE" | "FINISHED" | "POSTPONED" | "CANCELLED"
export type MatchStage = "GROUP" | "PLAYOFF"
export type DecidedBy = "REGULAR" | "EXTRA_TIME" | "PENALTIES" | "FORFEIT"
export type EventType = "GOAL" | "PENALTY_GOAL" | "OWN_GOAL" | "YELLOW" | "SECOND_YELLOW" | "RED"
export type PlayoffRoundKey = "R64" | "R32" | "R16" | "QF" | "SF" | "THIRD" | "F"
export type Position = "GK" | "DF" | "MF" | "FW"
export type FormResult = "W" | "D" | "L"

export type Tiebreaker =
  | "H2H_POINTS"
  | "H2H_GOAL_DIFF"
  | "H2H_GOALS"
  | "GOAL_DIFF"
  | "GOALS_FOR"
  | "WINS"
  | "FAIR_PLAY"

export interface SeasonRules {
  pointsWin: number
  pointsDraw: number
  pointsLoss: number
  /** Teng ochko holatida qo'llaniladigan mezonlar, tartib bilan */
  tiebreakers: Tiebreaker[]
  /** 1 — bir davrali, 2 — ikki davrali guruh bosqichi */
  legs: 1 | 2
  /** Ro'yxatda bo'lmagan guruh hajmlari uchun pley-offga chiqadiganlar soni */
  qualifiersPerGroup: number
  /** Guruh hajmi bo'yicha chiqadiganlar: { 4: 2, 5: 3 } — 4 jamoalidan 2 ta, 5 jamoalidan 3 ta */
  qualifiersBySize: Record<number, number>
  thirdPlaceMatch: boolean
  /** Bir bo'lim davomiyligi, daqiqa (jonli o'yin soati uchun; standart 25) */
  halfMinutes?: number
}

export interface Season {
  id: ID
  number: number
  name: string
  year: number
  startDate: string
  endDate: string
  status: SeasonStatus
  rules: SeasonRules
  /** Sinov mavsumi: saytda ko'rinmaydi, sinab bo'lgach butunlay o'chiriladi */
  test?: boolean
}

export interface Team {
  id: ID
  name: string
  shortName: string
  village: string
  primaryColor: string
  secondaryColor: string
  founded?: number
  active: boolean
  logoUrl?: string | null
}

/** Jamoaning muayyan mavsumdagi ishtiroki. Nom mavsum uchun saqlanadi — tarix o'zgarmaydi. */
export interface SeasonTeam {
  id: ID
  seasonId: ID
  teamId: ID
  name: string
  shortName: string
  captainId?: ID | null
  coach?: string
}

export interface Player {
  id: ID
  firstName: string
  lastName: string
  birthYear?: number
  /** Ko'rsatilmagan bo'lishi mumkin (tezkor kiritishda) */
  position: Position | null
  /** Maxfiy: ommaviy saytda hech qachon ko'rsatilmaydi */
  phone?: string
  /** Futbolchi rasmi (ramziy jamoa va futbolchi sahifasi); bo'lmasa odamcha belgisi */
  photoUrl?: string | null
}

/** Ramziy jamoadagi o'rin: darvozabon, himoyachi, chap va o'ng yarim himoyachi, hujumchi */
export type RoundTeamSlotKey = "GK" | "DF" | "MF_L" | "MF_R" | "FW"

export interface RoundTeamSlot {
  slot: RoundTeamSlotKey
  playerId: ID
  seasonTeamId: ID
}

/** Ramziy jamoa: guruh bosqichida round, pley-offda playoffRound */
export interface RoundTeam {
  id: ID
  stage: MatchStage
  round: number | null
  playoffRound: PlayoffRoundKey | null
  published: boolean
  publishedAt: string | null
  slots: RoundTeamSlot[]
}

export interface RosterEntry {
  id: ID
  seasonId: ID
  seasonTeamId: ID
  playerId: ID
  number?: number
}

export interface Group {
  id: ID
  seasonId: ID
  name: string
  order: number
  seasonTeamIds: ID[]
}

export interface Venue {
  id: ID
  name: string
  village: string
}

export interface Match {
  id: ID
  seasonId: ID
  stage: MatchStage
  groupId?: ID | null
  round?: number | null
  playoffRound?: PlayoffRoundKey | null
  /** Pley-off sxemasidagi o'rni (0 dan boshlab) */
  bracketIndex?: number | null
  homeId: ID | null
  awayId: ID | null
  /** Jamoa hali aniq bo'lmaganda ko'rsatiladigan belgi, masalan "A1" yoki "1/4 g'olibi" */
  homeLabel?: string | null
  awayLabel?: string | null
  kickoff: string
  /** Avtomatik tuzilgan pley-off o'yinida tashkilotchi sanani tasdiqlaguncha false — saytda «sana belgilanmagan» */
  timeConfirmed?: boolean
  venueId?: ID | null
  status: MatchStatus
  homeScore: number | null
  awayScore: number | null
  homeExtra?: number | null
  awayExtra?: number | null
  homePens?: number | null
  awayPens?: number | null
  decidedBy?: DecidedBy | null
  winnerId?: ID | null
  nextMatchId?: ID | null
  nextSlot?: "home" | "away" | null
  loserNextMatchId?: ID | null
  loserNextSlot?: "home" | "away" | null
  referee?: string | null
  liveMinute?: number | null
  /** Jonli o'yin soati: qaysi qism va u qachon boshlangan (Telegram botdan boshqarilganda) */
  livePeriod?: LivePeriod | null
  periodStartedAt?: string | null
  note?: string | null
}

export type LivePeriod = "FIRST_HALF" | "HALF_TIME" | "SECOND_HALF" | "EXTRA_TIME" | "PENALTIES"

export interface MatchEvent {
  id: ID
  matchId: ID
  type: EventType
  minute?: number | null
  /** null — muallif noma'lum */
  playerId?: ID | null
  /** Hodisa egasi bo'lgan jamoa (avtogolda — avtogol urgan futbolchining jamoasi) */
  seasonTeamId: ID
  assistId?: ID | null
}

export interface Appearance {
  matchId: ID
  seasonTeamId: ID
  playerId: ID
}

export interface PointAdjustment {
  id: ID
  seasonId: ID
  seasonTeamId: ID
  points: number
  reason: string
  createdAt: string
}

export type AwardType =
  | "CHAMPION"
  | "RUNNER_UP"
  | "THIRD"
  | "TOP_SCORER"
  | "BEST_PLAYER"
  | "BEST_GOALKEEPER"
  | "FAIR_PLAY"

export interface SeasonAward {
  id: ID
  seasonId: ID
  type: AwardType
  seasonTeamId?: ID | null
  playerId?: ID | null
  note?: string | null
}

export type NewsStatus = "DRAFT" | "PUBLISHED"

export interface News {
  id: ID
  slug: string
  title: string
  excerpt: string
  body: string
  publishedAt: string
  important: boolean
  status: NewsStatus
}

export type SponsorTier = "GENERAL" | "OFFICIAL" | "PARTNER"

export interface Sponsor {
  id: ID
  name: string
  tier: SponsorTier
  description: string
  url?: string
  logoUrl?: string | null
  active: boolean
  order: number
}

export interface AuditEntry {
  id: ID
  at: string
  user: string
  action: string
  summary: string
}

export interface LeagueSettings {
  name: string
  shortName: string
  region: string
  about: string
  contactPhone: string
  telegram: string
  /** Ijtimoiy tarmoqlar — to'liq havola, bo'sh bo'lsa ko'rsatilmaydi */
  telegramChannel?: string
  instagram?: string
  youtube?: string
}
