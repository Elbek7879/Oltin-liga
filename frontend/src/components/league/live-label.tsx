import { useEffect, useState } from "react"
import type { Match } from "@/domain/types"
import { useSeason } from "@/hooks/use-season"
import { liveLabel } from "@/lib/live"

/**
 * Jonli o'yin daqiqasi: Telegram botdan boshqarilayotgan o'yinda soat saytda o'zi yuradi
 * (har 15 soniyada yangilanadi), tanaffus va penaltilar so'z bilan ko'rsatiladi.
 */
export function LiveLabel({ match, prefix = "", fallback = null }: { match: Match; prefix?: string; fallback?: string | null }) {
  const { season } = useSeason()
  const [now, setNow] = useState(() => Date.now())
  const ticking = match.status === "LIVE" && Boolean(match.periodStartedAt) && match.livePeriod !== "HALF_TIME" && match.livePeriod !== "PENALTIES"

  useEffect(() => {
    if (!ticking) return
    const id = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(id)
  }, [ticking])

  const label = match.status === "LIVE" ? liveLabel(match, season?.rules.halfMinutes, now) : null
  if (!label) return fallback == null ? null : <>{fallback}</>
  return (
    <>
      {prefix}
      {label}
    </>
  )
}
