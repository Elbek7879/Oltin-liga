/*
 * LeagueApi'ning haqiqiy (HTTP) amalga oshirilishi — Spring Boot backend bilan ishlaydi.
 * Sessiya httpOnly cookie'da; o'zgartiruvchi so'rovlar XSRF-TOKEN cookie qiymatini
 * X-XSRF-TOKEN sarlavhasida yuboradi (CSRF himoyasi).
 */
import type { ID } from "@/domain/types"
import { ApiError, type AdminUser, type LeagueApi } from "../types"

type Method = "GET" | "POST" | "PUT" | "DELETE"

const NETWORK_ERROR = "Server bilan aloqa yo‘q. Internet aloqasini tekshirib, qayta urinib ko‘ring."

let unauthorizedHandler: (() => void) | null = null

/** Sessiya tugaganda (401) chaqiriladi — ilova foydalanuvchini kirish sahifasiga qaytaradi */
export function onUnauthorized(handler: () => void) {
  unauthorizedHandler = handler
}

function csrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

/** CSRF cookie hali bo'lmasa, uni olish uchun bitta GET so'rov yuboriladi */
async function ensureCsrf() {
  if (!csrfToken()) await fetch("/api/auth/me", { credentials: "same-origin" }).catch(() => undefined)
}

async function request<T>(method: Method, path: string, body?: unknown, options: { allowUnauthorized?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" }
  let payload: BodyInit | undefined
  if (method !== "GET") {
    await ensureCsrf()
    const token = csrfToken()
    if (token) headers["X-XSRF-TOKEN"] = token
  }
  if (body instanceof FormData) payload = body
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json"
    payload = JSON.stringify(body)
  }

  let res: Response
  try {
    res = await fetch(path, { method, headers, body: payload, credentials: "same-origin" })
  } catch {
    throw new ApiError(NETWORK_ERROR, 0)
  }

  if (res.status === 204) return undefined as T
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  if (!res.ok) {
    if (res.status === 401 && !options.allowUnauthorized) unauthorizedHandler?.()
    const serverMessage = (data as { message?: unknown } | null)?.message
    const message =
      typeof serverMessage === "string" && serverMessage
        ? serverMessage
        : res.status >= 500
          ? "Serverda xato yuz berdi. Birozdan keyin qayta urinib ko‘ring."
          : "So‘rovni bajarib bo‘lmadi."
    throw new ApiError(message, res.status)
  }
  return data as T
}

const enc = encodeURIComponent
const pub = (path: string) => `/api/public${path}`
const adm = (path: string) => `/api/admin${path}`

