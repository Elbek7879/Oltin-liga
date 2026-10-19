import type { Match } from "@/domain/types"

export const DEFAULT_HALF_MINUTES = 25
const MAX_MINUTE = 130

/**
 * Jonli o'yin daqiqasi (backenddagi LiveClock bilan bir xil): o'yin Telegram botdan boshqarilsa,
 * bo'lim boshlangan vaqtdan hisoblanadi va saytda o'zi yurib turadi; aks holda saqlangan daqiqa.
 */
export function liveMinute(match: Pick<Match, "livePeriod" | "periodStartedAt" | "liveMinute">, halfMinutes = DEFAULT_HALF_MINUTES, now = Date.now()): number | null {
  const period = match.livePeriod
  if (!period || !match.periodStartedAt) return match.liveMinute ?? null
  const elapsed = Math.max(0, Math.floor((now - Date.parse(match.periodStartedAt)) / 60_000))
  const minute =
    period === "FIRST_HALF"
      ? 1 + elapsed
      : period === "HALF_TIME"
        ? halfMinutes
        : period === "SECOND_HALF"
          ? halfMinutes + 1 + elapsed
          : period === "EXTRA_TIME"
            ? 2 * halfMinutes + 1 + elapsed
            : 2 * halfMinutes
  return Math.max(1, Math.min(MAX_MINUTE, minute))
}

/** «34′», «Tanaffus», «Penaltilar» yoki null (daqiqa noma'lum) */
export function liveLabel(match: Pick<Match, "livePeriod" | "periodStartedAt" | "liveMinute">, halfMinutes?: number, now?: number): string | null {
  if (match.livePeriod === "HALF_TIME") return "Tanaffus"
  if (match.livePeriod === "PENALTIES") return "Penaltilar"
  const m = liveMinute(match, halfMinutes, now)
  return m == null ? null : `${m}′`
}
