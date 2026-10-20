import type { StandingRow } from "@/domain/standings"
import type { PlayerSeasonStats, TeamDiscipline } from "@/domain/stats"
import type { ResultInput } from "@/domain/validation"
import type {
  Appearance,
  AuditEntry,
  AwardType,
  Group,
  ID,
  LeagueSettings,
  Match,
  MatchEvent,
  MatchStage,
  MatchStatus,
  News,
  PlayoffRoundKey,
  PointAdjustment,
  Position,
  RoundTeam,
  RoundTeamSlotKey,
  Season,
  SeasonAward,
  SeasonRules,
  Sponsor,
  Team,
  Venue,
} from "@/domain/types"

/** Jamoaning mavsumdagi ko'rinishi (doimiy jamoa ma'lumotlari bilan birga) */
export interface TeamView {
  id: ID
  teamId: ID
  seasonId: ID
  name: string
  shortName: string
  village: string
  primaryColor: string
  secondaryColor: string
  captainId?: ID | null
  coach?: string
  logoUrl?: string | null
}

/** Ommaviy saytdagi futbolchi — telefon kabi maxfiy maydonlarsiz */
export interface PublicPlayer {
  id: ID
  firstName: string
  lastName: string
  position: Position | null
  birthYear?: number
  photoUrl?: string | null
}

export interface RosterView {
  playerId: ID
  seasonTeamId: ID
  number?: number
}

/** Admin uchun Telegram bot holati */
export interface TelegramStatus {
  /** Serverda bot tokeni va nomi kiritilgan */
  botEnabled: boolean
  botUsername: string
  /** Shu rol botdan foydalana oladi */
  allowed: boolean
  linked: boolean
  telegramUsername: string | null
}

export interface SeasonBundle {
  season: Season
  teams: TeamView[]
  groups: Group[]
  matches: Match[]
  events: MatchEvent[]
  appearances: Appearance[]
  players: PublicPlayer[]
  rosters: RosterView[]
  venues: Venue[]
  standings: Record<ID, StandingRow[]>
  playerStats: PlayerSeasonStats[]
  discipline: TeamDiscipline[]
  awards: SeasonAward[]
  adjustments: PointAdjustment[]
  /** Teng holatdagi qur'a natijalari */
  lots: TiebreakLot[]
  /** E'lon qilingan ramziy jamoalar (qoralamalar faqat admin panelda) */
  roundTeams?: RoundTeam[]
}

export interface RoundTeamInput {
  stage: MatchStage
  round?: number | null
  playoffRound?: PlayoffRoundKey | null
  slots: { slot: RoundTeamSlotKey; playerId: ID }[]
  /** false — qoralama, true — saytda e'lon qilinadi (5 o'rin ham to'lishi kerak) */
  publish: boolean
}

/** scope: "GROUP:<guruh id>" — guruhdagi o'rin; "SEED:<o'rin>" — pley-off reytingi */
export interface TiebreakLot {
  scope: string
  order: ID[]
}

export interface SeasonSummary {
  season: Season
  teamsCount: number
  matchesPlayed: number
  matchesTotal: number
  goals: number
  champion: TeamView | null
  runnerUp: TeamView | null
  third: TeamView | null
  topScorer: { player: PublicPlayer; team: TeamView; goals: number } | null
  final: Match | null
}

export interface ArchiveBundle {
  summaries: SeasonSummary[]
  /** Final o'yinlaridagi jamoalar ko'rinishi */
  teams: TeamView[]
}

export interface TeamSeasonRecord {
  season: Season
  team: TeamView
  groupName: string | null
  position: number | null
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  achievement: AwardType | null
  stageReached: PlayoffRoundKey | "GROUP" | null
}

export interface TeamProfile {
  team: Team
  records: TeamSeasonRecord[]
  matches: Match[]
  teams: TeamView[]
}

export interface PlayerSeasonRecord {
  season: Season
  team: TeamView
  number?: number
  stats: PlayerSeasonStats
}

export interface PlayerProfile {
  player: PublicPlayer
  records: PlayerSeasonRecord[]
  awards: (SeasonAward & { season: Season })[]
}

export interface HeadToHead {
  matches: Match[]
  teams: TeamView[]
  seasons: Season[]
}

// ---------- Admin ----------

export type AdminRole = "SUPER_ADMIN" | "ADMIN" | "RESULT_ENTRY" | "EDITOR"

export interface AdminUser {
  username: string
  displayName: string
  role: AdminRole
}

