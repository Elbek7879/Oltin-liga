import { useQueryClient } from "@tanstack/react-query"
import { createElement, useEffect, useRef } from "react"
import { useNavigate } from "react-router"
import { toast } from "sonner"
import { IS_DEMO_MODE } from "@/api/client"
import { qk, seasonBundleQuery } from "@/api/hooks"
import type { SeasonBundle } from "@/api/types"
import { BallIcon } from "@/components/league/icons"
import { totalScore } from "@/lib/match"

interface LiveMessage {
  seasonId: string
  matchId: string
  kind: "START" | "GOAL" | "FINISH" | "UPDATE"
  side: "home" | "away" | ""
}

const GOAL_TYPES = new Set(["GOAL", "PENALTY_GOAL", "OWN_GOAL"])
/** Gol paytida yuzlab muxlis bir soniyada so'rov yubormasligi uchun yangilash biroz yoyiladi */
const MAX_JITTER_MS = 1500
/** Ulanish butunlay uzilsa (masalan, sayt yangilanayotganda server 502 qaytarsa) — qayta ulanish oralig'i */
const RECONNECT_MS = [3_000, 10_000, 30_000, 60_000]

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Gol haqida qisqa xabar: kim urdi va hisob (ma'lumot yangilangandan keyin) */
function goalToast(bundle: SeasonBundle, msg: LiveMessage, open: () => void) {
  const m = bundle.matches.find((x) => x.id === msg.matchId)
  if (!m) return
  const team = (id: string | null) => bundle.teams.find((t) => t.id === id)?.name ?? "Aniqlanmagan"
  const scoringTeam = msg.side === "home" ? m.homeId : m.awayId
  const goals = bundle.events
    .filter((e) => e.matchId === m.id && GOAL_TYPES.has(e.type))
    .filter((e) => (e.type === "OWN_GOAL" ? e.seasonTeamId !== scoringTeam : e.seasonTeamId === scoringTeam))
    .sort((a, b) => (b.minute ?? 0) - (a.minute ?? 0))
  const last = goals[0]
  const player = last?.playerId ? bundle.players.find((p) => p.id === last.playerId) : undefined
  const scorer = player ? `${player.firstName} ${player.lastName}${last?.minute ? ` ${last.minute}′` : ""}${last?.type === "OWN_GOAL" ? " (avtogol)" : ""}` : null
  const t = totalScore(m)
  toast(`GOL! ${team(scoringTeam)}${scorer ? ` — ${scorer}` : ""}`, {
    description: t ? `${team(m.homeId)} ${t.home} : ${t.away} ${team(m.awayId)}` : undefined,
    icon: createElement(BallIcon, { className: "size-4" }),
    duration: 8000,
    action: { label: "Ko‘rish", onClick: open },
  })
}

/**
 * Jonli yangilanishlar: server gol yoki natija saqlanishi bilan xabar yuboradi, sahifa ma'lumotni darhol qayta oladi.
 * Tarmoq uzilsa, brauzer o'zi qayta ulanadi; server xato bilan javob bersa (ulanish yopiladi) — biz qayta ulaymiz
 * va o'tkazib yuborilgan o'zgarishlar uchun ma'lumotni yangilaymiz. toasts — muxlislar uchun «GOL!» xabari.
 */
export function useLiveUpdates({ toasts }: { toasts: boolean }) {
  const client = useQueryClient()
  const navigate = useNavigate()
  // Sahifa almashganda ulanish qayta ochilmasligi uchun navigate ref orqali
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  useEffect(() => {
    if (IS_DEMO_MODE || typeof EventSource === "undefined") return
    let source: EventSource | null = null
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let attempt = 0
    let interrupted = false
    let disposed = false

    const refreshAll = () => {
      void client.invalidateQueries({ queryKey: ["season-bundle"] })
      void client.invalidateQueries({ queryKey: ["team"] })
      void client.invalidateQueries({ queryKey: ["player"] })
      void client.invalidateQueries({ queryKey: ["admin"] })
    }

    const onMatch = async (e: Event) => {
      let msg: LiveMessage
      try {
        msg = JSON.parse((e as MessageEvent<string>).data) as LiveMessage
      } catch {
        return
      }
      // Muxlislar sahifasi so'rovlarni biroz yoyadi; admin paneli darhol yangilanadi
      if (toasts) await sleep(Math.random() * MAX_JITTER_MS)
      if (disposed) return
      await client.invalidateQueries({ queryKey: qk.bundle(msg.seasonId) })
      // Jamoa va futbolchi sahifalaridagi o'yinlar ro'yxati ham eski hisobni ko'rsatmasin
      void client.invalidateQueries({ queryKey: ["team"] })
      void client.invalidateQueries({ queryKey: ["player"] })
      void client.invalidateQueries({ queryKey: ["admin"] })
      if (toasts && msg.kind === "GOAL") {
        // Mavsum ma'lumoti ochiq bo'lmagan sahifada ham (yangiliklar, arxiv) xabar eng so'nggi hisob bilan chiqadi
        const bundle = await client.fetchQuery({ ...seasonBundleQuery(msg.seasonId), staleTime: 2_000 }).catch(() => undefined)
        if (bundle && !disposed) goalToast(bundle, msg, () => navigateRef.current(`/oyinlar/${msg.matchId}`))
      }
    }

    const connect = () => {
      source = new EventSource("/api/public/live")
      source.addEventListener("match", onMatch)
      source.onopen = () => {
        // Qayta ulangan bo'lsak — uzilish paytidagi o'zgarishlar olinadi
        if (interrupted) refreshAll()
        interrupted = false
        attempt = 0
      }
      source.onerror = () => {
        interrupted = true
        // Tarmoq uzilishida brauzer o'zi qayta ulanadi (CONNECTING); server xatosida ulanish yopiladi — o'zimiz ulaymiz
        if (disposed || source?.readyState !== EventSource.CLOSED) return
        source.removeEventListener("match", onMatch)
        source.close()
        const delay = RECONNECT_MS[Math.min(attempt, RECONNECT_MS.length - 1)]
        attempt++
        retryTimer = setTimeout(connect, delay)
      }
    }
    connect()

    return () => {
      disposed = true
      clearTimeout(retryTimer)
      if (source) {
        source.removeEventListener("match", onMatch)
        source.close()
      }
    }
  }, [client, toasts])
}
