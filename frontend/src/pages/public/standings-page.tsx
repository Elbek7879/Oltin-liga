import { BookOpen, Rows3 } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router"
import { StandingsTable } from "@/components/league/standings-table"
import { EmptyState, ErrorState, PageHeader, PageSkeleton } from "@/components/league/states"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { qualifiersFor } from "@/domain/playoff"
import { TIEBREAKER_LABELS } from "@/domain/standings"
import { useMyTeam } from "@/hooks/use-my-team"
import { useSeasonData } from "@/hooks/use-season-data"
import { useMediaQuery } from "@/hooks/use-media-query"

export default function StandingsPage() {
  const { index, isLoading, error, refetch } = useSeasonData()
  const desktop = useMediaQuery("(min-width: 768px)")
  const [full, setFull] = useState(false)
  const { teamId: myTeamId } = useMyTeam()

  if (isLoading && !index) return <PageSkeleton />
  if (error || !index) return <ErrorState message={error?.message} onRetry={() => refetch()} className="container-page" />

  const { season, groups, standings, adjustments } = index.bundle
  const mode = desktop || full ? "full" : "compact"
  const myTeam = index.bundle.teams.find((t) => t.teamId === myTeamId)
  // Guruh hajmiga qarab chiqadiganlar soni: 4 jamoali — 2 ta, 5 jamoali — 3 ta (sozlamadan)
  const sizes = [...new Set(groups.map((g) => g.seasonTeamIds.length))].sort((a, b) => a - b)
  const advanceText = sizes.map((n) => `${n} jamoali guruhdan ${qualifiersFor(season.rules, n)} ta`).join(", ")

  return (
    <div className="container-page pt-5 md:pt-8">
      <PageHeader title="Turnir jadvali" description={`${season.year}-yil, ${season.name}. Jadval har bir yakunlangan o‘yindan keyin avtomatik yangilanadi.`}>
        <div className="flex items-center gap-2 md:hidden">
          <Switch id="full-table" checked={full} onCheckedChange={setFull} />
          <Label htmlFor="full-table" className="text-sm">
            Barcha ustunlar
          </Label>
        </div>
      </PageHeader>

      {groups.length === 0 ? (
        <div className="panel">
          <EmptyState icon={Rows3} title="Guruhlar hali tuzilmagan" description="Qur’a o‘tkazilgach guruhlar jadvali shu yerda ko‘rinadi." />
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {groups.map((g) => (
            <section key={g.id} className="panel overflow-hidden" aria-labelledby={`group-${g.id}`}>
              <h2 id={`group-${g.id}`} className="flex items-center justify-between border-b border-border px-4 py-3">
                <span className="font-display text-xl">{g.name} guruhi</span>
                <span className="text-xs text-muted-foreground">
                  {g.seasonTeamIds.length} ta jamoa, {qualifiersFor(season.rules, g.seasonTeamIds.length)} tasi chiqadi
                </span>
              </h2>
              <StandingsTable
                rows={standings[g.id] ?? []}
                index={index}
                mode={mode}
                qualifiers={qualifiersFor(season.rules, (standings[g.id] ?? []).length || g.seasonTeamIds.length)}
                caption={`${g.name} guruhi turnir jadvali`}
                highlightTeamId={myTeam?.id}
              />
            </section>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <section className="panel p-4 text-sm" aria-labelledby="legend-title">
          <h2 id="legend-title" className="mb-2 font-semibold">
            Belgilar
          </h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted-foreground">
            <dt className="font-semibold text-foreground">O‘</dt><dd>O‘yinlar soni</dd>
            <dt className="font-semibold text-foreground">G‘ / D / M</dt><dd>G‘alaba, durang, mag‘lubiyat</dd>
            <dt className="font-semibold text-foreground">UG / O‘G</dt><dd>Urilgan va o‘tkazilgan gollar</dd>
            <dt className="font-semibold text-foreground">TF</dt><dd>To‘plar farqi</dd>
            <dt className="font-semibold text-foreground">Och</dt>
            <dd>
              Ochko: g‘alaba {season.rules.pointsWin}, durang {season.rules.pointsDraw}, mag‘lubiyat {season.rules.pointsLoss}
            </dd>
          </dl>
          {Object.values(standings).some((rows) => rows.some((r) => r.unresolvedTie)) && (
            <p className="mt-3 text-muted-foreground">
              <span className="font-semibold text-foreground">*</span> — jamoalar barcha mezonlar bo‘yicha teng. Nizomga ko‘ra o‘rin qur’a bilan aniqlanadi: tashkilotchilar qur’ani o‘tkazguncha alifbo tartibida ko‘rsatiladi.
            </p>
          )}
          <p className="mt-3 flex items-center gap-2 text-muted-foreground">
            <span className="h-4 w-[3px] rounded-full bg-gold" aria-hidden="true" />
            <span className="h-4 w-[3px] rounded-full bg-qualify" aria-hidden="true" />
            <span>
              Pley-offga chiqadi: {advanceText || `har guruhdan ${season.rules.qualifiersPerGroup} ta`}. Oltin chiziq — guruh g‘olibi.
            </span>
          </p>
          <Link to="/nizom" className="mt-3 inline-flex min-h-10 items-center gap-1.5 font-semibold text-foreground underline-offset-4 hover:underline">
            <BookOpen className="size-4" aria-hidden="true" />
            Musobaqa nizomi: kim chiqadi, saralash va pley-off qanday o‘tadi
          </Link>
        </section>
        <section className="panel p-4 text-sm" aria-labelledby="tiebreak-title">
          <h2 id="tiebreak-title" className="mb-2 font-semibold">
            Teng ochko bo‘lganda
          </h2>
          <ol className="list-decimal space-y-0.5 pl-5 text-muted-foreground">
            {season.rules.tiebreakers.map((t) => (
              <li key={t}>{TIEBREAKER_LABELS[t]}</li>
            ))}
            <li>Qur’a</li>
          </ol>
          {adjustments.length > 0 && (
            <>
              <h3 className="mt-4 mb-1 font-semibold">Ochko o‘zgarishlari</h3>
              <ul className="space-y-1 text-muted-foreground">
                {adjustments.map((a) => (
                  <li key={a.id}>
                    <span className="font-semibold text-foreground">{index.team(a.seasonTeamId)?.name}</span>: {a.points > 0 ? "+" : ""}
                    {a.points} ochko — {a.reason}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