export const httpApi: LeagueApi = {
  // ---------- Ommaviy ----------
  getSettings: () => request("GET", pub("/settings")),
  listSeasons: () => request("GET", pub("/seasons")),
  getSeasonBundle: (seasonId) => request("GET", pub(`/seasons/${enc(seasonId)}/bundle`)),
  getArchive: () => request("GET", pub("/archive")),
  getTeamProfile: (teamId) => request("GET", pub(`/teams/${enc(teamId)}/profile`)),
  getPlayerProfile: (playerId) => request("GET", pub(`/players/${enc(playerId)}/profile`)),
  getHeadToHead: (a, b) => request("GET", pub(`/head-to-head?teamA=${enc(a)}&teamB=${enc(b)}`)),
  listNews: (options) => request("GET", options?.includeDrafts ? adm("/news") : pub("/news")),
  getNews: (slug) => request("GET", pub(`/news/${enc(slug)}`)),
  listSponsors: (options) => request("GET", options?.includeInactive ? adm("/sponsors") : pub("/sponsors")),

  // ---------- Avtorizatsiya ----------
  async login(username, password) {
    await ensureCsrf()
    return request<AdminUser>("POST", "/api/auth/login", { username, password }, { allowUnauthorized: true })
  },
  logout: () => request("POST", "/api/auth/logout", undefined, { allowUnauthorized: true }),
  async me() {
    const user = await request<AdminUser | undefined>("GET", "/api/auth/me", undefined, { allowUnauthorized: true })
    return user ?? null
  },
  changeOwnPassword: (currentPassword, newPassword) => request("PUT", "/api/auth/password", { currentPassword, newPassword }),
  telegramStatus: () => request("GET", "/api/auth/telegram"),
  telegramLink: () => request("POST", "/api/auth/telegram/link"),
  telegramUnlink: () => request("DELETE", "/api/auth/telegram"),

  // ---------- Foydalanuvchilar ----------
  listUsers: () => request("GET", adm("/users")),
  createUser: (input) => request("POST", adm("/users"), input),
  updateUser: (id, input) => request("PUT", adm(`/users/${enc(id)}`), input),
  resetUserPassword: (id, password) => request("PUT", adm(`/users/${enc(id)}/password`), { password }),

  // ---------- Admin: mavsumlar ----------
  getDashboard: (seasonId) => request("GET", adm(`/seasons/${enc(seasonId)}/dashboard`)),
  createSeason: (input) => request("POST", adm("/seasons"), input),
  updateSeasonRules: (seasonId, rules) => request("PUT", adm(`/seasons/${enc(seasonId)}/rules`), rules),
  activateSeason: (seasonId) => request("POST", adm(`/seasons/${enc(seasonId)}/activate`)),
  previewFinishSeason: (seasonId) => request("GET", adm(`/seasons/${enc(seasonId)}/finish-preview`)),
  finishSeason: (seasonId) => request("POST", adm(`/seasons/${enc(seasonId)}/finish`)),

  // ---------- Admin: jamoalar va futbolchilar ----------
  listTeamsAdmin: (seasonId) => request("GET", adm(`/seasons/${enc(seasonId)}/teams`)),
  createTeam: (input, addToSeasonId) =>
    request("POST", adm(`/teams${addToSeasonId ? `?addToSeasonId=${enc(addToSeasonId)}` : ""}`), input),
  updateTeam: (teamId, input) => request("PUT", adm(`/teams/${enc(teamId)}`), input),
  deleteTeam: (teamId) => request("DELETE", adm(`/teams/${enc(teamId)}`)),
  setTeamInSeason: (teamId, seasonId, inSeason) => request("PUT", adm(`/seasons/${enc(seasonId)}/teams/${enc(teamId)}`), { inSeason }),
  listPlayersAdmin: (seasonId) => request("GET", adm(`/seasons/${enc(seasonId)}/players`)),
  createPlayer: (seasonId, input) => request("POST", adm(`/seasons/${enc(seasonId)}/players`), input),
  createPlayers: (seasonId, input) => request("POST", adm(`/seasons/${enc(seasonId)}/players/bulk`), input),
  updatePlayer: (seasonId, playerId, input) => request("PUT", adm(`/seasons/${enc(seasonId)}/players/${enc(playerId)}`), input),
  deletePlayer: (playerId) => request("DELETE", adm(`/players/${enc(playerId)}`)),

  // ---------- Admin: musobaqa ----------
  saveGroups: (seasonId, groups) => request("PUT", adm(`/seasons/${enc(seasonId)}/groups`), { groups }),
  resetGroups: (seasonId) => request("DELETE", adm(`/seasons/${enc(seasonId)}/groups`)),
  createMatch: (seasonId, input) => request("POST", adm(`/seasons/${enc(seasonId)}/matches`), input),
  updateMatch: (matchId, input) => request("PUT", adm(`/matches/${enc(matchId)}`), input),
  deleteMatch: (matchId) => request("DELETE", adm(`/matches/${enc(matchId)}`)),
  generateFixtures: (seasonId) => request("POST", adm(`/seasons/${enc(seasonId)}/fixtures`)),
  saveResult: (matchId, input) => request("PUT", adm(`/matches/${enc(matchId)}/result`), input),
  createPlayoff: (seasonId, input) => request("POST", adm(`/seasons/${enc(seasonId)}/playoff`), input),
  scheduleMatch: (matchId, input) => request("PUT", adm(`/matches/${enc(matchId)}/schedule`), input),
  drawLot: (seasonId, input) => request("POST", adm(`/seasons/${enc(seasonId)}/lots`), input),
  deleteLot: (seasonId, scope) => request("DELETE", adm(`/seasons/${enc(seasonId)}/lots?scope=${enc(scope)}`)),
  deletePlayoff: (seasonId) => request("DELETE", adm(`/seasons/${enc(seasonId)}/playoff`)),

  // ---------- Admin: kontent va tizim ----------
  saveNews: (id: ID | null, input) => (id ? request("PUT", adm(`/news/${enc(id)}`), input) : request("POST", adm("/news"), input)),
  deleteNews: (id) => request("DELETE", adm(`/news/${enc(id)}`)),
  saveSponsor: (id: ID | null, input) =>
    id ? request("PUT", adm(`/sponsors/${enc(id)}`), input) : request("POST", adm("/sponsors"), input),
  deleteSponsor: (id) => request("DELETE", adm(`/sponsors/${enc(id)}`)),
  addAdjustment: (seasonId, input) => request("POST", adm(`/seasons/${enc(seasonId)}/adjustments`), input),
  deleteAdjustment: (id) => request("DELETE", adm(`/adjustments/${enc(id)}`)),
  getReport: (seasonId) => request("GET", adm(`/seasons/${enc(seasonId)}/report`)),
  listAudit: () => request("GET", adm("/audit")),
  updateSettings: (settings) => request("PUT", adm("/settings"), settings),
  listVenues: () => request("GET", adm("/venues")),
  saveVenue: (id: ID | null, input) => (id ? request("PUT", adm(`/venues/${enc(id)}`), input) : request("POST", adm("/venues"), input)),
  deleteVenue: (id) => request("DELETE", adm(`/venues/${enc(id)}`)),
  listRoundTeams: (seasonId) => request("GET", adm(`/seasons/${enc(seasonId)}/round-teams`)),
  saveRoundTeam: (seasonId, input) => request("PUT", adm(`/seasons/${enc(seasonId)}/round-teams`), input),
  deleteRoundTeam: (id) => request("DELETE", adm(`/round-teams/${enc(id)}`)),
  setPlayerPhoto: (playerId, photoUrl) => request("PUT", adm(`/players/${enc(playerId)}/photo`), { photoUrl }),
  uploadMedia: (file, filename) => {
    const form = new FormData()
    form.append("file", file, filename)
    return request("POST", adm("/media"), form)
  },
  resetDemoData: () => Promise.reject(new ApiError("Bu amal faqat namunaviy rejimda mavjud.")),
}
