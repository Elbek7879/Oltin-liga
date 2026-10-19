import { Link } from "react-router"
import type { PlayerSeasonStats } from "@/domain/stats"
import type { SeasonIndex } from "@/hooks/use-season-data"
import { cn } from "@/lib/utils"
import { TeamCrest } from "./team-crest"

/** Reytingdagi o'rin: teng ko'rsatkichli futbolchilar bir xil o'rinni oladi */
export function rankOf<T>(list: T[], value: (item: T) => number) {
  const ranks: number[] = []
  list.forEach((item, i) => {
    ranks.push(i > 0 && value(list[i - 1]) === value(item) ? ranks[i - 1] : i + 1)
  })
  return ranks
}

export function ScorersList({
  stats,
  index,
  metric = "goals",
  limit,
}: {
  stats: PlayerSeasonStats[]
  index: SeasonIndex
  metric?: "goals" | "assists"
  limit?: number
}) {
  const list = limit ? stats.slice(0, limit) : stats
  const ranks = rankOf(list, (s) => s[metric])
  return (
    <ol className="divide-y divide-border">
      {list.map((s, i) => {
        const player = index.player(s.playerId)
        const team = index.team(s.seasonTeamId)
        const top = ranks[i] === 1
        return (
          <li key={`${s.playerId}-${s.seasonTeamId}`}>
            <Link
              to={`/futbolchilar/${s.playerId}`}
              className="flex min-h-13 items-center gap-3 px-3 py-2 transition-colors hover:bg-row-hover md:px-4"
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full font-score text-sm",
                  top ? "bg-gold text-pitch-900" : "bg-muted text-muted-foreground",
                )}
              >
                {ranks[i]}
              </span>
              <TeamCrest team={team} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                  {player ? `${player.firstName} ${player.lastName}` : "Noma’lum"}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{team?.name}</span>
              </span>
              <span className="text-right">
                <span className="block font-score text-xl leading-none">{s[metric]}</span>
                {metric === "goals" && s.penaltyGoals > 0 && (
                  <span className="text-2xs text-muted-foreground">{s.penaltyGoals} pen.</span>
                )}
              </span>
            </Link>
          </li>
        )
      })}
    </ol>
  )
}
