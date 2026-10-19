import { ChartColumn } from "lucide-react"
import { useMemo } from "react"
import { Link, useSearchParams } from "react-router"
import { CardIcon } from "@/components/league/icons"
import { rankOf, ScorersList } from "@/components/league/scorers-list"
import { EmptyState, ErrorState, PageHeader, PageSkeleton } from "@/components/league/states"
import { SuspensionsList, SUSPENSION_RULE } from "@/components/league/suspensions-list"
import { TeamCrest } from "@/components/league/team-crest"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { countsForTable } from "@/domain/standings"
import { topAssists, topScorers } from "@/domain/stats"
import { useSeasonData, type SeasonIndex } from "@/hooks/use-season-data"
import { cn } from "@/lib/utils"

const TABS = [
  { value: "tupurarlar", label: "To‘purarlar" },
  { value: "assistlar", label: "Assistlar" },
  { value: "kartochkalar", label: "Kartochkalar" },
  { value: "fair-play", label: "Fair Play" },
  { value: "jamoalar", label: "Jamoalar" },
] as const

function CardsTable({ index }: { index: SeasonIndex }) {
  const list = index.bundle.playerStats
    .filter((s) => s.yellow + s.red > 0)
    .sort((a, b) => b.red * 3 + b.yellow - (a.red * 3 + a.yellow))
    .slice(0, 50)
  if (list.length === 0) return <EmptyState icon={ChartColumn} title="Kartochkalar hali yo‘q" />
  return (
    <>
    <div className="border-b border-border">
      <h3 className="px-4 pt-3 text-sm font-semibold">Diskvalifikatsiyada</h3>
      <p className="px-4 text-xs text-muted-foreground">{SUSPENSION_RULE}</p>
      <SuspensionsList index={index} />
    </div>
    <table className="w-full text-sm md:text-base">
      <caption className="sr-only">Kartochkalar</caption>
      <thead>
        <tr className="border-b border-border text-xs text-muted-foreground">
          <th scope="col" className="py-2 pl-4 text-left font-medium">Futbolchi</th>
          <th scope="col" className="w-14 py-2 text-center font-medium"><CardIcon kind="yellow" /><span className="sr-only">Sariq</span></th>
          <th scope="col" className="w-14 py-2 pr-4 text-center font-medium"><CardIcon kind="red" /><span className="sr-only">Qizil</span></th>
        </tr>
      </thead>
      <tbody>
        {list.map((s) => {
          const p = index.player(s.playerId)
          const t = index.team(s.seasonTeamId)
          return (
            <tr key={`${s.playerId}-${s.seasonTeamId}`} className="border-b border-border last:border-0">
              <td className="py-2 pl-4">
                <Link to={`/futbolchilar/${s.playerId}`} className="flex items-center gap-2 hover:underline">
                  <TeamCrest team={t} size="xs" />
                  <span className="truncate font-medium">{p?.firstName} {p?.lastName}</span>
                </Link>
              </td>
              <td className="py-2 text-center font-score text-md">{s.yellow}</td>
              <td className={cn("py-2 pr-4 text-center font-score text-md", s.red > 0 && "text-loss")}>{s.red}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
    </>
  )
}

function FairPlayTable({ index }: { index: SeasonIndex }) {
  const list = index.bundle.discipline.filter((d) => d.played > 0)
  if (list.length === 0) return <EmptyState icon={ChartColumn} title="Hali o‘yinlar o‘tkazilmagan" />
  const ranks = rankOf(list, (d) => d.fairPlayPoints)
  return (
    <>
      <table className="w-full text-sm md:text-base">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th scope="col" className="w-10 py-2 pl-4 text-left font-medium">#</th>
            <th scope="col" className="py-2 text-left font-medium">Jamoa</th>
            <th scope="col" className="w-12 py-2 text-center font-medium"><CardIcon kind="yellow" /><span className="sr-only">Sariq</span></th>
            <th scope="col" className="w-12 py-2 text-center font-medium"><CardIcon kind="red" /><span className="sr-only">Qizil</span></th>
            <th scope="col" className="w-16 py-2 pr-4 text-center font-medium">Ball</th>
          </tr>
        </thead>
        <tbody>
          {list.map((d, i) => {
            const t = index.team(d.seasonTeamId)
            return (
              <tr key={d.seasonTeamId} className="border-b border-border last:border-0">
                <td className="py-2 pl-4 font-score text-md">{ranks[i]}</td>
                <td className="py-2">
                  <span className="flex items-center gap-2 font-medium">
                    <TeamCrest team={t} size="xs" />
                    {t?.name}
                  </span>
                </td>
                <td className="py-2 text-center tabular-nums">{d.yellow}</td>
                <td className="py-2 text-center tabular-nums">{d.red}</td>
                <td className="py-2 pr-4 text-center font-score text-md">{d.fairPlayPoints}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
        Sariq kartochka — 1 ball, qizil kartochka — 3 ball. Kamroq ball — yaxshiroq natija.
      </p>
    </>
  )
}

function TeamStats({ index }: { index: SeasonIndex }) {
  const rows = useMemo(() => {
    const finished = index.bundle.matches.filter(countsForTable)
    return index.bundle.teams
      .map((t) => {
        let gf = 0
        let ga = 0
        let played = 0
        let cleanSheets = 0
        for (const m of finished) {
          if (m.homeId !== t.id && m.awayId !== t.id) continue
          const home = m.homeId === t.id
          const f = home ? m.homeScore + (m.homeExtra ?? 0) : m.awayScore + (m.awayExtra ?? 0)
          const a = home ? m.awayScore + (m.awayExtra ?? 0) : m.homeScore + (m.homeExtra ?? 0)
          gf += f
          ga += a
          played++
          if (a === 0) cleanSheets++
        }
        return { t, gf, ga, played, cleanSheets }
      })
      .filter((r) => r.played > 0)
      .sort((a, b) => b.gf - a.gf)
  }, [index])
  if (rows.length === 0) return <EmptyState icon={ChartColumn} title="Hali o‘yinlar o‘tkazilmagan" />
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-sm md:text-base">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th scope="col" className="py-2 pl-4 text-left font-medium">Jamoa</th>
            <th scope="col" className="w-14 py-2 text-center font-medium">O‘yin</th>
            <th scope="col" className="w-16 py-2 text-center font-medium">Urilgan</th>
            <th scope="col" className="w-20 py-2 text-center font-medium">O‘tkazilgan</th>
            <th scope="col" className="w-24 py-2 pr-4 text-center font-medium">Quruq o‘yin</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ t, gf, ga, played, cleanSheets }) => (
            <tr key={t.id} className="border-b border-border last:border-0">
              <td className="py-2 pl-4">
                <Link to={`/jamoalar/${t.teamId}`} className="flex items-center gap-2 font-medium hover:underline">
                  <TeamCrest team={t} size="xs" />
                  {t.name}
                </Link>
              </td>
              <td className="py-2 text-center tabular-nums">{played}</td>
              <td className="py-2 text-center font-semibold tabular-nums">{gf}</td>
              <td className="py-2 text-center tabular-nums">{ga}</td>
              <td className="py-2 pr-4 text-center tabular-nums">{cleanSheets}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function StatsPage() {
  const { index, isLoading, error, refetch } = useSeasonData()
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((t) => t.value === params.get("tab")) ? params.get("tab")! : "tupurarlar"

  if (isLoading && !index) return <PageSkeleton />
  if (error || !index) return <ErrorState message={error?.message} onRetry={() => refetch()} className="container-page" />

  const name = (id: string) => index.player(id)?.lastName ?? ""
  const scorers = topScorers(index.bundle.playerStats, name)
  const assists = topAssists(index.bundle.playerStats, name)

  return (
    <div className="container-page pt-5 md:pt-8">
      <PageHeader title="Statistika" description="Barcha ko‘rsatkichlar o‘yin natijalari va hodisalaridan avtomatik hisoblanadi" />
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <TabsList className="mb-4 w-full md:w-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} aria-controls="stats-panel">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="mx-auto max-w-3xl">
        <section id="stats-panel" role="tabpanel" className="panel overflow-hidden" aria-label={TABS.find((t) => t.value === tab)?.label}>
          {tab === "tupurarlar" &&
            (scorers.length ? <ScorersList stats={scorers} index={index} /> : <EmptyState icon={ChartColumn} title="Hali gol urilmagan" />)}
          {tab === "assistlar" &&
            (assists.length ? <ScorersList stats={assists} index={index} metric="assists" /> : <EmptyState icon={ChartColumn} title="Assistlar hali kiritilmagan" />)}
          {tab === "kartochkalar" && <CardsTable index={index} />}
          {tab === "fair-play" && <FairPlayTable index={index} />}
          {tab === "jamoalar" && <TeamStats index={index} />}
        </section>
        {tab === "tupurarlar" && scorers.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Avtogollar futbolchining shaxsiy hisobiga qo‘shilmaydi. Teng gollarda kamroq penalti golli futbolchi yuqorida turadi.
          </p>
        )}
      </div>
    </div>
  )
}
