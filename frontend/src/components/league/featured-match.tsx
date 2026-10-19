import { CalendarDays, MapPin } from "lucide-react"
import { Link } from "react-router"
import type { Match } from "@/domain/types"
import type { SeasonIndex } from "@/hooks/use-season-data"
import { formatTime, relativeDayLabel } from "@/lib/format"
import { UNCONFIRMED_DATE } from "@/lib/playoff-overview"
import { scoreNote, sideName, stageLabel, totalScore, winnerSide } from "@/lib/match"
import { cn } from "@/lib/utils"
import { useFlash } from "@/hooks/use-flash"
import { LiveDot, PitchLines } from "./icons"
import { LiveLabel } from "./live-label"
import { TeamCrest } from "./team-crest"

function Side({ match, side, index }: { match: Match; side: "home" | "away"; index: SeasonIndex }) {
  const team = index.team(side === "home" ? match.homeId : match.awayId)
  const winner = winnerSide(match)
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col items-center gap-2 text-center", winner && winner !== side && "opacity-70")}>
      <TeamCrest team={team} size="xl" />
      <span className="max-w-full truncate font-display text-base md:text-2xl">{sideName(match, side, index)}</span>
      {team && <span className="-mt-1.5 hidden text-xs text-band-muted sm:block">{team.village}</span>}
    </div>
  )
}

/** Bosh sahifadagi asosiy o'yin: jonli, eng yaqin yoki oxirgi o'yin — maydon chiziqlari fonida */
export function FeaturedMatch({
  match,
  index,
  eyebrow,
  showLink = true,
}: {
  match: Match
  index: SeasonIndex
  eyebrow: string
  showLink?: boolean
}) {
  const score = totalScore(match)
  const live = match.status === "LIVE"
  // Gol urildi — hisob qisqa vaqt yorishadi va «GOL!» belgisi chiqadi
  const goal = useFlash(score ? `${match.id}:${score.home}:${score.away}` : match.id) && live
  const note = scoreNote(match)
  const venue = index.venue(match.venueId)
  return (
    <article className="relative overflow-hidden rounded-2xl border border-white/10 bg-pitch-900/40 px-4 pt-4 pb-5 md:px-8 md:pt-6 md:pb-7">
      <PitchLines className="opacity-90" />
      <div className="relative">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs md:text-sm">
          {live ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-live px-2.5 py-0.5 font-semibold text-white dark:text-pitch-950">
              <LiveDot className="[&>span]:bg-white" />
              Jonli
              <LiveLabel match={match} prefix=", " />
            </span>
          ) : (
            <span className="font-semibold text-gold-400">{eyebrow}</span>
          )}
          {goal && (
            <span role="status" className="goal-badge rounded-full bg-gold-400 px-2.5 py-0.5 font-bold text-pitch-950">
              GOL!
            </span>
          )}
          <span className="text-band-muted">{stageLabel(match, index)}</span>
        </div>

        <div className="mt-4 flex items-start justify-between gap-2 md:mt-6 md:gap-6">
          <Side match={match} side="home" index={index} />
          <div className="flex shrink-0 flex-col items-center pt-3 md:pt-5">
            {score ? (
              <span
                className={cn(
                  "font-score text-4xl leading-none animate-in fade-in slide-in-from-bottom-2 duration-500 md:text-[64px]",
                  live ? "text-white" : "text-gold-400",
                  goal && "goal-flash",
                )}
              >
                {score.home}
                <span className="mx-1.5 text-band-muted md:mx-3">:</span>
                {score.away}
              </span>
            ) : (
              <span className="font-score text-4xl leading-none text-gold-400 animate-in fade-in slide-in-from-bottom-2 duration-500 md:text-[64px]">
                {match.timeConfirmed === false ? "—" : formatTime(match.kickoff)}
              </span>
            )}
            {note && <span className="mt-2 rounded-full bg-white/10 px-2.5 py-0.5 text-2xs md:text-xs">{note}</span>}
            {!score && match.status === "SCHEDULED" && (
              <span className="mt-2 text-xs text-band-muted md:text-sm">{match.timeConfirmed === false ? UNCONFIRMED_DATE : relativeDayLabel(match.kickoff)}</span>
            )}
          </div>
          <Side match={match} side="away" index={index} />
        </div>

        <div className="mt-5 flex flex-col items-center gap-3 md:mt-7">
          <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-band-muted md:text-sm">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              {match.timeConfirmed === false ? UNCONFIRMED_DATE : `${relativeDayLabel(match.kickoff)}, ${formatTime(match.kickoff)}`}
            </span>
            {venue && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" aria-hidden="true" />
                {venue.name}
              </span>
            )}
          </p>
          {showLink && (
            <Link
              to={`/oyinlar/${match.id}`}
              className="inline-flex h-10 items-center rounded-full border border-gold-400/60 bg-pitch-900 px-5 text-sm font-semibold text-gold-400 transition-colors hover:bg-gold-400 hover:text-pitch-900"
            >
              O‘yin tafsilotlari
            </Link>
          )}
        </div>
      </div>
    </article>
  )
}
