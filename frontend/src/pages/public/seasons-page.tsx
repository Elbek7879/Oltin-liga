import { Archive, Trophy } from "lucide-react"
import { useNavigate } from "react-router"
import { useArchive } from "@/api/hooks"
import type { SeasonSummary, TeamView } from "@/api/types"
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from "@/components/league/states"
import { TeamCrest } from "@/components/league/team-crest"
import { Button } from "@/components/ui/button"
import { useSeason } from "@/hooks/use-season"
import { formatDate, SEASON_STATUS_LABEL } from "@/lib/format"
import { cn } from "@/lib/utils"

function FinalLine({ s, teams }: { s: SeasonSummary; teams: TeamView[] }) {
  const f = s.final
  if (!f || f.status !== "FINISHED") return null
  const home = teams.find((t) => t.id === f.homeId)
  const away = teams.find((t) => t.id === f.awayId)
  const hs = (f.homeScore ?? 0) + (f.homeExtra ?? 0)
  const as = (f.awayScore ?? 0) + (f.awayExtra ?? 0)
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <span className="text-muted-foreground">Final:</span>
      <span className="font-medium">{home?.name}</span>
      <span className="rounded bg-muted px-1.5 font-score">
        {hs}:{as}
      </span>
      <span className="font-medium">{away?.name}</span>
      {f.decidedBy === "PENALTIES" && (
        <span className="text-muted-foreground">
          (penaltilar {f.homePens}:{f.awayPens})
        </span>
      )}
    </p>
  )
}

export default function SeasonsPage() {
  const { data, isLoading, error, refetch } = useArchive()
  const { setSeasonId, seasonId } = useSeason()
  const navigate = useNavigate()

  const open = (id: string) => {
    setSeasonId(id)
    navigate("/")
  }

  return (
    <div className="container-page pt-5 md:pt-8">
      <PageHeader title="Mavsumlar arxivi" description="Har bir mavsum natijalari alohida saqlanadi. Mavsumni tanlab, uning o‘yinlari, jadvali va to‘purarlarini ko‘ring." />
      {isLoading ? (
        <div className="panel"><ListSkeleton rows={3} /></div>
      ) : error || !data ? (
        <ErrorState message={error?.message} onRetry={() => refetch()} />
      ) : data.summaries.length === 0 ? (
        <div className="panel"><EmptyState icon={Archive} title="Mavsumlar hali yo‘q" /></div>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {data.summaries.map((s) => (
            <li key={s.season.id} className={cn("panel flex flex-col p-4 md:p-5", s.season.id === seasonId && "border-pitch-300")}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-score text-4xl leading-none">{s.season.year}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {s.season.name}, {formatDate(s.season.startDate)} — {formatDate(s.season.endDate)}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                    s.season.status === "ACTIVE" ? "bg-qualify-soft text-win" : "bg-muted text-muted-foreground",
                  )}
                >
                  {SEASON_STATUS_LABEL[s.season.status]}
                </span>
              </div>

              {s.champion ? (
                <div className="mt-4 flex items-center gap-3 rounded-xl bg-gold-soft p-3">
                  <Trophy className="size-6 shrink-0 text-gold-text" aria-hidden="true" />
                  <TeamCrest team={s.champion} size="md" />
                  <span>
                    <span className="block text-xs text-gold-text">Chempion</span>
                    <span className="font-display text-xl">{s.champion.name}</span>
                  </span>
                </div>
              ) : (
                <p className="mt-4 rounded-xl bg-muted p-3 text-sm text-muted-foreground">Chempion mavsum yakunida aniqlanadi.</p>
              )}

              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  ["Jamoalar", s.teamsCount],
                  ["O‘yinlar", `${s.matchesPlayed}/${s.matchesTotal}`],
                  ["Gollar", s.goals],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-border py-2">
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="font-score text-xl">{v}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-4 space-y-1.5">
                <FinalLine s={s} teams={data.teams} />
                {s.topScorer && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">To‘purar: </span>
                    <span className="font-medium">
                      {s.topScorer.player.firstName} {s.topScorer.player.lastName}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      ({s.topScorer.team.name}, {s.topScorer.goals} gol)
                    </span>
                  </p>
                )}
                {s.runnerUp && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Sovrindorlar: </span>
                    2-o‘rin {s.runnerUp.name}
                    {s.third ? `, 3-o‘rin ${s.third.name}` : ""}
                  </p>
                )}
              </div>

              <div className="mt-auto pt-4">
                <Button variant={s.season.id === seasonId ? "outline" : "default"} className="w-full sm:w-auto" onClick={() => open(s.season.id)}>
                  {s.season.id === seasonId ? "Hozir ko‘rilmoqda" : `${s.season.year}-yil mavsumini ochish`}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
