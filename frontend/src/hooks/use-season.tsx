import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { seasonBundleQuery, useSeasonList } from "@/api/hooks"
import type { ID, Season } from "@/domain/types"

interface SeasonState {
  seasons: Season[]
  season: Season | undefined
  seasonId: ID | undefined
  /** Joriy (faol) mavsum */
  current: Season | undefined
  isArchive: boolean
  isLoading: boolean
  /** persist: false — tanlov brauzerda saqlanmaydi (masalan, eski mavsum o'yiniga havola ochilganda) */
  setSeasonId: (id: ID, options?: { persist?: boolean }) => void
}

const SeasonContext = createContext<SeasonState | null>(null)
const KEY = "pol-season"

function readInitial(): string | null {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("mavsum")
    return fromUrl ?? localStorage.getItem(KEY)
  } catch {
    return null
  }
}

/**
 * admin: admin paneli uchun ro'yxat (sinov mavsumlari bilan). enabled=false bo'lsa (hali kirilmagan),
 * ro'yxat so'ralmaydi va yuklanmoqda deb hisoblanadi.
 */
export function SeasonProvider({ children, admin = false, enabled = true }: { children: ReactNode; admin?: boolean; enabled?: boolean }) {
  const query = useSeasonList(admin, enabled)
  const { data: seasons = [] } = query
  const isLoading = admin ? query.isPending : query.isLoading
  const [selected, setSelected] = useState<string | null>(readInitial)
  const client = useQueryClient()

  const current = useMemo(() => seasons.find((s) => s.status === "ACTIVE") ?? seasons[0], [seasons])
  const season = useMemo(
    () => seasons.find((s) => s.id === selected || String(s.year) === selected) ?? current,
    [seasons, selected, current],
  )

  // Mavsum aniqlanishi bilan uning ma'lumotlari so'raladi — sahifa kodi yuklanishini kutmaydi (tezroq LCP)
  const seasonId = season?.id
  useEffect(() => {
    if (seasonId && !window.location.pathname.startsWith("/admin/kirish")) void client.prefetchQuery(seasonBundleQuery(seasonId))
  }, [client, seasonId])

  useEffect(() => {
    if (!selected || seasons.length === 0) return
    if (!seasons.some((s) => s.id === selected || String(s.year) === selected)) setSelected(null)
  }, [seasons, selected])

  const setSeasonId = useCallback((id: ID, options?: { persist?: boolean }) => {
    setSelected(id)
    if (options?.persist === false) return
    try {
      localStorage.setItem(KEY, id)
    } catch {
      // Tanlov faqat shu sessiyada saqlanadi
    }
  }, [])

  const value = useMemo<SeasonState>(
    () => ({
      seasons,
      season,
      seasonId: season?.id,
      current,
      isArchive: Boolean(season && current && season.id !== current.id),
      isLoading,
      setSeasonId,
    }),
    [seasons, season, current, isLoading, setSeasonId],
  )
  return <SeasonContext.Provider value={value}>{children}</SeasonContext.Provider>
}

export function useSeason() {
  const ctx = useContext(SeasonContext)
  if (!ctx) throw new Error("useSeason SeasonProvider ichida ishlatilishi kerak")
  return ctx
}