/** Tashkilotchi yoki yordamchi akkaunti (bosh tashkilotchi boshqaradi) */
export interface UserAccount {
  id: ID
  username: string
  displayName: string
  role: AdminRole
  enabled: boolean
  lastLoginAt: string | null
  createdAt: string
}

export interface UserCreateInput {
  username: string
  displayName: string
  role: AdminRole
  password: string
}

export interface UserUpdateInput {
  displayName: string
  role: AdminRole
  enabled: boolean
}

export interface TeamInput {
  name: string
  shortName: string
  village: string
  primaryColor: string
  secondaryColor: string
  founded?: number | null
  logoUrl?: string | null
}

export interface AdminTeamRow extends Team {
  inSeason: boolean
  seasonTeamId: ID | null
  playersCount: number
  hasHistory: boolean
}

export interface PlayerInput {
  firstName: string
  lastName: string
  birthYear?: number | null
  position: Position | null
  phone?: string
  seasonTeamId?: ID | null
  number?: number | null
}

/** Ro'yxatdagi bitta futbolchi */
export interface PlayerRowInput {
  firstName: string
  lastName: string
  number?: number | null
  position?: Position | null
  birthYear?: number | null
}

export interface AdminPlayerRow {
  id: ID
  firstName: string
  lastName: string
  birthYear?: number
  position: Position | null
  phone?: string
  seasonTeamId: ID | null
  number?: number
  goals: number
  hasHistory: boolean
}

export interface MatchInput {
  stage: "GROUP" | "PLAYOFF"
  groupId?: ID | null
  round?: number | null
  playoffRound?: PlayoffRoundKey | null
  homeId: ID | null
  awayId: ID | null
  kickoff: string
  venueId?: ID | null
  status: MatchStatus
  referee?: string | null
  note?: string | null
}

export interface SeasonInput {
  name: string
  year: number
  startDate: string
  endDate: string
  rules: SeasonRules
  copyTeamsFromSeasonId?: ID | null
}

export interface NewsInput {
  title: string
  excerpt: string
  body: string
  important: boolean
  status: News["status"]
}

export type SponsorInput = Omit<Sponsor, "id">

export interface DashboardData {
  season: Season
  teamsCount: number
  playersCount: number
  matchesTotal: number
  matchesFinished: number
  pendingResults: Match[]
  today: Match[]
  upcoming: Match[]
  recentAudit: AuditEntry[]
  teams: TeamView[]
  groupsCount: number
}

export interface FinishSeasonPreview {
  canFinish: boolean
  problems: string[]
  champion: TeamView | null
  runnerUp: TeamView | null
  third: TeamView | null
  topScorer: { player: PublicPlayer; team: TeamView; goals: number } | null
  fairPlay: TeamView | null
}

export interface ReportData {
  season: Season
  matchesFinished: number
  goals: number
  avgGoals: number
  yellow: number
  red: number
  biggestWin: Match | null
  bestAttack: { team: TeamView; goals: number } | null
  bestDefence: { team: TeamView; conceded: number } | null
  teams: TeamView[]
}

export interface LeagueApi {
  // Ommaviy
  getSettings(): Promise<LeagueSettings>
  listSeasons(): Promise<Season[]>
  getSeasonBundle(seasonId: ID): Promise<SeasonBundle>
  getArchive(): Promise<ArchiveBundle>
  getTeamProfile(teamId: ID): Promise<TeamProfile>
  getPlayerProfile(playerId: ID): Promise<PlayerProfile>
  getHeadToHead(teamA: ID, teamB: ID): Promise<HeadToHead>
  listNews(options?: { includeDrafts?: boolean }): Promise<News[]>
  getNews(slug: string): Promise<News>
  listSponsors(options?: { includeInactive?: boolean }): Promise<Sponsor[]>

  // Avtorizatsiya
  login(username: string, password: string): Promise<AdminUser>
  logout(): Promise<void>
  me(): Promise<AdminUser | null>
  changeOwnPassword(currentPassword: string, newPassword: string): Promise<void>
  /** Telegram bot: holat, ulash havolasi (10 daqiqa amal qiladi) va uzish */
  telegramStatus(): Promise<TelegramStatus>
  telegramLink(): Promise<{ url: string; expiresAt: string }>
  telegramUnlink(): Promise<void>

  // Foydalanuvchilar (faqat bosh tashkilotchi)
  listUsers(): Promise<UserAccount[]>
  createUser(input: UserCreateInput): Promise<UserAccount>
  updateUser(id: ID, input: UserUpdateInput): Promise<UserAccount>
  resetUserPassword(id: ID, password: string): Promise<void>

