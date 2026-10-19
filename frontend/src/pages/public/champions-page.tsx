import { Crown, Medal } from "lucide-react"
import { Link } from "react-router"
import { useArchive } from "@/api/hooks"
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from "@/components/league/states"
import { TeamCrest } from "@/components/league/team-crest"

export default function ChampionsPage() {
  const { data, isLoading, error, refetch } = useArchive()
  const finished = data?.summaries.filter((s) => s.champion) ?? []

  return (
    <div className="container-page pt-5 md:pt-8">
      <PageHeader title="Chempionlar tarixi" description="Payariq Oltin Ligasi g‘oliblari va sovrindorlari" />
      {isLoading ? (
        <div className="panel"><ListSkeleton rows={3} /></div>
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : finished.length === 0 ? (
        <div className="panel"><EmptyState icon={Crown} title="Birinchi chempion hali aniqlanmagan" description="Mavsum yakunlangach g‘olib shu yerda paydo bo‘ladi." /></div>
      ) : (
        <ol className="relative mx-auto max-w-3xl space-y-4 border-l-2 border-gold/40 pl-5 md:pl-8">
          {finished.map((s) => (
            <li key={s.season.id} className="relative">
              <span className="absolute top-5 -left-[29px] flex size-4 items-center justify-center rounded-full bg-gold ring-4 ring-background md:-left-[41px]" aria-hidden="true" />
              <article className="panel overflow-hidden">
                <div className="flex items-center gap-4 bg-band p-4 text-band-foreground md:p-5">
                  <TeamCrest team={s.champion} size="xl" />
                  <div className="min-w-0">
                    <p className="font-score text-2xl leading-none text-gold-400">{s.season.year}</p>
                    <h2 className="mt-1 truncate font-display text-3xl">{s.champion!.name}</h2>
                    <p className="text-sm text-band-muted">{s.champion!.village} qishlog‘i</p>
                  </div>
                  <Crown className="ml-auto hidden size-10 text-gold-400 sm:block" aria-hidden="true" />
                </div>
                <dl className="grid gap-px bg-border sm:grid-cols-3">
                  {[
                    { label: "2-o‘rin", team: s.runnerUp },
                    { label: "3-o‘rin", team: s.third },
                  ].map(({ label, team }) => (
                    <div key={label} className="bg-card px-4 py-3">
                      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Medal className="size-3.5" aria-hidden="true" />
                        {label}
                      </dt>
                      <dd className="mt-1 flex items-center gap-2 font-semibold">
                        {team ? (
                          <>
                            <TeamCrest team={team} size="xs" />
                            {team.name}
                          </>
                        ) : (
                          "—"
                        )}
                      </dd>
                    </div>
                  ))}
                  <div className="bg-card px-4 py-3">
                    <dt className="text-xs text-muted-foreground">Eng yaxshi to‘purar</dt>
                    <dd className="mt-1 font-semibold">
                      {s.topScorer ? (
                        <Link to={`/futbolchilar/${s.topScorer.player.id}`} className="hover:underline">
                          {s.topScorer.player.firstName} {s.topScorer.player.lastName}
                          <span className="font-normal text-muted-foreground">, {s.topScorer.goals} gol</span>
                        </Link>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                </dl>
              </article>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
