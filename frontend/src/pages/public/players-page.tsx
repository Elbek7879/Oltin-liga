import { Search, UserRound } from "lucide-react"
import { useMemo, useState } from "react"
import { Link } from "react-router"
import { EmptyState, ErrorState, PageHeader, PageSkeleton } from "@/components/league/states"
import { TeamCrest } from "@/components/league/team-crest"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Position } from "@/domain/types"
import { useSeasonData } from "@/hooks/use-season-data"
import { POSITION_LABEL } from "@/lib/format"
import { searchKey } from "@/lib/translit"

const PAGE = 40

export default function PlayersPage() {
  const { index, isLoading, error, refetch } = useSeasonData()
  const [query, setQuery] = useState("")
  const [team, setTeam] = useState("all")
  const [position, setPosition] = useState<"all" | Position>("all")
  const [limit, setLimit] = useState(PAGE)

  const rows = useMemo(() => {
    if (!index) return []
    const q = searchKey(query)
    return index.bundle.rosters
      .map((r) => {
        const p = index.player(r.playerId)!
        const s = index.bundle.playerStats.find((x) => x.playerId === r.playerId && x.seasonTeamId === r.seasonTeamId)
        return { p, r, s, team: index.team(r.seasonTeamId) }
      })
      .filter(({ r }) => team === "all" || r.seasonTeamId === team)
      .filter(({ p }) => position === "all" || p.position === position)
      .filter(({ p }) => !q || searchKey(`${p.firstName} ${p.lastName}`).includes(q))
      .sort((a, b) => (b.s?.goals ?? 0) - (a.s?.goals ?? 0) || a.p.lastName.localeCompare(b.p.lastName, "uz"))
  }, [index, query, team, position])

  if (isLoading && !index) return <PageSkeleton />
  if (error || !index) return <ErrorState message={error?.message} onRetry={() => refetch()} className="container-page" />

  return (
    <div className="container-page pt-5 md:pt-8">
      <PageHeader title="Futbolchilar" description={`${index.bundle.season.year}-yil mavsumida ro‘yxatga olingan ${index.bundle.rosters.length} ta futbolchi`} />
      <div className="mb-4 grid gap-2 md:grid-cols-[1fr_12rem_12rem]">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setLimit(PAGE)
            }}
            placeholder="Ism yoki familiya"
            aria-label="Futbolchini qidirish"
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 md:contents">
          <Select value={team} onValueChange={(v) => { setTeam(v); setLimit(PAGE) }}>
            <SelectTrigger aria-label="Jamoa" className="w-full text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha jamoalar</SelectItem>
              {index.bundle.teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={position} onValueChange={(v) => { setPosition(v as Position | "all"); setLimit(PAGE) }}>
            <SelectTrigger aria-label="Pozitsiya" className="w-full text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha pozitsiyalar</SelectItem>
              {(Object.keys(POSITION_LABEL) as Position[]).map((p) => (
                <SelectItem key={p} value={p}>{POSITION_LABEL[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="panel">
          <EmptyState icon={UserRound} title="Futbolchi topilmadi" description="Qidiruv yoki filtrlarni o‘zgartirib ko‘ring." />
        </div>
      ) : (
        <>
          <ul className="panel divide-y divide-border overflow-hidden">
            {rows.slice(0, limit).map(({ p, r, s, team: t }) => (
              <li key={`${p.id}-${r.seasonTeamId}`}>
                <Link to={`/futbolchilar/${p.id}`} className="flex min-h-14 items-center gap-3 px-3 py-2 hover:bg-row-hover md:px-4">
                  <span className="w-7 text-center font-score text-md text-muted-foreground">{r.number ?? "—"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{p.firstName} {p.lastName}</span>
                    <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                      <TeamCrest team={t} size="xs" />
                      {t?.name}, {p.position ? POSITION_LABEL[p.position].toLowerCase() : "pozitsiyasi ko‘rsatilmagan"}
                    </span>
                  </span>
                  <span className="grid grid-cols-2 gap-4 text-center text-xs text-muted-foreground">
                    <span><span className="block font-score text-lg text-foreground">{s?.goals ?? 0}</span>gol</span>
                    <span><span className="block font-score text-lg text-foreground">{s?.appearances ?? 0}</span>o‘yin</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {rows.length > limit && (
            <div className="mt-4 text-center">
              <Button variant="outline" onClick={() => setLimit((l) => l + PAGE)}>
                Yana ko‘rsatish ({rows.length - limit} ta qoldi)
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
