import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { ID } from "@/domain/types"
import { api } from "./client"

export const qk = {
  settings: ["settings"] as const,
  seasons: ["seasons"] as const,
  bundle: (seasonId: ID) => ["season-bundle", seasonId] as const,
  archive: ["archive"] as const,
  team: (teamId: ID) => ["team", teamId] as const,
  player: (playerId: ID) => ["player", playerId] as const,
  h2h: (a: ID, b: ID) => ["h2h", a, b] as const,
  news: (drafts: boolean) => ["news", drafts] as const,
  newsItem: (slug: string) => ["news-item", slug] as const,
  sponsors: (all: boolean) => ["sponsors", all] as const,
  me: ["me"] as const,
  telegram: ["telegram-status"] as const,
  dashboard: (seasonId: ID) => ["admin", "dashboard", seasonId] as const,
  adminTeams: (seasonId: ID) => ["admin", "teams", seasonId] as const,
  adminPlayers: (seasonId: ID) => ["admin", "players", seasonId] as const,
  finishPreview: (seasonId: ID) => ["admin", "finish-preview", seasonId] as const,
  report: (seasonId: ID) => ["admin", "report", seasonId] as const,
  audit: ["admin", "audit"] as const,
  venues: ["admin", "venues"] as const,
  users: ["admin", "users"] as const,
}

export const useSettings = () => useQuery({ queryKey: qk.settings, queryFn: api.getSettings, staleTime: 5 * 60_000 })
export const useSeasons = () => useQuery({ queryKey: qk.seasons, queryFn: api.listSeasons, staleTime: 60_000 })

/** Mavsum ma'lumotlari so'rovi — sahifa kodi yuklanishini kutmasdan oldindan boshlash uchun ham ishlatiladi */
export const seasonBundleQuery = (seasonId: ID) => ({ queryKey: qk.bundle(seasonId), queryFn: () => api.getSeasonBundle(seasonId) })

/** Mavsumning barcha ommaviy ma'lumotlari. Jonli o'yin bo'lsa, har 60 soniyada yangilanadi. */
export const useSeasonBundle = (seasonId: ID | undefined) =>
  useQuery({
    ...seasonBundleQuery(seasonId ?? ""),
    enabled: Boolean(seasonId),
    placeholderData: keepPreviousData,
    refetchInterval: (q) => (q.state.data?.matches.some((m) => m.status === "LIVE") ? 60_000 : false),
  })

export const useArchive = () => useQuery({ queryKey: qk.archive, queryFn: api.getArchive })
export const useTeamProfile = (teamId: ID) => useQuery({ queryKey: qk.team(teamId), queryFn: () => api.getTeamProfile(teamId) })
export const usePlayerProfile = (playerId: ID) => useQuery({ queryKey: qk.player(playerId), queryFn: () => api.getPlayerProfile(playerId) })
export const useHeadToHead = (a: ID | undefined, b: ID | undefined) =>
  useQuery({ queryKey: qk.h2h(a ?? "", b ?? ""), queryFn: () => api.getHeadToHead(a!, b!), enabled: Boolean(a && b) })
export const newsQuery = (includeDrafts = false) => ({ queryKey: qk.news(includeDrafts), queryFn: () => api.listNews({ includeDrafts }) })
export const useNews = (includeDrafts = false) => useQuery(newsQuery(includeDrafts))
export const useNewsItem = (slug: string) => useQuery({ queryKey: qk.newsItem(slug), queryFn: () => api.getNews(slug) })
export const useSponsors = (includeInactive = false) =>
  useQuery({ queryKey: qk.sponsors(includeInactive), queryFn: () => api.listSponsors({ includeInactive }) })
export const useMe = () => useQuery({ queryKey: qk.me, queryFn: api.me, staleTime: Infinity })
/** waiting — admin Telegram'da «Start» bosishini kutyapmiz: holat har 3 soniyada tekshiriladi */
export const useTelegramStatus = (waiting: boolean) =>
  useQuery({ queryKey: qk.telegram, queryFn: api.telegramStatus, refetchInterval: waiting ? 3000 : false })

export const useDashboard = (seasonId: ID | undefined) =>
  useQuery({ queryKey: qk.dashboard(seasonId ?? ""), queryFn: () => api.getDashboard(seasonId!), enabled: Boolean(seasonId) })
export const useAdminTeams = (seasonId: ID | undefined) =>
  useQuery({ queryKey: qk.adminTeams(seasonId ?? ""), queryFn: () => api.listTeamsAdmin(seasonId!), enabled: Boolean(seasonId) })
export const useAdminPlayers = (seasonId: ID | undefined) =>
  useQuery({ queryKey: qk.adminPlayers(seasonId ?? ""), queryFn: () => api.listPlayersAdmin(seasonId!), enabled: Boolean(seasonId) })
export const useFinishPreview = (seasonId: ID | undefined, enabled: boolean) =>
  useQuery({ queryKey: qk.finishPreview(seasonId ?? ""), queryFn: () => api.previewFinishSeason(seasonId!), enabled: Boolean(seasonId) && enabled })
export const useReport = (seasonId: ID | undefined) =>
  useQuery({ queryKey: qk.report(seasonId ?? ""), queryFn: () => api.getReport(seasonId!), enabled: Boolean(seasonId) })
export const useAudit = () => useQuery({ queryKey: qk.audit, queryFn: api.listAudit })
export const useVenues = () => useQuery({ queryKey: qk.venues, queryFn: api.listVenues })
export const useUsers = () => useQuery({ queryKey: qk.users, queryFn: api.listUsers })

/**
 * Admin amallari uchun umumiy mutation. Muvaffaqiyatli amaldan keyin barcha
 * ma'lumotlar qayta o'qiladi — jadval va statistika avtomatik yangilanadi.
 */
export function useAdminMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => client.invalidateQueries(),
  })
}
