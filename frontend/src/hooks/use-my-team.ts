import { useSyncExternalStore } from "react"

/**
 * «Mening jamoam» — muxlis tanlagan jamoa (doimiy jamoa id si, mavsumdan mavsumga o'tadi).
 * Faqat shu brauzerda saqlanadi; hech qayerga yuborilmaydi.
 * "-" — muxlis tanlashdan voz kechgan (bosh sahifadagi taklif boshqa ko'rsatilmaydi).
 */
const KEY = "pol-my-team"
export const MY_TEAM_DISMISSED = "-"
const listeners = new Set<() => void>()

function read(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setMyTeam(teamId: string | null) {
  try {
    if (teamId) localStorage.setItem(KEY, teamId)
    else localStorage.removeItem(KEY)
  } catch {
    // Brauzer xotirasi yopiq (maxfiy rejim) — tanlov faqat shu sahifada saqlanmaydi
  }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (e: StorageEvent) => e.key === KEY && listener()
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

export function useMyTeam() {
  const value = useSyncExternalStore(subscribe, read, () => null)
  return {
    /** Tanlangan jamoa (yo'q bo'lsa null) */
    teamId: value && value !== MY_TEAM_DISMISSED ? value : null,
    dismissed: value === MY_TEAM_DISMISSED,
    setMyTeam,
  }
}
