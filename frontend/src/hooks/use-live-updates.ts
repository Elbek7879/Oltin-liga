import { useQueryClient } from "@tanstack/react-query"
import { createElement, useEffect, useRef } from "react"
import { useNavigate } from "react-router"
import { toast } from "sonner"
import { IS_DEMO_MODE } from "@/api/client"
import { qk } from "@/api/hooks"
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
 * Ulanish uzilsa, brauzer o'zi qayta ulanadi. toasts — muxlislar uchun «GOL!» xabari.
 */
export function useLiveUpdates({ toasts }: { toasts: boolean }) {
  const client = useQueryClient()
  const navigate = useNavigate()
  // Sahifa almashganda ulanish qayta ochilmasligi uchun navigate ref orqali
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  useEffect(() => {
    if (IS_DEMO_MODE || typeof EventSource === "undefined") return
    const source = new EventSource("/api/public/live")
    const onMatch = async (e: Event) => {
      let msg: LiveMessage
      try {
        msg = JSON.parse((e as MessageEvent<string>).data) as LiveMessage
      } catch {
        return
      }
      await client.invalidateQueries({ queryKey: qk.bundle(msg.seasonId) })
      void client.invalidateQueries({ queryKey: ["admin"] })
      if (toasts && msg.kind === "GOAL") {
        const bundle = client.getQueryData<SeasonBundle>(qk.bundle(msg.seasonId))
        if (bundle) goalToast(bundle, msg, () => navigateRef.current(`/oyinlar/${msg.matchId}`))
      }
    }
    source.addEventListener("match", onMatch)
    return () => {
      source.removeEventListener("match", onMatch)
      source.close()
    }
  }, [client, toasts])
}