  // Admin
  getDashboard(seasonId: ID): Promise<DashboardData>
  createSeason(input: SeasonInput): Promise<Season>
  updateSeasonRules(seasonId: ID, rules: SeasonRules): Promise<Season>
  activateSeason(seasonId: ID): Promise<Season>
  previewFinishSeason(seasonId: ID): Promise<FinishSeasonPreview>
  finishSeason(seasonId: ID): Promise<Season>

  listTeamsAdmin(seasonId: ID): Promise<AdminTeamRow[]>
  createTeam(input: TeamInput, addToSeasonId?: ID | null): Promise<Team>
  updateTeam(teamId: ID, input: TeamInput): Promise<Team>
  deleteTeam(teamId: ID): Promise<void>
  setTeamInSeason(teamId: ID, seasonId: ID, inSeason: boolean): Promise<void>

  listPlayersAdmin(seasonId: ID): Promise<AdminPlayerRow[]>
  createPlayer(seasonId: ID, input: PlayerInput): Promise<void>
  /** Jamoa tarkibiga futbolchilarni ro'yxat bilan birdaniga qo'shish */
  createPlayers(seasonId: ID, input: { seasonTeamId: ID; players: PlayerRowInput[] }): Promise<{ created: number }>
  updatePlayer(seasonId: ID, playerId: ID, input: PlayerInput): Promise<void>
  deletePlayer(playerId: ID): Promise<void>

  saveGroups(seasonId: ID, groups: { name: string; teamIds: ID[] }[]): Promise<void>
  /** Qur'ani bekor qilish: guruhlar va guruh juftliklari o'chiriladi (natija kiritilmagan bo'lsa) */
  resetGroups(seasonId: ID): Promise<void>

  createMatch(seasonId: ID, input: MatchInput): Promise<Match>
  updateMatch(matchId: ID, input: MatchInput): Promise<Match>
  deleteMatch(matchId: ID): Promise<void>
  /** Juftliklari yo'q guruhlar uchun juftliklarni tuzadi (odatda qur'a saqlanganda o'zi tuziladi) */
  generateFixtures(seasonId: ID): Promise<{ created: number }>

  saveResult(matchId: ID, input: ResultInput): Promise<Match>

  createPlayoff(seasonId: ID, input: { thirdPlace: boolean; startDate: string; venueId?: ID | null }): Promise<{ created: number }>
  /** O'yin sanasi, vaqti va maydoni — saytda darhol ko'rinadi */
  scheduleMatch(matchId: ID, input: { kickoff: string; venueId: ID | null }): Promise<Match>
  /** Teng holat uchun qur'a: random — tizim tasodifiy tartib tanlaydi, aks holda berilgan tartib saqlanadi */
  drawLot(seasonId: ID, input: { scope: string; seasonTeamIds: ID[]; random: boolean }): Promise<void>
  deleteLot(seasonId: ID, scope: string): Promise<void>
  deletePlayoff(seasonId: ID): Promise<void>

  saveNews(id: ID | null, input: NewsInput): Promise<News>
  deleteNews(id: ID): Promise<void>
  saveSponsor(id: ID | null, input: SponsorInput): Promise<Sponsor>
  deleteSponsor(id: ID): Promise<void>

  addAdjustment(seasonId: ID, input: { seasonTeamId: ID; points: number; reason: string }): Promise<void>
  deleteAdjustment(id: ID): Promise<void>

  getReport(seasonId: ID): Promise<ReportData>
  listAudit(): Promise<AuditEntry[]>
  updateSettings(settings: LeagueSettings): Promise<LeagueSettings>
  listVenues(): Promise<Venue[]>
  saveVenue(id: ID | null, input: { name: string; village: string }): Promise<Venue>
  deleteVenue(id: ID): Promise<void>
  /** Rasm yuklaydi va uning manzilini qaytaradi */
  uploadMedia(file: Blob, filename: string): Promise<{ url: string }>

  // Ramziy jamoa
  listRoundTeams(seasonId: ID): Promise<RoundTeam[]>
  saveRoundTeam(seasonId: ID, input: RoundTeamInput): Promise<RoundTeam>
  deleteRoundTeam(id: ID): Promise<void>
  /** Futbolchi rasmi; null — olib tashlash */
  setPlayerPhoto(playerId: ID, photoUrl: string | null): Promise<void>
  resetDemoData(): Promise<void>
}

/** Server «topilmadi» yoki «noto‘g‘ri manzil» deb javob berdi — qayta urinish foydasiz */
export function isNotFound(error: unknown) {
  return error instanceof ApiError && (error.status === 404 || error.status === 400)
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message)
    this.name = "ApiError"
  }
}
