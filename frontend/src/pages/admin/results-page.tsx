import { CircleCheck, ClipboardList, ImageDown, Printer, Search, X } from "lucide-react"
import { useMemo, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router"
import { AdminMatchItem } from "@/components/admin/admin-match-item"
import { AdminPageHeader, ReadOnlyBanner, useReadOnly } from "@/components/admin/admin-ui"
import { MatchImageDialog } from "@/components/league/match-image-dialog"
import { EmptyState, ErrorState, ListSkeleton } from "@/components/league/states"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSeasonData } from "@/hooks/use-season-data"
import { sideName, stageLabel, totalScore } from "@/lib/match"
import { searchKey } from "@/lib/translit"

export default function ResultsPage() {
  const { index, isLoading, error, refetch } = useSeasonData()
  const readOnly = useReadOnly()
  const [tab, setTab] = useState("kutilmoqda")
  const [query, setQuery] = useState("")
  const [imageFor, setImageFor] = useState<string | null>(null)
  // Natija saqlangach shu sahifaga qaytiladi: saqlangan o'yin uchun rasm tayyorlash taklif qilinadi
  const location = useLocation()
  const navigate = useNavigate()
  const savedId = (location.state as { saved?: string } | null)?.saved ?? null
  const saved = savedId ? index?.bundle.matches.find((m) => m.id === savedId && m.status === "FINISHED") : undefined
  const dismissSaved = () => navigate(location.pathname, { replace: true, state: null })

  const lists = useMemo(() => {
    if (!index) return { pending: [], finished: [], other: [] }
    const q = searchKey(query)
    const match = (id: string | null) => !q || (searchKey(index.team(id)?.name ?? "").includes(q) && Boolean(index.team(id)))
    const all = index.bundle.matches.filter((m) => m.homeId && m.awayId && (match(m.homeId) || match(m.awayId)))
    const now = Date.now()
    return {
      pending: all
        .filter((m) => m.status === "LIVE" || (m.status === "SCHEDULED" && m.timeConfirmed !== false && Date.parse(m.kickoff) < now + 36 * 3600_000))
        .sort((a, b) => a.kickoff.localeCompare(b.kickoff)),
      finished: all.filter((m) => m.status === "FINISHED").sort((a, b) => b.kickoff.localeCompare(a.kickoff)),
      other: all.filter((m) => m.status === "POSTPONED" || m.status === "CANCELLED"),
    }
  }, [index, query])

  const current = tab === "kutilmoqda" ? lists.pending : tab === "yakunlangan" ? lists.finished : lists.other
  const overdue = (kickoff: string) => Date.parse(kickoff) < Date.now()

  return (
    <div className="mx-auto max-w-5xl">
      <AdminPageHeader
        title="Natijalar"
        description="O‘yin tugagach hisob va gol mualliflarini kiriting. Turnir jadvali, ochkolar va to‘purarlar reytingi avtomatik yangilanadi."
      />
      <ReadOnlyBanner />
      {saved && index && (
        <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-win/30 bg-qualify-soft px-4 py-3 text-sm">
          <CircleCheck className="size-5 shrink-0 text-win" aria-hidden="true" />
          <p className="min-w-0 flex-1">
            <span className="font-semibold">Natija saqlandi:</span> {sideName(saved, "home", index)} {totalScore(saved)?.home}:{totalScore(saved)?.away}{" "}
            {sideName(saved, "away", index)}. Telegram kanali uchun rasm tayyor.
          </p>
          <Button size="sm" onClick={() => setImageFor(saved.id)}>
            <ImageDown aria-hidden="true" />
            Natija rasmi
          </Button>
          <Button size="icon" variant="ghost" onClick={dismissSaved} aria-label="Xabarni yopish" className="size-9">
            <X aria-hidden="true" />
          </Button>
        </div>
      )}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full md:w-auto">
            <TabsTrigger value="kutilmoqda" aria-controls="results-panel" className="flex-1 md:flex-none">
              Kiritish kerak ({lists.pending.length})
            </TabsTrigger>
            <TabsTrigger value="yakunlangan" aria-controls="results-panel" className="flex-1 md:flex-none">
              Yakunlangan
            </TabsTrigger>
            <TabsTrigger value="boshqa" aria-controls="results-panel" className="flex-1 md:flex-none">
              Qoldirilgan
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative md:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Jamoa nomi" aria-label="Jamoa bo‘yicha qidirish" className="pl-9" />
        </div>
      </div>

      <section id="results-panel" role="tabpanel" aria-label="O‘yinlar ro‘yxati" className="panel overflow-hidden">
        {isLoading && !index ? (
          <ListSkeleton rows={6} />
        ) : error || !index ? (
          <ErrorState message={error?.message} onRetry={() => refetch()} />
        ) : current.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={tab === "kutilmoqda" ? "Natija kutayotgan o‘yin yo‘q" : "O‘yinlar topilmadi"}
            description={tab === "kutilmoqda" ? "Bugungi va ertangi o‘yinlar shu yerda ko‘rinadi." : undefined}
          />
        ) : (
          <div className="divide-y divide-border">
            {current.map((m) => (
              <AdminMatchItem
                key={m.id}
                match={m}
                team={index.team}
                meta={`${stageLabel(m, index)}${m.status === "SCHEDULED" && overdue(m.kickoff) ? " — vaqti o‘tgan, natija kiritilmagan" : ""}`}
                action={
                  <>
                    {m.status === "FINISHED" ? (
                      <Button size="sm" variant="outline" onClick={() => setImageFor(m.id)}>
                        <ImageDown aria-hidden="true" />
                        Rasm
                      </Button>
                    ) : (
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/admin/natijalar/${m.id}/bayonnoma`}>
                          <Printer aria-hidden="true" />
                          Bayonnoma
                        </Link>
                      </Button>
                    )}
                    {readOnly ? (
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/admin/natijalar/${m.id}`}>Ko‘rish</Link>
                      </Button>
                    ) : (
                      <Button asChild size="sm" variant={m.status === "FINISHED" ? "outline" : "default"}>
                        <Link to={`/admin/natijalar/${m.id}`}>{m.status === "FINISHED" ? "Tahrirlash" : "Natija kiritish"}</Link>
                      </Button>
                    )}
                  </>
                }
              />
            ))}
          </div>
        )}
      </section>
      {index && imageFor && index.bundle.matches.some((m) => m.id === imageFor) && (
        <MatchImageDialog
          match={index.bundle.matches.find((m) => m.id === imageFor)!}
          index={index}
          open
          onOpenChange={(v) => !v && setImageFor(null)}
        />
      )}
    </div>
  )
}
