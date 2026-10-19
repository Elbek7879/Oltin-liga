import { Link } from "react-router"
import type { Match } from "@/domain/types"
import type { SeasonIndex } from "@/hooks/use-season-data"
import { formatShortDate, formatTime, MATCH_STATUS_LABEL, weekdayShort } from "@/lib/format"
import { UNCONFIRMED_DATE } from "@/lib/playoff-overview"
import { matchAriaLabel, scoreNote, sideName, stageLabel, totalScore, winnerSide } from "@/lib/match"
import { cn } from "@/lib/utils"
import { LiveDot } from "./icons"
import { LiveLabel } from "./live-label"
import { TeamCrest } from "./team-crest"

export function MatchStatusCell({ match, showDate }: { match: Match; showDate?: boolean }) {
  if (match.status === "LIVE") {
    return (
      <span className="flex items-center gap-1.5 text-sm font-semibold text-live">
        <LiveDot />
        <LiveLabel match={match} fallback="Jonli" />
      </span>
    )
  }
  const date = showDate ? (
    <span className="block text-2xs leading-4 text-muted-foreground">
      <span className="hidden sm:inline">{weekdayShort(match.kickoff)}, </span>
      {formatShortDate(match.kickoff)}
    </span>
  ) : null
  if (match.status === "FINISHED") {
    return (
      <span className="block leading-tight">
        {date}
        <span className="text-xs text-muted-foreground">Tugadi</span>
      </span>
    )
  }
  if (match.status === "POSTPONED" || match.status === "CANCELLED") {
    return (
      <span className="block leading-tight">
        {date}
        <span className="text-xs font-medium text-loss">{match.status === "POSTPONED" ? "Qoldirildi" : "Bekor"}</span>
      </span>
    )
  }
  if (match.timeConfirmed === false) return <span className="block text-xs leading-tight font-semibold text-muted-foreground">{UNCONFIRMED_DATE}</span>
  return (
    <span className="block leading-tight">
      {date}
      <span className="font-score text-md">{formatTime(match.kickoff)}</span>
    </span>
  )
}

function TeamCell({ match, side, index, align }: { match: Match; side: "home" | "away"; index?: SeasonIndex; align: "start" | "end" }) {
  const team = index?.team(side === "home" ? match.homeId : match.awayId)
  const winner = winnerSide(match)
  const lost = winner != null && winner !== side
  return (
    <span className={cn("flex min-w-0 items-center gap-2", align === "end" && "sm:flex-row-reverse sm:text-right")}>
      <TeamCrest team={team} size="sm" />
      <span className={cn("truncate", winner === side ? "font-semibold" : lost ? "text-muted-foreground" : "font-medium", !team && "italic text-muted-foreground")}>
        {sideName(match, side, index)}
      </span>
    </span>
  )
}

/**
 * O'yin qatori. Telefonda jamoalar ikki qatorda (tablo kabi), kompyuterda bitta
 * qatorda: uy jamoasi — hisob — mehmon jamoa.
 */
export function MatchRow({
  match,
  index,
  showDate,
  showStage,
  className,
}: {
  match: Match
  index?: SeasonIndex
  showDate?: boolean
  showStage?: boolean
  className?: string
}) {
  const score = totalScore(match)
  const winner = winnerSide(match)
  const note = scoreNote(match)
  const live = match.status === "LIVE"
  return (
    <Link
      to={`/oyinlar/${match.id}`}
      aria-label={`${matchAriaLabel(match, index)}. ${MATCH_STATUS_LABEL[match.status]}`}
      className={cn(
        "group grid min-h-14 grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-3 py-2.5 transition-colors hover:bg-row-hover focus-visible:bg-row-hover sm:grid-cols-[4rem_minmax(0,1fr)_5.5rem_minmax(0,1fr)] sm:py-3 md:px-4",
        showStage && "lg:grid-cols-[4rem_minmax(0,1fr)_5.5rem_minmax(0,1fr)_9rem]",
        className,
      )}
    >
      <span aria-hidden="true" className="col-start-1 row-span-2 row-start-1 sm:row-span-1">
        <MatchStatusCell match={match} showDate={showDate} />
      </span>
      <span aria-hidden="true" className="col-start-2 row-start-1 min-w-0">
        <TeamCell match={match} side="home" index={index} align="end" />
      </span>
      <span
        aria-hidden="true"
        className={cn("col-start-3 row-start-1 min-w-5 text-right font-score text-lg sm:hidden", live && "text-live", winner === "away" && "text-muted-foreground")}
      >
        {score?.home ?? ""}
      </span>
      <span aria-hidden="true" className="col-start-2 row-start-2 min-w-0 sm:col-start-4 sm:row-start-1">
        <TeamCell match={match} side="away" index={index} align="start" />
      </span>
      <span
        aria-hidden="true"
        className={cn("col-start-3 row-start-2 min-w-5 text-right font-score text-lg sm:hidden", live && "text-live", winner === "home" && "text-muted-foreground")}
      >
        {score?.away ?? ""}
      </span>
      <span aria-hidden="true" className="hidden flex-col items-center sm:col-start-3 sm:row-start-1 sm:flex">
        {score ? (
          <span
            className={cn(
              "rounded-md px-2.5 py-0.5 font-score text-xl tracking-wide",
              live ? "bg-live/10 text-live" : "bg-muted text-foreground",
            )}
          >
            {score.home} : {score.away}
          </span>
        ) : (
          <span className="rounded-md border border-dashed border-border px-2.5 py-0.5 font-score text-md text-muted-foreground">
            – : –
          </span>
        )}
        {note && <span className="mt-0.5 text-2xs leading-4 text-muted-foreground">{note}</span>}
      </span>
      {note && (
        <span aria-hidden="true" className="col-start-2 col-end-4 row-start-3 text-2xs text-muted-foreground sm:hidden">
          {note}
        </span>
      )}
      {showStage && (
        <span aria-hidden="true" className="hidden truncate text-right text-xs text-muted-foreground lg:col-start-5 lg:row-start-1 lg:block">
          {stageLabel(match, index)}
        </span>
      )}
    </Link>
  )
}
