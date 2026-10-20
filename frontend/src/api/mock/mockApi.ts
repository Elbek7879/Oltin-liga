/*
 * Namunaviy (mock) API. Haqiqiy backend tayyor bo'lguncha brauzer xotirasida
 * (localStorage) ishlaydi. 4-bosqichda xuddi shu LeagueApi interfeysining
 * HTTP versiyasi bilan almashtiriladi — sahifalar kodi o'zgarmaydi.
 */
import { checkDraw, GROUP_LETTERS } from "@/domain/draw"
import { advancementUpdates, createBracket, firstRoundFor, groupFinishes, playoffPlan, qualifiersFor, ROUND_LABELS, ROUND_SEQUENCE, seedLotsFrom } from "@/domain/playoff"
import { addDays, placeholderKickoff, primaryVenueId, roundRobin, toLocalIso } from "@/domain/schedule"
import { computeStandings } from "@/domain/standings"
import { computePlayerStats, computeTeamDiscipline, headToHead, topScorers } from "@/domain/stats"
import type { AuditEntry, ID, Match, PlayoffRoundKey, Season, SeasonAward, SeasonTeam, Team } from "@/domain/types"
import { deriveOutcome, validateResult, type ResultInput } from "@/domain/validation"
import { formatDate, localDateKey, slugify } from "@/lib/format"
import {
  ApiError,
  type AdminPlayerRow,
  type AdminTeamRow,
  type AdminUser,
  type ArchiveBundle,
  type SeasonDeleted,
  type SeasonDeletePreview,
  type DashboardData,
  type FinishSeasonPreview,
  type LeagueApi,
  type MatchInput,
  type PlayerInput,
  type PublicPlayer,
  type ReportData,
  type SeasonBundle,
  type SeasonSummary,
  type TeamInput,
  type TeamSeasonRecord,
  type UserAccount,
  type TeamView,
} from "../types"
import { DB_VERSION, type LeagueDb } from "./db"
import { defaultSeasonRules as defaultRules } from "../defaults"
import { createSeed } from "./seed"
import { normalizeSocial, type SocialField } from "@/lib/social"

const STORAGE_KEY = "pol-mock-db"
const SESSION_KEY = "pol-admin-session"
const LATENCY_MS = 120

let cache: LeagueDb | null = null

function load(): LeagueDb {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as LeagueDb
      if (parsed.version === DB_VERSION) {
        cache = parsed
        return parsed
      }
    }
  } catch {
    // Saqlangan ma'lumot buzilgan bo'lsa, yangidan yaratiladi
  }
  cache = createSeed()
  save()
  return cache
}

function save() {
  try {
    if (cache) localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
  } catch {
    // Xotira to'lgan yoki taqiqlangan bo'lsa, ma'lumot faqat sahifa yopilguncha saqlanadi
  }
}

const delay = <T,>(value: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), LATENCY_MS))

const fail = (message: string): never => {
  throw new ApiError(message)
}

const newId = (prefix: string) =>
  `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)}`

function audit(db: LeagueDb, action: string, summary: string) {
  const entry: AuditEntry = {
    id: newId("au"),
    at: new Date().toISOString(),
    user: currentUser()?.displayName ?? "Tizim",
    action,
    summary,
  }
  db.audit.unshift(entry)
  db.audit = db.audit.slice(0, 300)
}

function currentUser(): AdminUser | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as AdminUser) : null
  } catch {
    return null
  }
}

function requireAdmin() {
  if (!currentUser()) fail("Bu amal uchun tizimga kiring.")
}

function requireSuperAdmin() {
  requireAdmin()
  if (currentUser()?.role !== "SUPER_ADMIN") fail("Bu amal uchun sizda ruxsat yo‘q.")
}

/** Namunaviy rejim akkauntlari; birinchi marta bosh tashkilotchi bilan yaratiladi */
function accounts(db: LeagueDb): UserAccount[] {
  db.users ??= [
    { id: "u-boss", username: "tashkilotchi", displayName: "Tashkilotchi", role: "SUPER_ADMIN", enabled: true, lastLoginAt: null, createdAt: db.seededAt },
  ]
  return db.users
}

/** Server bilan bir xil parol qoidalari */
function checkPassword(password: string, username: string) {
  if (password.length < 10) fail("Parol kamida 10 ta belgidan iborat bo‘lsin.")
  if (password.length > 128) fail("Parol juda uzun.")
  if (password.toLowerCase().includes(username.toLowerCase())) fail("Parol ichida login bo‘lmasin.")
  if (new Set(password).size < 5) fail("Parol juda oddiy. Har xil harf va raqamlardan foydalaning.")
}

// ---------- Yordamchi o'qish funksiyalari ----------

function season(db: LeagueDb, seasonId: ID): Season {
  return db.seasons.find((s) => s.id === seasonId) ?? fail("Mavsum topilmadi.")
}

/** Qur'a tashlangach mavsum ishtirokchilari qulflanadi (backenddagi qoida bilan bir xil) */
function requireTeamListOpen(db: LeagueDb, seasonId: ID, action: string) {
  if (!db.groups.some((g) => g.seasonId === seasonId)) return
  fail(
    `Qur’a tashlangan — guruhlar shakllangan, bu mavsumga ${action} bo‘lmaydi. Jamoa esdan chiqqan bo‘lsa va hali birorta natija kiritilmagan bo‘lsa, «Guruhlar» bo‘limida qur’ani bekor qiling.`,
  )
}

function requireEditable(db: LeagueDb, seasonId: ID) {
  const s = season(db, seasonId)
  if (s.status === "FINISHED") fail(`${s.name} yakunlangan va arxivga qulflangan. Tarixiy ma’lumotlarni o‘zgartirib bo‘lmaydi.`)
  return s
}

function teamView(db: LeagueDb, st: SeasonTeam): TeamView {
  const team = db.teams.find((t) => t.id === st.teamId)!
  return {
    id: st.id,
    teamId: st.teamId,
    seasonId: st.seasonId,
    name: st.name,
    shortName: st.shortName,
    village: team.village,
    primaryColor: team.primaryColor,
    secondaryColor: team.secondaryColor,
    captainId: st.captainId,
    coach: st.coach,
  }
}

function publicPlayer(db: LeagueDb, playerId: ID): PublicPlayer {
  const p = db.players.find((x) => x.id === playerId)!
  return { id: p.id, firstName: p.firstName, lastName: p.lastName, position: p.position, birthYear: p.birthYear, photoUrl: p.photoUrl ?? null }
}

function stName(db: LeagueDb, seasonTeamId: ID | null | undefined) {
  if (!seasonTeamId) return "Aniqlanmagan"
  return db.seasonTeams.find((s) => s.id === seasonTeamId)?.name ?? "Noma’lum jamoa"
}

function groupStandings(db: LeagueDb, seasonId: ID) {
  const s = season(db, seasonId)
  const result: Record<ID, ReturnType<typeof computeStandings>> = {}
  const matches = db.matches.filter((m) => m.seasonId === seasonId && m.stage === "GROUP")
  const matchIds = new Set(matches.map((m) => m.id))
  const events = db.events.filter((e) => matchIds.has(e.matchId))
  for (const g of db.groups.filter((x) => x.seasonId === seasonId)) {
    result[g.id] = computeStandings({
      teamIds: g.seasonTeamIds,
      matches: matches.filter((m) => m.groupId === g.id),
      events,
      adjustments: db.adjustments.filter((a) => a.seasonId === seasonId),
      rules: s.rules,
      nameOf: (id) => stName(db, id),
      lotOrder: lotOrder(db, seasonId, `GROUP:${g.id}`),
    })
  }
  return result
}

function lotOrder(db: LeagueDb, seasonId: ID, scope: string): ID[] {
  return (db.lots ?? []).find((l) => l.seasonId === seasonId && l.scope === scope)?.order ?? []
}

function saveLot(db: LeagueDb, seasonId: ID, scope: string, order: ID[]) {
  db.lots = [...(db.lots ?? []).filter((l) => !(l.seasonId === seasonId && l.scope === scope)), { seasonId, scope, order }]
}

