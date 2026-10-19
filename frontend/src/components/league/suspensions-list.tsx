import { Ban } from "lucide-react"
import { Link } from "react-router"
import { activeSuspensions, SUSPENSION_REASON, YELLOWS_FOR_BAN, type Suspension } from "@/domain/discipline"
import type { SeasonIndex } from "@/hooks/use-season-data"
import { formatShortDate } from "@/lib/format"
import { TeamCrest } from "./team-crest"

/** Diskvalifikatsiyadagi o'yinchilar: kim, nega va qaysi o'yinni o'tkazib yuboradi */
export function SuspensionsList({ index, list }: { index: SeasonIndex; list?: Suspension[] }) {
  const items = list ?? activeSuspensions(index.bundle.matches, index.bundle.events)
  if (items.length === 0) {
    return <p className="px-4 py-3 text-sm text-muted-foreground">Hozir diskvalifikatsiyada o‘yinchi yo‘q.</p>
  }
  return (
    <ul className="divide-y divide-border">
      {items.map((s) => {
        const p = index.player(s.playerId)
        const ban = s.banMatchId ? index.bundle.matches.find((m) => m.id === s.banMatchId) : undefined
        const opponent = ban ? index.team(ban.homeId === s.seasonTeamId ? ban.awayId : ban.homeId) : undefined
        return (
          <li key={`${s.playerId}-${s.fromMatchId}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <Ban className="size-4 shrink-0 text-destructive" aria-hidden="true" />
            <TeamCrest team={index.team(s.seasonTeamId)} size="xs" />
            <span className="min-w-0 flex-1">
              <Link to={`/futbolchilar/${s.playerId}`} className="font-semibold hover:underline">
                {p?.firstName} {p?.lastName}
              </Link>
              <span className="block text-xs text-muted-foreground">
                {SUSPENSION_REASON[s.reason]}.{" "}
                {ban
                  ? `O‘tkazib yuboradi: ${opponent?.name ?? "keyingi o‘yin"}${ban.timeConfirmed === false ? "" : `, ${formatShortDate(ban.kickoff)}`}`
                  : "Jamoaning keyingi o‘yinini o‘tkazib yuboradi"}
              </span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export const SUSPENSION_RULE = `${YELLOWS_FOR_BAN} ta sariq yoki 1 ta qizil kartochka olgan o‘yinchi jamoasining keyingi o‘yinini o‘tkazib yuboradi.`
