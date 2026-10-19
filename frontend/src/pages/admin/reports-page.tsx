import { Printer } from "lucide-react"
import { qualifiersFor } from "@/domain/playoff"
import { useReport } from "@/api/hooks"
import { AdminPageHeader, StatTile } from "@/components/admin/admin-ui"
import { ErrorState, PageSkeleton } from "@/components/league/states"
import { StandingsTable } from "@/components/league/standings-table"
import { TeamCrest } from "@/components/league/team-crest"
import { Button } from "@/components/ui/button"
import { topScorers } from "@/domain/stats"
import { useSeason } from "@/hooks/use-season"
import { useSeasonData } from "@/hooks/use-season-data"
import { formatDate } from "@/lib/format"
import { totalScore } from "@/lib/match"

export default function AdminReportsPage() {
  const { seasonId } = useSeason()
  const { data, isLoading, error, refetch } = useReport(seasonId)
  const { index } = useSeasonData()
  if (isLoading || !index) return <PageSkeleton />
  if (error || !data) return <ErrorState message={error?.message} onRetry={() => refetch()} />

  const team = (id: string | null | undefined) => data.teams.find((t) => t.id === id)
  const big = data.biggestWin
  const bigScore = big ? totalScore(big) : null
  const scorers = topScorers(index.bundle.playerStats, (id) => index.player(id)?.lastName ?? "").slice(0, 10)

  return (
    <div className="mx-auto max-w-5xl">
      <AdminPageHeader
        title="Hisobotlar"
        description={`${data.season.year}-yil, ${data.season.name} bo‘yicha umumiy ko‘rsatkichlar`}
        actions={
          <Button variant="outline" onClick={() => window.print()} className="no-print">
            <Printer aria-hidden="true" />
            Chop etish
          </Button>
        }
      />
      <section className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3" aria-label="Asosiy ko‘rsatkichlar">
        <StatTile label="O‘tkazilgan o‘yinlar" value={data.matchesFinished} />
        <StatTile label="Urilgan gollar" value={data.goals} hint={`o‘yin boshiga ${data.avgGoals}`} />
        <StatTile label="Sariq kartochkalar" value={data.yellow} />
        <StatTile label="Qizil kartochkalar" value={data.red} />
      </section>
      <section className="mb-5 grid gap-3 md:grid-cols-3" aria-label="Rekordlar">
        <div className="panel p-4">
          <p className="text-sm text-muted-foreground">Eng kuchli hujum</p>
          {data.bestAttack ? (
            <p className="mt-2 flex items-center gap-2 font-semibold">
              <TeamCrest team={data.bestAttack.team} size="sm" />
              {data.bestAttack.team.name}
              <span className="ml-auto font-score text-2xl">{data.bestAttack.goals}</span>
            </p>
          ) : (
            <p className="mt-2 text-muted-foreground">—</p>
          )}
        </div>
        <div className="panel p-4">
          <p className="text-sm text-muted-foreground">Eng ishonchli himoya</p>
          {data.bestDefence ? (
            <p className="mt-2 flex items-center gap-2 font-semibold">
              <TeamCrest team={data.bestDefence.team} size="sm" />
              {data.bestDefence.team.name}
              <span className="ml-auto font-score text-2xl">{data.bestDefence.conceded}</span>
            </p>
          ) : (
            <p className="mt-2 text-muted-foreground">—</p>
          )}
        </div>
        <div className="panel p-4">
          <p className="text-sm text-muted-foreground">Eng katta hisob</p>
          {big && bigScore ? (
            <>
              <p className="mt-2 font-semibold">
                {team(big.homeId)?.name} <span className="font-score">{bigScore.home}:{bigScore.away}</span> {team(big.awayId)?.name}
              </p>
              <p className="text-xs text-muted-foreground">{formatDate(big.kickoff, { year: true })}</p>
            </>
          ) : (
            <p className="mt-2 text-muted-foreground">—</p>
          )}
        </div>
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        {index.bundle.groups.map((g) => (
          <section key={g.id} className="panel overflow-hidden break-inside-avoid" aria-label={`${g.name} guruhi`}>
            <h2 className="border-b border-border px-4 py-2.5 font-display text-lg">{g.name} guruhi</h2>
            <StandingsTable rows={index.bundle.standings[g.id] ?? []} index={index} mode="compact" qualifiers={qualifiersFor(index.bundle.season.rules, (index.bundle.standings[g.id] ?? []).length)} />
          </section>
        ))}
        <section className="panel overflow-hidden lg:col-span-2" aria-labelledby="rep-scorers">
          <h2 id="rep-scorers" className="border-b border-border px-4 py-2.5 font-display text-lg">
            To‘purarlar (10 talik)
          </h2>
          <ol className="grid gap-x-6 px-4 py-2 text-sm sm:grid-cols-2">
            {scorers.map((s, i) => (
              <li key={s.playerId} className="flex items-center gap-2 border-b border-border py-1.5 last:border-0">
                <span className="w-5 font-score text-muted-foreground">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">
                  {index.player(s.playerId)?.firstName} {index.player(s.playerId)?.lastName}
                  <span className="text-muted-foreground">, {index.team(s.seasonTeamId)?.name}</span>
                </span>
                <span className="font-score text-md">{s.goals}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">PDF ko‘rinishidagi chiroyli hisobot va Excel eksporti keyingi bosqichda qo‘shiladi. Hozircha «Chop etish» orqali PDF saqlash mumkin.</p>
    </div>
  )
}