function shuffled<T>(list: T[]): T[] {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** Pley-offga chiqishga ta'sir qiladigan, qur'a talab qiladigan guruh tengliklari (backend SeasonData.groupTies bilan bir xil) */
function groupTiesOf(db: LeagueDb, seasonId: ID, standings: ReturnType<typeof groupStandings>): Record<ID, ID[]> {
  const s = season(db, seasonId)
  const result: Record<ID, ID[]> = {}
  for (const g of db.groups.filter((x) => x.seasonId === seasonId)) {
    const q = qualifiersFor(s.rules, g.seasonTeamIds.length)
    const byPoints = new Map<number, typeof standings[string]>()
    for (const r of standings[g.id] ?? []) if (r.unresolvedTie) byPoints.set(r.points, [...(byPoints.get(r.points) ?? []), r])
    const ids = [...byPoints.values()].filter((c) => c.some((r) => r.position <= q)).flat().map((r) => r.seasonTeamId)
    if (ids.length > 0) result[g.id] = ids
  }
  return result
}

function seasonPlan(db: LeagueDb, seasonId: ID, standings: ReturnType<typeof groupStandings>) {
  const s = season(db, seasonId)
  const groups = db.groups.filter((g) => g.seasonId === seasonId).sort((a, b) => a.order - b.order)
  const lots = (db.lots ?? []).filter((l) => l.seasonId === seasonId)
  return playoffPlan(groupFinishes(groups, standings, s.rules), seedLotsFrom(lots))
}

const PLAYOFF_SLOTS = ["10:00", "12:30", "15:00", "17:30"]

/** Taxminiy sana-vaqtlar: har bosqich 7 kundan keyin, bir kunda 4 ta o'yin (bitta stadion); final kuni 3-o'rin 15:00, final 17:30 */
function defaultPlayoffKickoffs(plan: ReturnType<typeof playoffPlan>, startDate: string) {
  const order = ROUND_SEQUENCE
  const first = firstRoundFor(plan.bracketSize)!
  const firstIndex = order.indexOf(first) - (plan.playIns.length > 0 ? 1 : 0)
  const finalDay = addDays(startDate, 7 * (order.indexOf("F") - firstIndex))
  return (round: PlayoffRoundKey, i: number) => {
    if (round === "THIRD") return toLocalIso(finalDay, "15:00")
    if (round === "F") return toLocalIso(finalDay, "17:30")
    const step = order.indexOf(round) - firstIndex
    return toLocalIso(addDays(startDate, 7 * step + Math.floor(i / PLAYOFF_SLOTS.length)), PLAYOFF_SLOTS[i % PLAYOFF_SLOTS.length])
  }
}

function removePlayoff(db: LeagueDb, seasonId: ID) {
  const ids = new Set(db.matches.filter((m) => m.seasonId === seasonId && m.stage === "PLAYOFF").map((m) => m.id))
  db.matches = db.matches.filter((m) => !ids.has(m.id))
}

/**
 * Guruh bosqichi holatiga qarab setkani tuzadi, yangilaydi yoki olib tashlaydi (backend PlayoffService.sync bilan bir xil).
 * Pley-off boshlangan bo'lsa tegmaydi; qayta tuzilganda belgilangan sana-vaqtlar saqlanadi.
 */
/** Davra tizimi juftliklari: sanasi belgilanmagan holda, asosiy stadionda */
function createFixtures(db: LeagueDb, season: Season, groups: { id: ID; seasonTeamIds: ID[] }[]) {
  const venueId = (db.venues.find((v) => v.name === "Mirzacho‘l Birlik Arena") ?? db.venues[0])?.id ?? null
  let count = 0
  for (const g of groups) {
    for (const p of roundRobin(g.seasonTeamIds, season.rules.legs)) {
      db.matches.push({
        id: newId("m"),
        seasonId: season.id,
        stage: "GROUP",
        groupId: g.id,
        round: p.round,
        homeId: p.homeId,
        awayId: p.awayId,
        kickoff: placeholderKickoff(season.startDate, p.round),
        timeConfirmed: false,
        venueId,
        status: "SCHEDULED",
        homeScore: null,
        awayScore: null,
      })
      count++
    }
  }
  return count
}

function syncPlayoff(db: LeagueDb, seasonId: ID) {
  const s = season(db, seasonId)
  if (s.status === "FINISHED") return
  const playoff = db.matches.filter((m) => m.seasonId === seasonId && m.stage === "PLAYOFF")
  if (playoff.some((m) => m.status === "FINISHED" || m.status === "LIVE")) return
  const groupMatches = db.matches.filter((m) => m.seasonId === seasonId && m.stage === "GROUP")
  const complete = groupMatches.length > 0 && groupMatches.every((m) => m.status === "FINISHED" || m.status === "CANCELLED")
  const standings = groupStandings(db, seasonId)
  const tiesFree = Object.keys(groupTiesOf(db, seasonId, standings)).length === 0
  let plan = seasonPlan(db, seasonId, standings)
  if (complete && tiesFree && !plan.error && plan.ties.length > 0) {
    // Reyting tengligi faqat juftliklarga ta'sir qiladi — tizim o'zi qur'a tashlaydi
    for (const t of plan.ties) {
      const order = shuffled(t.seasonTeamIds)
      saveLot(db, seasonId, `SEED:${t.position}`, order)
      audit(db, "Qur’a", `Pley-off reytingida jamoalar barcha ko‘rsatkichlar bo‘yicha teng edi — tizim qur’a tashladi: ${order.map((id) => stName(db, id)).join(", ")}`)
    }
    plan = seasonPlan(db, seasonId, standings)
  }
  const ready = complete && tiesFree && !plan.error && plan.ties.length === 0
  if (!ready) {
    if (playoff.length > 0) {
      removePlayoff(db, seasonId)
      audit(db, "Pley-off", "Guruh bosqichi o‘zgardi — pley-off setkasi vaqtincha olib tashlandi. Hammasi aniq bo‘lgach, qayta tuziladi.")
    }
    return
  }
  const key = (m: Match) => `${m.playoffRound}:${m.bracketIndex}`
  const lastGroupDay = groupMatches.map((m) => localDateKey(m.kickoff)).sort().at(-1)!
  const venueId = primaryVenueId(db.venues, groupMatches)
  const created = createBracket({
    seasonId,
    plan,
    thirdPlace: s.rules.thirdPlaceMatch,
    venueId,
    newId: () => newId("m"),
    kickoffFor: defaultPlayoffKickoffs(plan, addDays(lastGroupDay, 7)),
    timeConfirmed: false,
  })
  const previous = new Map(playoff.map((m) => [key(m), m]))
  const same =
    playoff.length === created.length &&
    created.every((m) => {
      const p = previous.get(key(m))
      return p && p.homeId === m.homeId && p.awayId === m.awayId
    })
  if (same) return
  for (const m of created) {
    const old = previous.get(key(m))
    if (old) Object.assign(m, { kickoff: old.kickoff, venueId: old.venueId, timeConfirmed: old.timeConfirmed })
  }
  removePlayoff(db, seasonId)
  db.matches.push(...created)
  audit(
    db,
    "Pley-off",
    playoff.length > 0
      ? "Guruh natijalari o‘zgardi — pley-off setkasi yangilandi"
      : `Guruh bosqichi yakunlandi — pley-off setkasi avtomatik tuzildi (${created.length} ta o‘yin). Sana va vaqtlarni belgilang.`,
  )
}

function sortSeasons(list: Season[]) {
  return [...list].sort((a, b) => b.year - a.year || b.number - a.number)
}

function testSeasonIds(db: LeagueDb) {
  return new Set(db.seasons.filter((x) => x.test).map((x) => x.id))
}

/** Mavsumni o'chirish rejasi: faqat shu mavsumdagi jamoa va futbolchilar o'chadi (backenddagi qoida bilan bir xil) */
function deletePlan(db: LeagueDb, seasonId: ID) {
  const s = season(db, seasonId)
  const others = (sid: ID) => sid !== seasonId
  const sts = db.seasonTeams.filter((st) => st.seasonId === seasonId)
  const teamsRemoved = new Set(
    sts.map((st) => st.teamId).filter((teamId) => !db.seasonTeams.some((o) => o.teamId === teamId && others(o.seasonId))),
  )
  const otherMatches = new Set(db.matches.filter((m) => others(m.seasonId)).map((m) => m.id))
  const seasonPlayers = new Set(db.rosters.filter((r) => r.seasonId === seasonId).map((r) => r.playerId))
  const playersRemoved = new Set(
    [...seasonPlayers].filter(
      (id) =>
        !db.rosters.some((r) => r.playerId === id && others(r.seasonId)) &&
        !db.events.some((e) => otherMatches.has(e.matchId) && (e.playerId === id || e.assistId === id)) &&
        !db.appearances.some((a) => otherMatches.has(a.matchId) && a.playerId === id) &&
        !db.awards.some((a) => others(a.seasonId) && a.playerId === id) &&
        !(db.roundTeams ?? []).some((t) => others(t.seasonId) && t.slots.some((x) => x.playerId === id)) &&
        !db.seasonTeams.some((st) => others(st.seasonId) && st.captainId === id),
    ),
  )
  const matches = seasonMatches(db, seasonId)
  const results = matches.filter((m) => m.status === "FINISHED" || m.status === "LIVE").length
  let problem: string | null = null
  if (!s.test && s.status === "FINISHED") problem = `«${s.name}» yakunlangan va arxivda saqlanadi — uni o‘chirib bo‘lmaydi.`
  else if (!s.test && results > 0) problem = `«${s.name}» haqiqiy mavsum va unda o‘yin natijalari bor — uni o‘chirib bo‘lmaydi. Butunlay faqat sinov mavsumi o‘chiriladi.`
  const preview: SeasonDeletePreview = {
    seasonId,
    name: s.name,
    test: Boolean(s.test),
    canDelete: problem === null,
    problem,
    teams: sts.length,
    teamsRemoved: teamsRemoved.size,
    players: seasonPlayers.size,
    playersRemoved: playersRemoved.size,
    matches: matches.length,
    results,
  }
  return { preview, teamsRemoved, playersRemoved }
}

function seasonMatches(db: LeagueDb, seasonId: ID) {
  return db.matches.filter((m) => m.seasonId === seasonId)
}

function buildBundle(db: LeagueDb, seasonId: ID): SeasonBundle {
  const s = season(db, seasonId)
  const sts = db.seasonTeams.filter((x) => x.seasonId === seasonId)
  const matches = seasonMatches(db, seasonId).sort((a, b) => a.kickoff.localeCompare(b.kickoff))
  const matchIds = new Set(matches.map((m) => m.id))
  const events = db.events.filter((e) => matchIds.has(e.matchId))
  const appearances = db.appearances.filter((a) => matchIds.has(a.matchId))
  const rosters = db.rosters.filter((r) => r.seasonId === seasonId)
  const playerIds = new Set(rosters.map((r) => r.playerId))
  return {
    season: s,
    teams: sts.map((st) => teamView(db, st)).sort((a, b) => a.name.localeCompare(b.name, "uz")),
    groups: db.groups.filter((g) => g.seasonId === seasonId).sort((a, b) => a.order - b.order),
    matches,
    events,
    appearances,
    players: [...playerIds].map((id) => publicPlayer(db, id)),
    rosters: rosters.map((r) => ({ playerId: r.playerId, seasonTeamId: r.seasonTeamId, number: r.number })),
    venues: db.venues,
    standings: groupStandings(db, seasonId),
    playerStats: computePlayerStats(matches, events, appearances),
    discipline: computeTeamDiscipline(sts.map((x) => x.id), matches, events),
    awards: db.awards.filter((a) => a.seasonId === seasonId),
    adjustments: db.adjustments.filter((a) => a.seasonId === seasonId),
    lots: (db.lots ?? []).filter((l) => l.seasonId === seasonId).map((l) => ({ scope: l.scope, order: l.order })),
    roundTeams: (db.roundTeams ?? []).filter((t) => t.seasonId === seasonId && t.published).map(({ seasonId: _s, ...t }) => t),
  }
}

function playerName(db: LeagueDb, playerId: ID) {
  const p = db.players.find((x) => x.id === playerId)
  return p ? `${p.firstName} ${p.lastName}` : ""
}

function seasonTopScorer(db: LeagueDb, seasonId: ID) {
  const matches = seasonMatches(db, seasonId)
  const ids = new Set(matches.map((m) => m.id))
  const stats = computePlayerStats(
    matches,
    db.events.filter((e) => ids.has(e.matchId)),
    db.appearances.filter((a) => ids.has(a.matchId)),
  )
  const top = topScorers(stats, (id) => playerName(db, id))[0]
  if (!top) return null
  const st = db.seasonTeams.find((x) => x.id === top.seasonTeamId)!
  return { player: publicPlayer(db, top.playerId), team: teamView(db, st), goals: top.goals }
}

function awardTeam(db: LeagueDb, seasonId: ID, type: SeasonAward["type"]) {
  const a = db.awards.find((x) => x.seasonId === seasonId && x.type === type)
  const st = a?.seasonTeamId ? db.seasonTeams.find((x) => x.id === a.seasonTeamId) : null
  return st ? teamView(db, st) : null
}

function summary(db: LeagueDb, s: Season): SeasonSummary {
  const matches = seasonMatches(db, s.id)
  const finished = matches.filter((m) => m.status === "FINISHED")
  const goals = finished.reduce((sum, m) => sum + (m.homeScore ?? 0) + (m.awayScore ?? 0) + (m.homeExtra ?? 0) + (m.awayExtra ?? 0), 0)
  const awardScorer = db.awards.find((a) => a.seasonId === s.id && a.type === "TOP_SCORER")
  let topScorer = seasonTopScorer(db, s.id)
  if (awardScorer?.playerId && awardScorer.seasonTeamId && topScorer && topScorer.player.id !== awardScorer.playerId) {
    const st = db.seasonTeams.find((x) => x.id === awardScorer.seasonTeamId)!
    topScorer = { player: publicPlayer(db, awardScorer.playerId), team: teamView(db, st), goals: topScorer.goals }
  }
  return {
    season: s,
    teamsCount: db.seasonTeams.filter((x) => x.seasonId === s.id).length,
    matchesPlayed: finished.length,
    matchesTotal: matches.filter((m) => m.status !== "CANCELLED").length,
    goals,
    champion: awardTeam(db, s.id, "CHAMPION"),
    runnerUp: awardTeam(db, s.id, "RUNNER_UP"),
    third: awardTeam(db, s.id, "THIRD"),
    topScorer,
    final: matches.find((m) => m.playoffRound === "F") ?? null,
  }
}

// ---------- Natijani saqlash yordamchilari ----------

function rosterSet(db: LeagueDb, seasonId: ID, seasonTeamId: ID) {
  return new Set(db.rosters.filter((r) => r.seasonId === seasonId && r.seasonTeamId === seasonTeamId).map((r) => r.playerId))
}

function applyAdvancement(db: LeagueDb, match: Match) {
  for (const u of advancementUpdates(match)) {
    const target = db.matches.find((m) => m.id === u.matchId)
    if (!target) continue
    if (u.slot === "home") target.homeId = u.seasonTeamId
    else target.awayId = u.seasonTeamId
  }
}

function assertMatchInput(db: LeagueDb, seasonId: ID, input: MatchInput, selfId: ID | null = null) {
  if (!input.kickoff || Number.isNaN(Date.parse(input.kickoff))) fail("O‘yin sanasi va vaqtini kiriting.")
  if (input.homeId && input.awayId && input.homeId === input.awayId) fail("Jamoa o‘zi bilan o‘ynay olmaydi. Ikkinchi jamoani o‘zgartiring.")
  const ids = new Set(db.seasonTeams.filter((s) => s.seasonId === seasonId).map((s) => s.id))
  for (const t of [input.homeId, input.awayId]) if (t && !ids.has(t)) fail("Tanlangan jamoa bu mavsumda ishtirok etmaydi.")
  if (input.stage === "GROUP") {
    if (!input.homeId || !input.awayId) fail("Guruh o‘yini uchun ikkala jamoani tanlang.")
    const g = db.groups.find((x) => x.id === input.groupId)
    if (!g) fail("Guruhni tanlang.")
    if (!g!.seasonTeamIds.includes(input.homeId!) || !g!.seasonTeamIds.includes(input.awayId!)) {
      fail(`Ikkala jamoa ham ${g!.name} guruhida bo‘lishi kerak.`)
    }
    // Guruhda har juftlik nizomdagidek uchrashadi: bir davrali — bir marta, ikki davrali — ikki marta (bekor qilingani hisobga olinmaydi)
    const legs = season(db, seasonId).rules.legs
    const pair = [input.homeId, input.awayId].sort().join("|")
    const same = db.matches.filter((x) => x.id !== selfId && x.groupId === g!.id && x.status !== "CANCELLED" && [x.homeId, x.awayId].sort().join("|") === pair).length
    if (same >= legs) {
      const name = (id: ID | null) => db.seasonTeams.find((t) => t.id === id)?.name ?? "Jamoa"
      fail(`${name(input.homeId)} va ${name(input.awayId)} ${g!.name} guruhida allaqachon ${legs === 2 ? "ikki marta" : "bir marta"} o‘ynaydi — nizom bo‘yicha boshqa o‘yin qo‘shib bo‘lmaydi. Sanani o‘zgartirish kerak bo‘lsa, o‘sha o‘yinni tahrirlang.`)
    }
  }
  if (input.status === "FINISHED" || input.status === "LIVE") {
    fail("Hisob va «Davom etmoqda / Yakunlangan» holati «Natijalar» bo‘limida kiritiladi.")
  }
}

const KNOCKOUT_ORDER: PlayoffRoundKey[] = [...ROUND_SEQUENCE.slice(0, 4), "THIRD", "F"]

// ---------- API ----------

export const mockApi: LeagueApi = {
  async getSettings() {
    return delay(load().settings)
  },

  async listSeasons() {
    return delay(sortSeasons(load().seasons.filter((x) => !x.test)))
  },

  async listSeasonsAdmin() {
    requireAdmin()
    return delay(sortSeasons(load().seasons))
  },

  async getSeasonBundle(seasonId) {
    return delay(buildBundle(load(), seasonId))
  },

  async getArchive() {
    const db = load()
    const summaries = db.seasons.filter((x) => !x.test).sort((a, b) => b.year - a.year).map((s) => summary(db, s))
    const finalTeamIds = new Set(summaries.flatMap((s) => (s.final ? [s.final.homeId, s.final.awayId] : [])).filter(Boolean) as ID[])
    const teams = db.seasonTeams.filter((st) => finalTeamIds.has(st.id)).map((st) => teamView(db, st))
    const result: ArchiveBundle = { summaries, teams }
    return delay(result)
  },

  async getTeamProfile(teamId) {
    const db = load()
    const team = db.teams.find((t) => t.id === teamId) ?? fail("Jamoa topilmadi.")
    const hidden = testSeasonIds(db)
    const allSts = db.seasonTeams.filter((s) => s.teamId === teamId)
    const sts = allSts.filter((s) => !hidden.has(s.seasonId))
    // Faqat sinov mavsumida qatnashgan jamoa saytda yo'q
    if (allSts.length > 0 && sts.length === 0) fail("Jamoa topilmadi.")
    const stIds = new Set(sts.map((s) => s.id))
    const records: TeamSeasonRecord[] = []
    for (const st of sts) {
      const s = season(db, st.seasonId)
      const group = db.groups.find((g) => g.seasonId === s.id && g.seasonTeamIds.includes(st.id))
      const row = group ? groupStandings(db, s.id)[group.id]?.find((r) => r.seasonTeamId === st.id) : undefined
      const all = seasonMatches(db, s.id).filter((m) => m.status === "FINISHED" && (m.homeId === st.id || m.awayId === st.id))
      let won = 0
      let drawn = 0
      let lost = 0
      let gf = 0
      let ga = 0
      for (const m of all) {
        const home = m.homeId === st.id
        const f = (home ? m.homeScore! + (m.homeExtra ?? 0) : m.awayScore! + (m.awayExtra ?? 0))
        const a = (home ? m.awayScore! + (m.awayExtra ?? 0) : m.homeScore! + (m.homeExtra ?? 0))
        gf += f
        ga += a
        if (m.winnerId === st.id) won++
        else if (m.winnerId == null && f === a) drawn++
        else lost++
      }
      const award = db.awards.find((a) => a.seasonId === s.id && a.seasonTeamId === st.id && ["CHAMPION", "RUNNER_UP", "THIRD"].includes(a.type))
      const playoffRounds = seasonMatches(db, s.id)
        .filter((m) => m.stage === "PLAYOFF" && (m.homeId === st.id || m.awayId === st.id) && m.playoffRound !== "THIRD")
        .map((m) => m.playoffRound!)
      const stageReached = playoffRounds.length
        ? playoffRounds.sort((a, b) => KNOCKOUT_ORDER.indexOf(b) - KNOCKOUT_ORDER.indexOf(a))[0]
        : group
          ? "GROUP"
          : null
      records.push({
        season: s,
        team: teamView(db, st),
        groupName: group?.name ?? null,
        position: row && row.played > 0 ? row.position : null,
        played: all.length,
        won,
        drawn,
        lost,
        goalsFor: gf,
        goalsAgainst: ga,
        achievement: award?.type ?? null,
        stageReached,
      })
    }
    records.sort((a, b) => b.season.year - a.season.year)
    const matches = db.matches
      .filter((m) => (m.homeId && stIds.has(m.homeId)) || (m.awayId && stIds.has(m.awayId)))
      .sort((a, b) => b.kickoff.localeCompare(a.kickoff))
    const involved = new Set(matches.flatMap((m) => [m.homeId, m.awayId]).filter(Boolean) as ID[])
    const teams = db.seasonTeams.filter((s) => involved.has(s.id)).map((s) => teamView(db, s))
    return delay({ team, records, matches, teams })
  },

  async getPlayerProfile(playerId) {
    const db = load()
    if (!db.players.some((p) => p.id === playerId)) fail("Futbolchi topilmadi.")
    const hidden = testSeasonIds(db)
    const allEntries = db.rosters.filter((r) => r.playerId === playerId)
    const entries = allEntries.filter((r) => !hidden.has(r.seasonId))
    if (allEntries.length > 0 && entries.length === 0) fail("Futbolchi topilmadi.")
    const records = entries
      .map((r) => {
        const s = season(db, r.seasonId)
        const st = db.seasonTeams.find((x) => x.id === r.seasonTeamId)!
        const matches = seasonMatches(db, s.id)
        const ids = new Set(matches.map((m) => m.id))
        const stats =
          computePlayerStats(
            matches,
            db.events.filter((e) => ids.has(e.matchId) && (e.playerId === playerId || e.assistId === playerId)),
            db.appearances.filter((a) => ids.has(a.matchId) && a.playerId === playerId),
          ).find((x) => x.playerId === playerId && x.seasonTeamId === st.id) ?? {
            playerId,
            seasonTeamId: st.id,
            appearances: 0,
            goals: 0,
            penaltyGoals: 0,
            ownGoals: 0,
            assists: 0,
            yellow: 0,
            red: 0,
          }
        return { season: s, team: teamView(db, st), number: r.number, stats }
      })
      .sort((a, b) => b.season.year - a.season.year)
    const awards = db.awards
      .filter((a) => a.playerId === playerId && !hidden.has(a.seasonId))
      .map((a) => ({ ...a, season: season(db, a.seasonId) }))
    return delay({ player: publicPlayer(db, playerId), records, awards })
  },

  async getHeadToHead(teamA, teamB) {
    const db = load()
    const teamOf = (stId: ID) => db.seasonTeams.find((s) => s.id === stId)?.teamId
    const hidden = testSeasonIds(db)
    const matches = headToHead(db.matches.filter((m) => !hidden.has(m.seasonId)), teamA, teamB, teamOf)
    const ids = new Set(matches.flatMap((m) => [m.homeId!, m.awayId!]))
    return delay({
      matches,
      teams: db.seasonTeams.filter((s) => ids.has(s.id)).map((s) => teamView(db, s)),
      seasons: db.seasons.filter((x) => !x.test),
    })
  },

  async listNews(options) {
    const db = load()
    const list = db.news
      .filter((n) => options?.includeDrafts || n.status === "PUBLISHED")
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    return delay(list)
  },

  async getNews(slug) {
    const db = load()
    const n = db.news.find((x) => x.slug === slug && x.status === "PUBLISHED") ?? fail("Yangilik topilmadi yoki hali e’lon qilinmagan.")
    return delay(n)
  },

  async listSponsors(options) {
    const db = load()
    return delay(db.sponsors.filter((s) => options?.includeInactive || s.active).sort((a, b) => a.order - b.order))
  },

  // ---------- Avtorizatsiya (namunaviy) ----------

  async login(username, password) {
    if (!username.trim() || !password) fail("Login va parolni kiriting.")
    // Namunaviy rejimda parol tekshirilmaydi: qo'shilgan yordamchi logini bilan uning roli sinab ko'riladi
    const db = load()
    const account = accounts(db).find((u) => u.username.toLowerCase() === username.trim().toLowerCase())
    if (account && !account.enabled) fail("Bu foydalanuvchi o‘chirib qo‘yilgan. Bosh tashkilotchiga murojaat qiling.")
    const user: AdminUser = account
      ? { username: account.username, displayName: account.displayName, role: account.role }
      : { username: username.trim(), displayName: "Tashkilotchi", role: "SUPER_ADMIN" }
    if (account) {
      account.lastLoginAt = new Date().toISOString()
      save()
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
    return delay(user)
  },

  async logout() {
    sessionStorage.removeItem(SESSION_KEY)
    return delay(undefined)
  },

  async me() {
    return delay(currentUser())
  },

  async changeOwnPassword(currentPassword, newPassword) {
    requireAdmin()
    if (!currentPassword) fail("Joriy parolni kiriting.")
    if (currentPassword === newPassword) fail("Yangi parol joriy paroldan farq qilishi kerak.")
    checkPassword(newPassword, currentUser()!.username)
    return delay(undefined)
  },

  async telegramStatus() {
    requireAdmin()
    return delay({ botEnabled: false, botUsername: "", allowed: true, linked: false, telegramUsername: null })
  },

  async telegramLink() {
    requireAdmin()
    return fail("Namunaviy rejimda Telegram bot ishlamaydi.")
  },

  async telegramUnlink() {
    requireAdmin()
    return delay(undefined)
  },

  // ---------- Foydalanuvchilar (namunaviy) ----------

  async listUsers() {
    requireSuperAdmin()
    return delay(accounts(load()))
  },

  async createUser(input) {
    requireSuperAdmin()
    const db = load()
    const username = input.username.trim()
    if (!/^[A-Za-z0-9._-]{3,40}$/.test(username)) fail("Login 3–40 ta lotin harfi, raqam yoki . _ - belgilaridan iborat bo‘lsin")
    if (accounts(db).some((u) => u.username.toLowerCase() === username.toLowerCase())) fail(`«${username}» logini band. Boshqa login tanlang.`)
    checkPassword(input.password, username)
    const account: UserAccount = {
      id: newId("u"),
      username,
      displayName: input.displayName.trim(),
      role: input.role,
      enabled: true,
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
    }
    accounts(db).push(account)
    audit(db, "Foydalanuvchi", `${account.displayName} (${account.username}) qo‘shildi`)
    save()
    return delay(account)
  },

  async updateUser(id, input) {
    requireSuperAdmin()
    const db = load()
    const account = accounts(db).find((u) => u.id === id) ?? fail("Foydalanuvchi topilmadi.")
    const self = account.username === currentUser()?.username
    if (self && (!input.enabled || input.role !== account.role)) {
      fail("O‘z akkauntingizni o‘chirib yoki rolini o‘zgartirib bo‘lmaydi. Buni boshqa bosh tashkilotchi bajarishi mumkin.")
    }
    const activeBosses = accounts(db).filter((u) => u.enabled && u.role === "SUPER_ADMIN").length
    if (account.role === "SUPER_ADMIN" && account.enabled && (input.role !== "SUPER_ADMIN" || !input.enabled) && activeBosses <= 1) {
      fail("Tizimda kamida bitta faol bosh tashkilotchi qolishi kerak.")
    }
    Object.assign(account, { displayName: input.displayName.trim(), role: input.role, enabled: input.enabled })
    audit(db, "Foydalanuvchi", `${account.displayName} ma’lumotlari o‘zgartirildi`)
    save()
    return delay(account)
  },

  async resetUserPassword(id, password) {
    requireSuperAdmin()
    const db = load()
    const account = accounts(db).find((u) => u.id === id) ?? fail("Foydalanuvchi topilmadi.")
    checkPassword(password, account.username)
    audit(db, "Foydalanuvchi", `${account.displayName} uchun yangi parol o‘rnatildi`)
    save()
    return delay(undefined)
  },

  // ---------- Admin: boshqaruv paneli va mavsumlar ----------

  async getDashboard(seasonId) {
    requireAdmin()
    const db = load()
    const s = season(db, seasonId)
    const matches = seasonMatches(db, seasonId).sort((a, b) => a.kickoff.localeCompare(b.kickoff))
    const now = Date.now()
    const todayIso = new Date(now + 5 * 3600_000).toISOString().slice(0, 10)
    const sts = db.seasonTeams.filter((x) => x.seasonId === seasonId)
    const data: DashboardData = {
      season: s,
      teamsCount: sts.length,
      playersCount: new Set(db.rosters.filter((r) => r.seasonId === seasonId).map((r) => r.playerId)).size,
      matchesTotal: matches.filter((m) => m.status !== "CANCELLED").length,
      matchesFinished: matches.filter((m) => m.status === "FINISHED").length,
      pendingResults: matches.filter(
        (m) => (m.status === "SCHEDULED" || m.status === "LIVE") && Date.parse(m.kickoff) < now && m.homeId && m.awayId,
      ),
      today: matches.filter((m) => m.kickoff.startsWith(todayIso)),
      upcoming: matches.filter((m) => m.status === "SCHEDULED" && Date.parse(m.kickoff) > now).slice(0, 6),
      recentAudit: db.audit.slice(0, 6),
      teams: sts.map((st) => teamView(db, st)),
      groupsCount: db.groups.filter((g) => g.seasonId === seasonId).length,
    }
    return delay(data)
  },

  async createSeason(input) {
    requireAdmin()
    const db = load()
    if (!input.name.trim()) fail("Mavsum nomini kiriting.")
    if (!input.startDate || !input.endDate || input.endDate < input.startDate) fail("Tugash sanasi boshlanish sanasidan keyin bo‘lishi kerak.")
    const number = input.test
      ? Math.min(0, ...db.seasons.map((x) => x.number)) - 1
      : Math.max(0, ...db.seasons.filter((x) => !x.test).map((x) => x.number)) + 1
    const s: Season = {
      id: newId("s"),
      number,
      test: Boolean(input.test),
      name: input.name.trim(),
      year: input.year,
      startDate: input.startDate,
      endDate: input.endDate,
      status: "DRAFT",
      rules: input.rules ?? defaultRules(),
    }
    db.seasons.push(s)
    if (input.copyTeamsFromSeasonId) {
      for (const old of db.seasonTeams.filter((x) => x.seasonId === input.copyTeamsFromSeasonId)) {
        const team = db.teams.find((t) => t.id === old.teamId)!
        if (!team.active) continue
        const st: SeasonTeam = { id: newId("st"), seasonId: s.id, teamId: team.id, name: team.name, shortName: team.shortName, captainId: old.captainId, coach: old.coach }
        db.seasonTeams.push(st)
        for (const r of db.rosters.filter((x) => x.seasonTeamId === old.id)) {
          db.rosters.push({ id: newId("r"), seasonId: s.id, seasonTeamId: st.id, playerId: r.playerId, number: r.number })
        }
      }
    }
    audit(db, "Mavsum", `«${s.name}» (${s.year})${s.test ? " sinov mavsumi" : ""} yaratildi`)
    save()
    return delay(s)
  },

  async updateSeasonRules(seasonId, rules) {
    requireAdmin()
    const db = load()
    const s = requireEditable(db, seasonId)
    if (rules.pointsWin < rules.pointsDraw || rules.pointsDraw < rules.pointsLoss) fail("G‘alaba uchun ochko durangdan, durang esa mag‘lubiyatdan kam bo‘lmasin.")
    if (rules.tiebreakers.length === 0) fail("Kamida bitta teng ochko mezonini tanlang.")
    for (const [size, q] of Object.entries(rules.qualifiersBySize ?? {})) {
      if (q < 1 || q >= Number(size)) fail(`${size} jamoali guruhdan 1 tadan ${Number(size) - 1} tagacha jamoa chiqishi mumkin.`)
    }
    s.rules = rules
    audit(db, "Sozlamalar", `${s.name} qoidalari yangilandi`)
    syncPlayoff(db, seasonId)
    save()
    return delay(s)
  },

  async activateSeason(seasonId) {
    requireAdmin()
    const db = load()
    const s = season(db, seasonId)
    if (s.status !== "DRAFT") fail("Faqat tayyorlanayotgan mavsumni boshlash mumkin.")
    const active = db.seasons.find((x) => x.status === "ACTIVE")
    if (active?.test) fail(`Hozir «${active.name}» sinov mavsumi boshlangan. Avval uni «Mavsumlar» bo‘limida o‘chiring.`)
    if (active) fail(`Avval joriy «${active.name}»ni yakunlang.`)
    s.status = "ACTIVE"
    audit(db, "Mavsum", `«${s.name}» boshlandi`)
    save()
    return delay(s)
  },

  async previewDeleteSeason(seasonId) {
    requireAdmin()
    return delay(deletePlan(load(), seasonId).preview)
  },

  async deleteSeason(seasonId, name) {
    requireSuperAdmin()
    const db = load()
    const s = season(db, seasonId)
    if (!name || s.name.trim().toLowerCase() !== name.trim().toLowerCase()) fail(`Tasdiqlash uchun mavsum nomini aynan yozing: «${s.name}».`)
    const plan = deletePlan(db, seasonId)
    if (plan.preview.problem) fail(plan.preview.problem)
    const matchIds = new Set(seasonMatches(db, seasonId).map((m) => m.id))
    db.roundTeams = (db.roundTeams ?? []).filter((t) => t.seasonId !== seasonId)
    db.lots = (db.lots ?? []).filter((l) => l.seasonId !== seasonId)
    db.awards = db.awards.filter((a) => a.seasonId !== seasonId)
    db.adjustments = db.adjustments.filter((a) => a.seasonId !== seasonId)
    db.events = db.events.filter((e) => !matchIds.has(e.matchId))
    db.appearances = db.appearances.filter((a) => !matchIds.has(a.matchId))
    db.matches = db.matches.filter((m) => m.seasonId !== seasonId)
    db.groups = db.groups.filter((g) => g.seasonId !== seasonId)
    db.rosters = db.rosters.filter((r) => r.seasonId !== seasonId)
    db.seasonTeams = db.seasonTeams.filter((st) => st.seasonId !== seasonId)
    db.seasons = db.seasons.filter((x) => x.id !== seasonId)
    db.teams = db.teams.filter((t) => !plan.teamsRemoved.has(t.id))
    db.players = db.players.filter((p) => !plan.playersRemoved.has(p.id))
    audit(db, "Mavsum", `«${s.name}»${s.test ? " sinov mavsumi" : ""} butunlay o‘chirildi: ${plan.teamsRemoved.size} ta jamoa, ${plan.playersRemoved.size} ta futbolchi, ${matchIds.size} ta o‘yin`)
    save()
    const result: SeasonDeleted = { name: s.name, teams: plan.teamsRemoved.size, players: plan.playersRemoved.size, matches: matchIds.size }
    return delay(result)
  },

  async previewFinishSeason(seasonId) {
    requireAdmin()
    const db = load()
    return delay(finishPreview(db, seasonId))
  },

  async finishSeason(seasonId) {
    requireAdmin()
    const db = load()
    const s = requireEditable(db, seasonId)
    const preview = finishPreview(db, seasonId)
    if (!preview.canFinish) fail(preview.problems.join(" "))
    db.awards = db.awards.filter((a) => !(a.seasonId === seasonId && ["CHAMPION", "RUNNER_UP", "THIRD", "TOP_SCORER", "FAIR_PLAY"].includes(a.type)))
    const push = (type: SeasonAward["type"], seasonTeamId?: ID | null, playerId?: ID | null, note?: string) => {
      if (seasonTeamId || playerId) db.awards.push({ id: newId("a"), seasonId, type, seasonTeamId: seasonTeamId ?? null, playerId: playerId ?? null, note: note ?? null })
    }
    push("CHAMPION", preview.champion?.id)
    push("RUNNER_UP", preview.runnerUp?.id)
    push("THIRD", preview.third?.id)
    if (preview.topScorer) push("TOP_SCORER", preview.topScorer.team.id, preview.topScorer.player.id, `${preview.topScorer.goals} ta gol`)
    push("FAIR_PLAY", preview.fairPlay?.id)
    s.status = "FINISHED"
    audit(db, "Mavsum", `«${s.name}» yakunlandi va arxivga o‘tkazildi. Chempion: ${preview.champion?.name ?? "—"}`)
    save()
    return delay(s)
  },

  // ---------- Admin: jamoalar ----------

  async listTeamsAdmin(seasonId) {
    requireAdmin()
    const db = load()
    const rows: AdminTeamRow[] = db.teams.map((t) => {
      const st = db.seasonTeams.find((x) => x.seasonId === seasonId && x.teamId === t.id)
      const allSt = new Set(db.seasonTeams.filter((x) => x.teamId === t.id).map((x) => x.id))
      return {
        ...t,
        inSeason: Boolean(st),
        seasonTeamId: st?.id ?? null,
        playersCount: st ? db.rosters.filter((r) => r.seasonTeamId === st.id).length : 0,
        hasHistory: db.matches.some((m) => (m.homeId && allSt.has(m.homeId)) || (m.awayId && allSt.has(m.awayId))),
      }
    })
    return delay(rows.sort((a, b) => Number(b.inSeason) - Number(a.inSeason) || a.name.localeCompare(b.name, "uz")))
  },

  async createTeam(input, addToSeasonId) {
    requireAdmin()
    const db = load()
    validateTeam(db, input)
    if (addToSeasonId) requireTeamListOpen(db, addToSeasonId, "yangi jamoa qo‘shib")
    const team: Team = { id: newId("t"), ...trimTeam(input), founded: input.founded ?? undefined, active: true }
    db.teams.push(team)
    if (addToSeasonId) {
      requireEditable(db, addToSeasonId)
      db.seasonTeams.push({ id: newId("st"), seasonId: addToSeasonId, teamId: team.id, name: team.name, shortName: team.shortName })
    }
    audit(db, "Jamoa", `«${team.name}» jamoasi qo‘shildi`)
    save()
    return delay(team)
  },

  async updateTeam(teamId, input) {
    requireAdmin()
    const db = load()
    const team = db.teams.find((t) => t.id === teamId) ?? fail("Jamoa topilmadi.")
    validateTeam(db, input, teamId)
    Object.assign(team, trimTeam(input), { founded: input.founded ?? undefined })
    // Faqat yakunlanmagan mavsumlardagi nom yangilanadi — arxiv tarixi o'zgarmaydi
    for (const st of db.seasonTeams.filter((x) => x.teamId === teamId)) {
      if (season(db, st.seasonId).status !== "FINISHED") {
        st.name = team.name
        st.shortName = team.shortName
      }
    }
    audit(db, "Jamoa", `«${team.name}» jamoasi ma’lumotlari tahrirlandi`)
    save()
    return delay(team)
  },

  async deleteTeam(teamId) {
    requireAdmin()
    const db = load()
    const team = db.teams.find((t) => t.id === teamId) ?? fail("Jamoa topilmadi.")
    const stIds = new Set(db.seasonTeams.filter((x) => x.teamId === teamId).map((x) => x.id))
    if (db.matches.some((m) => (m.homeId && stIds.has(m.homeId)) || (m.awayId && stIds.has(m.awayId)))) {
      fail(`«${team.name}» o‘yinlari tarixda saqlangan, shuning uchun uni o‘chirib bo‘lmaydi. Uning o‘rniga jamoani mavsumdan chiqaring.`)
    }
    db.teams = db.teams.filter((t) => t.id !== teamId)
    db.seasonTeams = db.seasonTeams.filter((x) => !stIds.has(x.id))
    db.rosters = db.rosters.filter((r) => !stIds.has(r.seasonTeamId))
    for (const g of db.groups) g.seasonTeamIds = g.seasonTeamIds.filter((id) => !stIds.has(id))
    audit(db, "Jamoa", `«${team.name}» jamoasi o‘chirildi`)
    save()
    return delay(undefined)
  },

  async setTeamInSeason(teamId, seasonId, inSeason) {
    requireAdmin()
    const db = load()
    requireEditable(db, seasonId)
    const team = db.teams.find((t) => t.id === teamId) ?? fail("Jamoa topilmadi.")
    const st = db.seasonTeams.find((x) => x.seasonId === seasonId && x.teamId === teamId)
    if (inSeason !== Boolean(st)) requireTeamListOpen(db, seasonId, inSeason ? "yangi jamoa qo‘shib" : "jamoani mavsumdan chiqarib")
    if (inSeason && !st) {
      db.seasonTeams.push({ id: newId("st"), seasonId, teamId, name: team.name, shortName: team.shortName })
      audit(db, "Jamoa", `«${team.name}» mavsumga qo‘shildi`)
    } else if (!inSeason && st) {
      if (db.matches.some((m) => m.homeId === st.id || m.awayId === st.id)) {
        fail(`«${team.name}» uchun bu mavsumda o‘yinlar belgilangan. Avval o‘sha o‘yinlarni o‘chiring.`)
      }
      db.seasonTeams = db.seasonTeams.filter((x) => x.id !== st.id)
      db.rosters = db.rosters.filter((r) => r.seasonTeamId !== st.id)
      for (const g of db.groups) g.seasonTeamIds = g.seasonTeamIds.filter((id) => id !== st.id)
      audit(db, "Jamoa", `«${team.name}» mavsumdan chiqarildi`)
    }
    save()
    return delay(undefined)
  },

  // ---------- Admin: futbolchilar ----------

  async listPlayersAdmin(seasonId) {
    requireAdmin()
    const db = load()
    const matches = seasonMatches(db, seasonId)
    const ids = new Set(matches.map((m) => m.id))
    const goals = new Map<ID, number>()
    for (const e of db.events) {
      if (ids.has(e.matchId) && e.playerId && (e.type === "GOAL" || e.type === "PENALTY_GOAL")) goals.set(e.playerId, (goals.get(e.playerId) ?? 0) + 1)
    }
    const withHistory = new Set([...db.events.map((e) => e.playerId), ...db.appearances.map((a) => a.playerId)].filter(Boolean) as ID[])
    const rows: AdminPlayerRow[] = db.players.map((p) => {
      const r = db.rosters.find((x) => x.seasonId === seasonId && x.playerId === p.id)
      return {
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        birthYear: p.birthYear,
        position: p.position,
        phone: p.phone,
        seasonTeamId: r?.seasonTeamId ?? null,
        number: r?.number,
        goals: goals.get(p.id) ?? 0,
        hasHistory: withHistory.has(p.id),
      }
    })
    return delay(rows.sort((a, b) => a.lastName.localeCompare(b.lastName, "uz")))
  },

  async createPlayer(seasonId, input) {
    requireAdmin()
    const db = load()
    validatePlayer(input)
    const player = {
      id: newId("p"),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      birthYear: input.birthYear ?? undefined,
      position: input.position,
      phone: input.phone?.trim() || undefined,
    }
    db.players.push(player)
    if (input.seasonTeamId) {
      requireEditable(db, seasonId)
      assertNumberFree(db, seasonId, input.seasonTeamId, input.number ?? null, player.id)
      db.rosters.push({ id: newId("r"), seasonId, seasonTeamId: input.seasonTeamId, playerId: player.id, number: input.number ?? undefined })
    }
    audit(db, "Futbolchi", `${player.firstName} ${player.lastName} qo‘shildi`)
    save()
    return delay(undefined)
  },

  async createPlayers(seasonId, input) {
    requireAdmin()
    const db = load()
    requireEditable(db, seasonId)
    const st = db.seasonTeams.find((x) => x.id === input.seasonTeamId && x.seasonId === seasonId) ?? fail("Tanlangan jamoa bu mavsumda ishtirok etmaydi.")
    const seen = new Set<number>()
    input.players.forEach((p, i) => {
      if (p.firstName.trim().length < 2 || p.lastName.trim().length < 2) fail(`${i + 1}-qator: ism va familiyani to‘liq yozing.`)
      if (p.number == null) return
      if (seen.has(p.number)) fail(`${i + 1}-qator: ${p.number}-raqam ro‘yxatda ikki marta yozilgan.`)
      seen.add(p.number)
      const taken = db.rosters.find((r) => r.seasonTeamId === st.id && r.number === p.number)
      if (taken) fail(`${i + 1}-qator: ${p.number}-raqam ${st.name} jamoasida band.`)
    })
    for (const p of input.players) {
      const player = { id: newId("p"), firstName: p.firstName.trim(), lastName: p.lastName.trim(), birthYear: p.birthYear ?? undefined, position: p.position ?? null }
      db.players.push(player)
      db.rosters.push({ id: newId("r"), seasonId, seasonTeamId: st.id, playerId: player.id, number: p.number ?? undefined })
    }
    audit(db, "Futbolchi", `${st.name} tarkibiga ${input.players.length} ta futbolchi qo‘shildi`)
    save()
    return delay({ created: input.players.length })
  },

  async updatePlayer(seasonId, playerId, input) {
    requireAdmin()
    const db = load()
    validatePlayer(input)
    const p = db.players.find((x) => x.id === playerId) ?? fail("Futbolchi topilmadi.")
    Object.assign(p, {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      birthYear: input.birthYear ?? undefined,
      position: input.position,
      phone: input.phone?.trim() || undefined,
    })
    const current = db.rosters.find((r) => r.seasonId === seasonId && r.playerId === playerId)
    const target = input.seasonTeamId ?? null
    if ((current?.seasonTeamId ?? null) !== target || (current && current.number !== (input.number ?? undefined))) {
      requireEditable(db, seasonId)
    }
    if (current && current.seasonTeamId !== target) {
      const ids = new Set(seasonMatches(db, seasonId).map((m) => m.id))
      const played =
        db.events.some((e) => ids.has(e.matchId) && (e.playerId === playerId || e.assistId === playerId) && e.seasonTeamId === current.seasonTeamId) ||
        db.appearances.some((a) => ids.has(a.matchId) && a.playerId === playerId && a.seasonTeamId === current.seasonTeamId)
      if (played) fail("Bu futbolchi mavsumda jamoasi uchun o‘ynagan. Statistikasi saqlanishi uchun jamoasini mavsum o‘rtasida o‘zgartirib bo‘lmaydi.")
      db.rosters = db.rosters.filter((r) => r !== current)
    }
    if (target) {
      assertNumberFree(db, seasonId, target, input.number ?? null, playerId)
      const existing = db.rosters.find((r) => r.seasonId === seasonId && r.playerId === playerId)
      if (existing) existing.number = input.number ?? undefined
      else db.rosters.push({ id: newId("r"), seasonId, seasonTeamId: target, playerId, number: input.number ?? undefined })
    }
    audit(db, "Futbolchi", `${p.firstName} ${p.lastName} ma’lumotlari tahrirlandi`)
    save()
    return delay(undefined)
  },

  async deletePlayer(playerId) {
    requireAdmin()
    const db = load()
    const p = db.players.find((x) => x.id === playerId) ?? fail("Futbolchi topilmadi.")
    if (db.events.some((e) => e.playerId === playerId || e.assistId === playerId) || db.appearances.some((a) => a.playerId === playerId)) {
      fail("Bu futbolchining o‘yinlar statistikasi bor, uni o‘chirib bo‘lmaydi. Uning o‘rniga jamoa tarkibidan chiqaring.")
    }
    if ((db.roundTeams ?? []).some((t) => t.slots.some((s) => s.playerId === playerId))) {
      fail("Bu futbolchi ramziy jamoada turibdi — o‘chirishdan oldin uni ramziy jamoada boshqa futbolchiga almashtiring.")
    }
    db.players = db.players.filter((x) => x.id !== playerId)
    db.rosters = db.rosters.filter((r) => r.playerId !== playerId)
    audit(db, "Futbolchi", `${p.firstName} ${p.lastName} o‘chirildi`)
    save()
    return delay(undefined)
  },

  // ---------- Admin: guruhlar ----------

  async saveGroups(seasonId, groups) {
    requireAdmin()
    const db = load()
    const s = requireEditable(db, seasonId)
    const teamIds = db.seasonTeams.filter((x) => x.seasonId === seasonId).map((x) => x.id)
    const check = checkDraw(groups, teamIds)
    if (!check.ok) fail(check.errors.join(" "))
    const groupMatches = db.matches.filter((m) => m.seasonId === seasonId && m.stage === "GROUP")
    if (groupMatches.some((m) => m.status === "FINISHED" || m.status === "LIVE")) {
      fail("Guruh bosqichi o‘yinlari boshlangan. Qur’a natijasini endi o‘zgartirib bo‘lmaydi.")
    }
    const removed = groupMatches.length
    const removedIds = new Set(groupMatches.map((m) => m.id))
    db.matches = db.matches.filter((m) => !removedIds.has(m.id))
    db.groups = db.groups.filter((g) => g.seasonId !== seasonId)
    const saved = groups.map((g, i) => {
      const group = { id: newId("g"), seasonId, name: g.name || GROUP_LETTERS[i], order: i, seasonTeamIds: [...g.teamIds] }
      db.groups.push(group)
      return group
    })
    // Qur'adan keyin juftliklar o'zi tuziladi; sana va vaqtni har bir o'yinga tashkilotchi belgilaydi
    const fixtures = createFixtures(db, s, saved)
    syncPlayoff(db, seasonId)
    audit(db, "Qur’a", `${s.name}: ${groups.length} ta guruh tasdiqlandi, ${fixtures} ta juftlik tuzildi${removed ? `, ${removed} ta eski o‘yin o‘chirildi` : ""}`)
    save()
    return delay(undefined)
  },

  async resetGroups(seasonId) {
    requireAdmin()
    const db = load()
    const s = requireEditable(db, seasonId)
    const groups = db.groups.filter((g) => g.seasonId === seasonId)
    if (groups.length === 0) fail("Bu mavsumda hali qur’a tashlanmagan.")
    const seasonMatchList = db.matches.filter((m) => m.seasonId === seasonId)
    if (seasonMatchList.some((m) => m.status === "FINISHED" || m.status === "LIVE")) fail("Natija kiritilgan — qur’ani endi bekor qilib bo‘lmaydi.")
    const removed = new Set(seasonMatchList.filter((m) => m.stage === "GROUP").map((m) => m.id))
    db.matches = db.matches.filter((m) => !removed.has(m.id))
    db.groups = db.groups.filter((g) => g.seasonId !== seasonId)
    syncPlayoff(db, seasonId)
    audit(db, "Qur’a", `${s.name}: qur’a bekor qilindi — ${groups.length} ta guruh va ${removed.size} ta juftlik o‘chirildi`)
    save()
    return delay(undefined)
  },

  // ---------- Admin: o'yinlar ----------

  async createMatch(seasonId, input) {
    requireAdmin()
    const db = load()
    requireEditable(db, seasonId)
    assertMatchInput(db, seasonId, input)
    const m: Match = {
      id: newId("m"),
      seasonId,
      stage: input.stage,
      groupId: input.stage === "GROUP" ? input.groupId ?? null : null,
      round: input.round ?? null,
      playoffRound: input.stage === "PLAYOFF" ? input.playoffRound ?? null : null,
      homeId: input.homeId,
      awayId: input.awayId,
      kickoff: input.kickoff,
      venueId: input.venueId ?? null,
      status: input.status,
      homeScore: null,
      awayScore: null,
      referee: input.referee?.trim() || null,
      note: input.note?.trim() || null,
    }
    db.matches.push(m)
    audit(db, "O‘yin", `${stName(db, m.homeId)} — ${stName(db, m.awayId)} o‘yini ${formatDate(m.kickoff)} kuniga belgilandi`)
    save()
    return delay(m)
  },

  async updateMatch(matchId, input) {
    requireAdmin()
    const db = load()
    const m = db.matches.find((x) => x.id === matchId) ?? fail("O‘yin topilmadi.")
    requireEditable(db, m.seasonId)
    const hasResult = m.status === "FINISHED" || m.status === "LIVE"
    if (hasResult && (input.homeId !== m.homeId || input.awayId !== m.awayId)) {
      fail("Natijasi bor o‘yinning jamoalarini o‘zgartirib bo‘lmaydi.")
    }
    if (!hasResult) assertMatchInput(db, m.seasonId, input, m.id)
    else if (!input.kickoff || Number.isNaN(Date.parse(input.kickoff))) fail("O‘yin sanasi va vaqtini kiriting.")
    const moved = m.kickoff !== input.kickoff
    Object.assign(m, {
      timeConfirmed: true,
      groupId: m.stage === "GROUP" ? input.groupId ?? m.groupId : m.groupId,
      round: input.round ?? m.round,
      homeId: input.homeId,
      awayId: input.awayId,
      kickoff: input.kickoff,
      venueId: input.venueId ?? null,
      status: hasResult ? m.status : input.status,
      referee: input.referee?.trim() || null,
      note: input.note?.trim() || null,
    })
    audit(
      db,
      "O‘yin",
      `${stName(db, m.homeId)} — ${stName(db, m.awayId)} o‘yini tahrirlandi${moved ? ` (yangi sana: ${formatDate(m.kickoff)})` : ""}`,
    )
    save()
    return delay(m)
  },

  async deleteMatch(matchId) {
    requireAdmin()
    const db = load()
    const m = db.matches.find((x) => x.id === matchId) ?? fail("O‘yin topilmadi.")
    requireEditable(db, m.seasonId)
    if (m.status === "FINISHED" || m.status === "LIVE") fail("Natijasi kiritilgan o‘yinni o‘chirib bo‘lmaydi. Kerak bo‘lsa, uni «Bekor qilingan» deb belgilang.")
    if (m.stage === "PLAYOFF") fail("Pley-off o‘yinlari sxema orqali boshqariladi. «Pley-off» bo‘limidan foydalaning.")
    if (m.stage === "GROUP" && m.groupId && m.homeId && m.awayId) {
      // Davra tizimi buzilmasin: juftlikning yagona o'yini o'chirilmaydi (backenddagi qoida bilan bir xil)
      const pair = [m.homeId, m.awayId].sort().join("|")
      const others = db.matches.filter((x) => x.id !== m.id && x.groupId === m.groupId && [x.homeId, x.awayId].sort().join("|") === pair).length
      if (others < season(db, m.seasonId).rules.legs) {
        fail("Bu juftlikning guruhdagi o‘yini — uni o‘chirsangiz, jamoalar o‘zaro o‘ynamay qoladi va jadval to‘liq bo‘lmaydi. O‘yin o‘tkazilmasa, uni «Bekor qilingan» deb belgilang yoki natijalar bo‘limida texnik natija kiriting.")
      }
    }
    db.matches = db.matches.filter((x) => x.id !== matchId)
    db.events = db.events.filter((e) => e.matchId !== matchId)
    audit(db, "O‘yin", `${stName(db, m.homeId)} — ${stName(db, m.awayId)} o‘yini o‘chirildi`)
    save()
    return delay(undefined)
  },

  async generateFixtures(seasonId) {
    requireAdmin()
    const db = load()
    const s = requireEditable(db, seasonId)
    const empty = db.groups.filter((g) => g.seasonId === seasonId && !db.matches.some((m) => m.groupId === g.id))
    if (empty.length === 0) fail("Barcha guruhlarning juftliklari allaqachon tuzilgan.")
    const created = createFixtures(db, s, empty)
    audit(db, "Taqvim", `${created} ta guruh juftligi tuzildi (sanalari belgilanmagan)`)
    syncPlayoff(db, seasonId)
    save()
    return delay({ created })
  },

  // ---------- Admin: natijalar ----------

  async saveResult(matchId, input: ResultInput) {
    requireAdmin()
    const db = load()
    const m = db.matches.find((x) => x.id === matchId) ?? fail("O‘yin topilmadi.")
    requireEditable(db, m.seasonId)
    if ((input.status === "LIVE" || input.status === "FINISHED") && m.timeConfirmed === false) {
      fail("Avval o‘yin sanasi va vaqtini belgilang («O‘yinlar» bo‘limi), so‘ng natijani kiriting.")
    }
    const check = validateResult(m, input, (st) => rosterSet(db, m.seasonId, st), (st) => stName(db, st))
    if (check.errors.length) fail(check.errors[0])
    const outcome = deriveOutcome(m, input)

    if (m.stage === "PLAYOFF") {
      const nextIds = [m.nextMatchId, m.loserNextMatchId].filter(Boolean) as ID[]
      const changed = outcome.winnerId !== (m.winnerId ?? null)
      const nextPlayed = db.matches.some((x) => nextIds.includes(x.id) && (x.status === "FINISHED" || x.status === "LIVE"))
      if (changed && nextPlayed) fail("Keyingi bosqich o‘yini allaqachon o‘tkazilgan. G‘olibni o‘zgartirish uchun avval o‘sha o‘yin natijasini bekor qiling.")
    }

    const playable = input.status === "LIVE" || input.status === "FINISHED"
    Object.assign(m, {
      status: input.status,
      homeScore: outcome.homeScore,
      awayScore: outcome.awayScore,
      homeExtra: playable && !input.forfeitLoser ? input.homeExtra ?? null : null,
      awayExtra: playable && !input.forfeitLoser ? input.awayExtra ?? null : null,
      homePens: playable && !input.forfeitLoser ? input.homePens ?? null : null,
      awayPens: playable && !input.forfeitLoser ? input.awayPens ?? null : null,
      decidedBy: outcome.decidedBy,
      winnerId: outcome.winnerId,
      liveMinute: input.status === "LIVE" ? input.liveMinute ?? null : null,
    })

    // Hodisalar to'liq almashtiriladi — eski gollar ikki marta hisoblanmaydi
    db.events = db.events.filter((e) => e.matchId !== matchId)
    if (playable && !input.forfeitLoser) {
      for (const e of input.events) {
        db.events.push({
          id: newId("e"),
          matchId,
          type: e.type,
          minute: e.minute ?? null,
          playerId: e.playerId ?? null,
          seasonTeamId: e.seasonTeamId,
          assistId: e.assistId ?? null,
        })
      }
    }
    if (input.appearances) {
      db.appearances = db.appearances.filter((a) => a.matchId !== matchId)
      if (playable) for (const a of input.appearances) db.appearances.push({ matchId, ...a })
    }
    if (m.stage === "PLAYOFF") applyAdvancement(db, m)

    const score = m.homeScore != null ? `${m.homeScore}:${m.awayScore}` : "hisobsiz"
    audit(db, "Natija", `${stName(db, m.homeId)} ${score} ${stName(db, m.awayId)} — ${input.status === "FINISHED" ? "yakunlandi" : input.status === "LIVE" ? "jonli yangilandi" : "holati o‘zgartirildi"}`)
    if (m.stage === "GROUP") syncPlayoff(db, m.seasonId)
    save()
    return delay(m)
  },

  // ---------- Admin: pley-off ----------

  async createPlayoff(seasonId, input) {
    requireAdmin()
    const db = load()
    const s = requireEditable(db, seasonId)
    if (db.matches.some((m) => m.seasonId === seasonId && m.stage === "PLAYOFF")) fail("Pley-off sxemasi allaqachon yaratilgan.")
    const groupMatches = db.matches.filter((m) => m.seasonId === seasonId && m.stage === "GROUP")
    const unfinished = groupMatches.filter((m) => m.status !== "FINISHED" && m.status !== "CANCELLED").length
    if (groupMatches.length === 0) fail("Guruh bosqichi o‘yinlari hali yo‘q.")
    if (unfinished > 0) fail(`Guruh bosqichida hali ${unfinished} ta o‘yin yakunlanmagan. Pley-off barcha guruh o‘yinlari tugagach tuziladi.`)
    const standings = groupStandings(db, seasonId)
    if (Object.keys(groupTiesOf(db, seasonId, standings)).length > 0) fail("Guruhda jamoalar barcha mezonlar bo‘yicha teng. Avval qur’a tashlang.")
    const plan = seasonPlan(db, seasonId, standings)
    if (plan.error) fail(plan.error)
    if (plan.ties.length > 0) fail("Pley-off reytingida teng jamoalar bor. Avval qur’a tashlang.")
    const bracket = createBracket({
      seasonId,
      plan,
      thirdPlace: input.thirdPlace,
      venueId: input.venueId ?? primaryVenueId(db.venues, groupMatches),
      newId: () => newId("m"),
      kickoffFor: defaultPlayoffKickoffs(plan, input.startDate),
    })
    db.matches.push(...bracket)
    s.rules = { ...s.rules, thirdPlaceMatch: input.thirdPlace }
    audit(db, "Pley-off", `${s.name}: pley-off sxemasi yaratildi (${bracket.length} ta o‘yin)`)
    save()
    return delay({ created: bracket.length })
  },

  async scheduleMatch(matchId, input) {
    requireAdmin()
    const db = load()
    const m = db.matches.find((x) => x.id === matchId) ?? fail("O‘yin topilmadi.")
    requireEditable(db, m.seasonId)
    Object.assign(m, { kickoff: input.kickoff, venueId: input.venueId, timeConfirmed: true })
    audit(db, "O‘yin", `${stName(db, m.homeId)} — ${stName(db, m.awayId)}: sana va vaqt belgilandi`)
    save()
    return delay(m)
  },

  async drawLot(seasonId, input) {
    requireAdmin()
    const db = load()
    requireEditable(db, seasonId)
    if (db.matches.some((m) => m.seasonId === seasonId && m.stage === "PLAYOFF" && (m.status === "FINISHED" || m.status === "LIVE"))) {
      fail("Pley-off boshlangan — qur’a natijasini o‘zgartirib bo‘lmaydi.")
    }
    const ids = [...new Set(input.seasonTeamIds)]
    if (ids.length < 2) fail("Qur’a uchun kamida 2 ta jamoa kerak.")
    const order = input.random ? shuffled(ids) : ids
    saveLot(db, seasonId, input.scope, order)
    audit(db, "Qur’a", `${input.random ? "Tasodifiy qur’a tashlandi" : "Qur’a natijasi kiritildi"}: ${order.map((id) => stName(db, id)).join(", ")}`)
    syncPlayoff(db, seasonId)
    save()
    return delay(undefined)
  },

  async deleteLot(seasonId, scope) {
    requireAdmin()
    const db = load()
    requireEditable(db, seasonId)
    db.lots = (db.lots ?? []).filter((l) => !(l.seasonId === seasonId && l.scope === scope))
    audit(db, "Qur’a", "Qur’a natijasi bekor qilindi")
    syncPlayoff(db, seasonId)
    save()
    return delay(undefined)
  },

  async deletePlayoff(seasonId) {
    requireAdmin()
    const db = load()
    requireEditable(db, seasonId)
    const playoff = db.matches.filter((m) => m.seasonId === seasonId && m.stage === "PLAYOFF")
    if (playoff.some((m) => m.status === "FINISHED" || m.status === "LIVE")) fail("Pley-off o‘yinlari boshlangan, sxemani o‘chirib bo‘lmaydi.")
    const ids = new Set(playoff.map((m) => m.id))
    db.matches = db.matches.filter((m) => !ids.has(m.id))
    audit(db, "Pley-off", "Pley-off sxemasi o‘chirildi")
    save()
    return delay(undefined)
  },

  // ---------- Admin: kontent ----------

  async saveNews(id, input) {
    requireAdmin()
    const db = load()
    if (input.title.trim().length < 5) fail("Sarlavha kamida 5 ta belgidan iborat bo‘lsin.")
    if (!input.body.trim()) fail("Yangilik matnini kiriting.")
    let slug = slugify(input.title) || newId("yangilik")
    if (db.news.some((n) => n.slug === slug && n.id !== id)) slug = `${slug}-${Date.now().toString(36).slice(-4)}`
    let item = id ? db.news.find((n) => n.id === id) : undefined
    if (id && !item) fail("Yangilik topilmadi.")
    const wasPublished = item?.status === "PUBLISHED"
    if (!item) {
      item = { id: newId("n"), slug, publishedAt: new Date().toISOString(), ...input, title: input.title.trim(), excerpt: input.excerpt.trim(), body: input.body.trim() }
      db.news.push(item)
    } else {
      Object.assign(item, { ...input, title: input.title.trim(), excerpt: input.excerpt.trim(), body: input.body.trim(), slug })
      if (!wasPublished && input.status === "PUBLISHED") item.publishedAt = new Date().toISOString()
    }
    audit(db, "Yangilik", `«${item.title}» ${item.status === "PUBLISHED" ? "e’lon qilindi" : "qoralama sifatida saqlandi"}`)
    save()
    return delay(item)
  },

  async deleteNews(id) {
    requireAdmin()
    const db = load()
    const n = db.news.find((x) => x.id === id) ?? fail("Yangilik topilmadi.")
    db.news = db.news.filter((x) => x.id !== id)
    audit(db, "Yangilik", `«${n.title}» o‘chirildi`)
    save()
    return delay(undefined)
  },

  async saveSponsor(id, input) {
    requireAdmin()
    const db = load()
    if (input.name.trim().length < 2) fail("Homiy nomini kiriting.")
    if (input.url && !/^https?:\/\/[^\s]+\.[^\s]+/.test(input.url)) fail("Havola https:// bilan boshlanadigan to‘liq manzil bo‘lsin.")
    let item = id ? db.sponsors.find((s) => s.id === id) : undefined
    if (id && !item) fail("Homiy topilmadi.")
    if (!item) {
      item = { id: newId("sp"), ...input, name: input.name.trim() }
      db.sponsors.push(item)
    } else Object.assign(item, { ...input, name: input.name.trim() })
    audit(db, "Homiy", `«${item.name}» saqlandi`)
    save()
    return delay(item)
  },

  async deleteSponsor(id) {
    requireAdmin()
    const db = load()
    const s = db.sponsors.find((x) => x.id === id) ?? fail("Homiy topilmadi.")
    db.sponsors = db.sponsors.filter((x) => x.id !== id)
    audit(db, "Homiy", `«${s.name}» o‘chirildi`)
    save()
    return delay(undefined)
  },

  async addAdjustment(seasonId, input) {
    requireAdmin()
    const db = load()
    requireEditable(db, seasonId)
    if (!Number.isInteger(input.points) || input.points === 0) fail("Ochko butun son bo‘lsin va 0 ga teng bo‘lmasin.")
    if (input.reason.trim().length < 5) fail("Sababini batafsilroq yozing.")
    db.adjustments.push({ id: newId("adj"), seasonId, seasonTeamId: input.seasonTeamId, points: input.points, reason: input.reason.trim(), createdAt: new Date().toISOString() })
    audit(db, "Ochko", `${stName(db, input.seasonTeamId)}: ${input.points > 0 ? "+" : ""}${input.points} ochko (${input.reason.trim()})`)
    syncPlayoff(db, seasonId)
    save()
    return delay(undefined)
  },

  async deleteAdjustment(id) {
    requireAdmin()
    const db = load()
    const a = db.adjustments.find((x) => x.id === id) ?? fail("Yozuv topilmadi.")
    requireEditable(db, a.seasonId)
    db.adjustments = db.adjustments.filter((x) => x.id !== id)
    audit(db, "Ochko", `${stName(db, a.seasonTeamId)} uchun ochko o‘zgarishi bekor qilindi`)
    syncPlayoff(db, a.seasonId)
    save()
    return delay(undefined)
  },

  async getReport(seasonId) {
    requireAdmin()
    const db = load()
    const s = season(db, seasonId)
    const matches = seasonMatches(db, seasonId).filter((m) => m.status === "FINISHED")
    const ids = new Set(matches.map((m) => m.id))
    const events = db.events.filter((e) => ids.has(e.matchId))
    const total = (m: Match, side: "home" | "away") => (side === "home" ? (m.homeScore ?? 0) + (m.homeExtra ?? 0) : (m.awayScore ?? 0) + (m.awayExtra ?? 0))
    const goals = matches.reduce((sum, m) => sum + total(m, "home") + total(m, "away"), 0)
    const sts = db.seasonTeams.filter((x) => x.seasonId === seasonId)
    const forAgainst = sts.map((st) => {
      let f = 0
      let a = 0
      for (const m of matches) {
        if (m.homeId === st.id) {
          f += total(m, "home")
          a += total(m, "away")
        } else if (m.awayId === st.id) {
          f += total(m, "away")
          a += total(m, "home")
        }
      }
      return { st, f, a }
    })
    const biggest = [...matches].sort((x, y) => Math.abs(total(y, "home") - total(y, "away")) - Math.abs(total(x, "home") - total(x, "away")))[0] ?? null
    const attack = [...forAgainst].sort((x, y) => y.f - x.f)[0]
    const defence = [...forAgainst].sort((x, y) => x.a - y.a)[0]
    const report: ReportData = {
      season: s,
      matchesFinished: matches.length,
      goals,
      avgGoals: matches.length ? Math.round((goals / matches.length) * 100) / 100 : 0,
      yellow: events.filter((e) => e.type === "YELLOW" || e.type === "SECOND_YELLOW").length,
      red: events.filter((e) => e.type === "RED" || e.type === "SECOND_YELLOW").length,
      biggestWin: biggest,
      bestAttack: attack ? { team: teamView(db, attack.st), goals: attack.f } : null,
      bestDefence: defence ? { team: teamView(db, defence.st), conceded: defence.a } : null,
      teams: sts.map((st) => teamView(db, st)),
    }
    return delay(report)
  },

  async listAudit() {
    requireAdmin()
    return delay(load().audit)
  },

  async updateSettings(settings) {
    requireAdmin()
    const db = load()
    if (!settings.name.trim()) fail("Liga nomini kiriting.")
    const social = (field: SocialField) => {
      try {
        return normalizeSocial(field, settings[field])
      } catch (e) {
        return fail((e as Error).message)
      }
    }
    db.settings = { ...settings, name: settings.name.trim(), telegramChannel: social("telegramChannel"), instagram: social("instagram"), youtube: social("youtube") }
    audit(db, "Sozlamalar", "Liga ma’lumotlari yangilandi")
    save()
    return delay(db.settings)
  },

  async listVenues() {
    requireAdmin()
    return delay([...load().venues].sort((a, b) => a.name.localeCompare(b.name, "uz")))
  },

  async saveVenue(id, input) {
    requireAdmin()
    const db = load()
    if (!input.name.trim()) fail("Maydon nomini kiriting.")
    let venue = id ? db.venues.find((v) => v.id === id) : undefined
    if (id && !venue) fail("Maydon topilmadi.")
    if (!venue) {
      venue = { id: newId("v"), name: input.name.trim(), village: input.village.trim() }
      db.venues.push(venue)
    } else Object.assign(venue, { name: input.name.trim(), village: input.village.trim() })
    audit(db, "Maydon", `«${venue.name}» saqlandi`)
    save()
    return delay(venue)
  },

  async deleteVenue(id) {
    requireAdmin()
    const db = load()
    if (db.matches.some((m) => m.venueId === id)) fail("Bu maydonda o‘yinlar belgilangan, uni o‘chirib bo‘lmaydi.")
    db.venues = db.venues.filter((v) => v.id !== id)
    save()
    return delay(undefined)
  },

  async listRoundTeams(seasonId) {
    requireAdmin()
    const db = load()
    season(db, seasonId)
    return delay((db.roundTeams ?? []).filter((t) => t.seasonId === seasonId).map(({ seasonId: _s, ...t }) => t))
  },

  async saveRoundTeam(seasonId, input) {
    requireAdmin()
    const db = load()
    requireEditable(db, seasonId)
    const round = input.stage === "GROUP" ? (input.round ?? null) : null
    const playoffRound = input.stage === "PLAYOFF" ? (input.playoffRound ?? null) : null
    if (input.stage === "GROUP" && !round) fail("Turni tanlang.")
    if (input.stage === "PLAYOFF" && !playoffRound) fail("Pley-off bosqichini tanlang.")
    const title = input.stage === "GROUP" ? `${round}-tur` : ROUND_LABELS[playoffRound!]
    const list = seasonMatches(db, seasonId).filter((m) => m.stage === input.stage && (input.stage === "GROUP" ? m.round === round : m.playoffRound === playoffRound) && m.status !== "CANCELLED")
    if (list.length === 0) fail(`${title} o‘yinlari topilmadi.`)
    if (list.some((m) => m.status !== "FINISHED")) fail(`${title} hali tugamagan — ramziy jamoa barcha o‘yinlar yakunlangach tanlanadi.`)
    const teamOf = new Map(db.rosters.filter((r) => r.seasonId === seasonId).map((r) => [r.playerId, r.seasonTeamId]))
    const keys = ["GK", "DF", "MF_L", "MF_R", "FW"]
    const usedSlots = new Set<string>()
    const usedPlayers = new Set<string>()
    const slots = input.slots.map((s) => {
      if (!keys.includes(s.slot)) fail(`Noma’lum o‘rin: ${s.slot}.`)
      if (usedSlots.has(s.slot)) fail("Bir o‘ringa ikki futbolchi qo‘yib bo‘lmaydi.")
      if (usedPlayers.has(s.playerId)) fail("Bir futbolchi ramziy jamoada faqat bir marta bo‘ladi.")
      usedSlots.add(s.slot)
      usedPlayers.add(s.playerId)
      const seasonTeamId = teamOf.get(s.playerId) ?? fail("Tanlangan futbolchi bu mavsumda biror jamoa tarkibida emas.")
      return { slot: s.slot, playerId: s.playerId, seasonTeamId }
    })
    if (input.publish && slots.length !== keys.length) fail(`E’lon qilish uchun 5 ta o‘rinning hammasiga futbolchi qo‘ying (hozir ${slots.length} ta).`)
    slots.sort((a, b) => keys.indexOf(a.slot) - keys.indexOf(b.slot))
    db.roundTeams = db.roundTeams ?? []
    let t = db.roundTeams.find((x) => x.seasonId === seasonId && x.stage === input.stage && x.round === round && x.playoffRound === playoffRound)
    const wasPublished = Boolean(t?.published)
    if (!t) {
      t = { id: newId("rt"), seasonId, stage: input.stage, round, playoffRound, published: false, publishedAt: null, slots: [] }
      db.roundTeams.push(t)
    }
    t.slots = slots
    t.published = input.publish
    t.publishedAt = input.publish ? (wasPublished ? t.publishedAt : new Date().toISOString()) : null
    audit(db, "Ramziy jamoa", `${title} ramziy jamoasi ${t.published ? (wasPublished ? "yangilandi" : "e’lon qilindi") : "qoralama sifatida saqlandi"}`)
    save()
    const { seasonId: _s, ...result } = t
    return delay(result)
  },

  async deleteRoundTeam(id) {
    requireAdmin()
    const db = load()
    const t = (db.roundTeams ?? []).find((x) => x.id === id) ?? fail("Ramziy jamoa topilmadi.")
    requireEditable(db, t.seasonId)
    db.roundTeams = (db.roundTeams ?? []).filter((x) => x.id !== id)
    audit(db, "Ramziy jamoa", "Ramziy jamoa o‘chirildi")
    save()
    return delay(undefined)
  },

  async setPlayerPhoto(playerId, photoUrl) {
    requireAdmin()
    const db = load()
    const p = db.players.find((x) => x.id === playerId) ?? fail("Futbolchi topilmadi.")
    p.photoUrl = photoUrl || null
    audit(db, "Futbolchi", `${p.firstName} ${p.lastName} ${photoUrl ? "rasmi yangilandi" : "rasmi olib tashlandi"}`)
    save()
    return delay(undefined)
  },

  async uploadMedia(file) {
    requireAdmin()
    // Namunaviy rejimda rasm brauzer xotirasida data URL sifatida saqlanadi
    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new ApiError("Rasmni o‘qib bo‘lmadi."))
      reader.readAsDataURL(file)
    })
    return delay({ url })
  },

  async resetDemoData() {
    requireAdmin()
    cache = createSeed()
    save()
    return delay(undefined)
  },
}

