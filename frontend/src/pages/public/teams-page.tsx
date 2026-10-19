import { Search, Shield } from "lucide-react"
import { useMemo, useState } from "react"
import { Link } from "react-router"
import { EmptyState, ErrorState, PageHeader, PageSkeleton } from "@/components/league/states"
import { TeamCrest } from "@/components/league/team-crest"
import { Input } from "@/components/ui/input"
import { useSeasonData } from "@/hooks/use-season-data"

export default function TeamsPage() {
  const { index, isLoading, error, refetch } = useSeasonData()
  const [query, setQuery] = useState("")

  const teams = useMemo(() => {
    if (!index) return []
    const q = query.trim().toLowerCase()
    return index.bundle.teams.filter((t) => !q || t.name.toLowerCase().includes(q) || t.village.toLowerCase().includes(q))
  }, [index, query])

  if (isLoading && !index) return <PageSkeleton />
  if (error || !index) return <ErrorState message={error?.message} onRetry={() => refetch()} className="container-page" />

  const positionOf = (id: string) => {
    for (const rows of Object.values(index.bundle.standings)) {
      const row = rows.find((r) => r.seasonTeamId === id)
      if (row) return row
    }
    return undefined
  }

  return (
    <div className="container-page pt-5 md:pt-8">
      <PageHeader title="Jamoalar" description={`${index.bundle.season.year}-yil mavsumida ${index.bundle.teams.length} ta jamoa ishtirok etmoqda`}>
        <div className="relative w-full md:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jamoa yoki qishloq nomi"
            aria-label="Jamoalarni qidirish"
            className="pl-9"
          />
        </div>
      </PageHeader>

      {teams.length === 0 ? (
        <div className="panel">
          <EmptyState icon={Shield} title="Jamoa topilmadi" description="Qidiruv so‘zini o‘zgartirib ko‘ring." />
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
          {teams.map((t) => {
            const group = index.groupOfTeam(t.id)
            const row = positionOf(t.id)
            return (
              <li key={t.id}>
                <Link
                  to={`/jamoalar/${t.teamId}`}
                  className="panel flex items-center gap-3 p-3 transition-colors hover:border-pitch-300 md:p-4"
                >
                  <TeamCrest team={t} size="lg" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-lg">{t.name}</span>
                    <span className="block truncate text-sm text-muted-foreground">{t.village} qishlog‘i</span>
                  </span>
                  {group && (
                    <span className="shrink-0 text-right text-xs text-muted-foreground">
                      <span className="block">{group.name} guruhi</span>
                      {row && row.played > 0 && <span className="block font-semibold text-foreground">{row.position}-o‘rin</span>}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
