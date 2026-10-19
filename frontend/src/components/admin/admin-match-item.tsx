import type { ReactNode } from "react"
import type { TeamView } from "@/api/types"
import { LiveDot } from "@/components/league/icons"
import { LiveLabel } from "@/components/league/live-label"
import { TeamCrest } from "@/components/league/team-crest"
import type { Match } from "@/domain/types"
import { formatShortDate, formatTime, MATCH_STATUS_LABEL } from "@/lib/format"
import { UNCONFIRMED_DATE } from "@/lib/playoff-overview"
import { totalScore } from "@/lib/match"
import { cn } from "@/lib/utils"

const STATUS_STYLE: Record<Match["status"], string> = {
  SCHEDULED: "bg-muted text-muted-foreground",
  LIVE: "bg-live/10 text-live",
  FINISHED: "bg-qualify-soft text-win",
  POSTPONED: "bg-gold-soft text-gold-text",
  CANCELLED: "bg-destructive/10 text-destructive",
}

export function StatusPill({ match }: { match: Match }) {
  const status = match.status
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold whitespace-nowrap", STATUS_STYLE[status])}>
      {status === "LIVE" && <LiveDot />}
      {status === "LIVE" ? <LiveLabel match={match} fallback={MATCH_STATUS_LABEL.LIVE} /> : MATCH_STATUS_LABEL[status]}
    </span>
  )
}

/** Admin ro'yxatlaridagi o'yin qatori: sana, jamoalar, hisob va amal tugmasi */
export function AdminMatchItem({
  match,
  team,
  meta,
  action,
}: {
  match: Match
  team: (id: string | null | undefined) => TeamView | undefined
  meta?: string
  action?: ReactNode
}) {
  const score = totalScore(match)
  const home = team(match.homeId)
  const away = team(match.awayId)
  return (
    <div
      data-testid="admin-match"
      data-status={match.status}
      data-home-name={home?.name ?? ""}
      className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:gap-4 md:px-4"
    >
      <div className="flex items-center gap-3 sm:w-28 sm:flex-col sm:items-start sm:gap-0.5">
        {match.timeConfirmed === false ? (
          <span className="text-xs font-semibold text-gold-text">{UNCONFIRMED_DATE}</span>
        ) : (
          <>
            <span className="font-score text-md">{formatTime(match.kickoff)}</span>
            <span className="text-xs text-muted-foreground">{formatShortDate(match.kickoff)}</span>
          </>
        )}
        <span className="ml-auto sm:hidden">
          <StatusPill match={match} />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <TeamCrest team={home} size="xs" />
          <span className="min-w-0 flex-1 truncate font-medium">{home?.name ?? match.homeLabel ?? "Aniqlanmagan"}</span>
          <span className="w-6 text-right font-score text-md">{score?.home ?? ""}</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <TeamCrest team={away} size="xs" />
          <span className="min-w-0 flex-1 truncate font-medium">{away?.name ?? match.awayLabel ?? "Aniqlanmagan"}</span>
          <span className="w-6 text-right font-score text-md">{score?.away ?? ""}</span>
        </div>
        {meta && <p className="mt-1 truncate text-xs text-muted-foreground">{meta}</p>}
      </div>
      <div className="hidden w-32 sm:block">
        <StatusPill match={match} />
      </div>
      {action && <div className="flex gap-2 sm:justify-end [&>*]:flex-1 sm:[&>*]:flex-none">{action}</div>}
    </div>
  )
}