// ---------- Validatsiya yordamchilari ----------

function trimTeam(input: TeamInput) {
  return {
    name: input.name.trim(),
    shortName: input.shortName.trim().toUpperCase(),
    village: input.village.trim(),
    primaryColor: input.primaryColor,
    secondaryColor: input.secondaryColor,
    logoUrl: input.logoUrl ?? null,
  }
}

function validateTeam(db: LeagueDb, input: TeamInput, exceptId?: ID) {
  const name = input.name.trim()
  if (name.length < 2) fail("Jamoa nomi kamida 2 ta harfdan iborat bo‘lsin.")
  if (!/^[A-Za-zА-Яа-яЎўҚқҒғҲҳ‘’ʻ']{2,4}$/.test(input.shortName.trim())) fail("Qisqa nom 2–4 ta harfdan iborat bo‘lsin, masalan NAV.")
  if (!input.village.trim()) fail("Qishloq nomini kiriting.")
  if (db.teams.some((t) => t.id !== exceptId && t.name.toLowerCase() === name.toLowerCase())) fail(`«${name}» nomli jamoa allaqachon bor.`)
}

function validatePlayer(input: PlayerInput) {
  if (input.firstName.trim().length < 2) fail("Futbolchi ismini kiriting.")
  if (input.lastName.trim().length < 2) fail("Futbolchi familiyasini kiriting.")
  if (input.birthYear != null && (input.birthYear < 1950 || input.birthYear > new Date().getFullYear() - 10)) fail("Tug‘ilgan yilni to‘g‘ri kiriting.")
  if (input.number != null && (!Number.isInteger(input.number) || input.number < 1 || input.number > 99)) fail("Raqam 1 dan 99 gacha bo‘lsin.")
  if (input.phone && !/^\+?[0-9\s()-]{7,20}$/.test(input.phone.trim())) fail("Telefon raqamini +998 90 123 45 67 ko‘rinishida kiriting.")
}

function assertNumberFree(db: LeagueDb, seasonId: ID, seasonTeamId: ID, number: number | null, playerId: ID) {
  if (number == null) return
  const taken = db.rosters.find((r) => r.seasonId === seasonId && r.seasonTeamId === seasonTeamId && r.number === number && r.playerId !== playerId)
  if (taken) fail(`${number}-raqam bu jamoada ${playerName(db, taken.playerId)}ga tegishli. Boshqa raqam tanlang.`)
}

function finishPreview(db: LeagueDb, seasonId: ID): FinishSeasonPreview {
  const s = season(db, seasonId)
  const matches = seasonMatches(db, seasonId)
  const problems: string[] = []
  if (s.status === "FINISHED") problems.push("Bu mavsum allaqachon yakunlangan.")
  const open = matches.filter((m) => m.status === "SCHEDULED" || m.status === "LIVE" || m.status === "POSTPONED").length
  if (open > 0) problems.push(`${open} ta o‘yin hali yakunlanmagan.`)
  const final = matches.find((m) => m.playoffRound === "F")
  const third = matches.find((m) => m.playoffRound === "THIRD")
  let champion: TeamView | null = null
  let runnerUp: TeamView | null = null
  let thirdPlace: TeamView | null = null
  const view = (id: ID | null | undefined) => {
    const st = id ? db.seasonTeams.find((x) => x.id === id) : undefined
    return st ? teamView(db, st) : null
  }
  if (final) {
    if (final.status !== "FINISHED") problems.push("Final o‘yini hali o‘tkazilmagan.")
    champion = view(final.winnerId)
    runnerUp = view(final.winnerId === final.homeId ? final.awayId : final.homeId)
    thirdPlace = third?.status === "FINISHED" ? view(third.winnerId) : null
  } else {
    const groups = db.groups.filter((g) => g.seasonId === seasonId)
    if (groups.length === 1) {
      const table = groupStandings(db, seasonId)[groups[0].id]
      champion = view(table[0]?.seasonTeamId)
      runnerUp = view(table[1]?.seasonTeamId)
      thirdPlace = view(table[2]?.seasonTeamId)
    } else problems.push("Chempionni aniqlash uchun pley-off finali kerak.")
  }
  const ids = new Set(matches.map((m) => m.id))
  const discipline = computeTeamDiscipline(
    db.seasonTeams.filter((x) => x.seasonId === seasonId).map((x) => x.id),
    matches,
    db.events.filter((e) => ids.has(e.matchId)),
  )
  return {
    canFinish: problems.length === 0,
    problems,
    champion,
    runnerUp,
    third: thirdPlace,
    topScorer: seasonTopScorer(db, seasonId),
    fairPlay: view(discipline[0]?.seasonTeamId),
  }
}
