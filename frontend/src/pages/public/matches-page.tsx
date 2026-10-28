import { CalendarX } from "lucide-react"
import { useMemo } from "react"
import { useSearchParams } from "react-router"
import { MatchRow } from "@/components/league/match-row"
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from "@/components/league/states"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Match } from "@/domain/types"
import { useSeasonData } from "@/hooks/use-season-data"
import { localDateKey, relativeDayLabel, todayKey } from "@/lib/format"
import { UNCONFIRMED_DATE } from "@/lib/playoff-overview"

const confirmed = (m: Match) => m.timeConfirmed !== false

interface DayGroup {
  key: string
  title: string
  note?: string
  list: Match[]
}

const TABS = [
  { value: "bugun", label: "Bugun" },
  { value: "kelgusi", label: "Kelgusi" },
  { value: "natijalar", label: "Natijalar" },
  { value: "taqvim", label: "Taqvim" },
] as const
type Tab = (typeof TABS)[number]["value"]

const EMPTY_TEXT: Record<Tab, { title: string; description: string }> = {
  bugun: { title: "Bugun o‘yin yo‘q", description: "Kelgusi o‘yinlarni «Kelgusi» bo‘limida ko‘ring." },
  kelgusi: { title: "Rejalashtirilgan o‘yinlar yo‘q", description: "Yangi o‘yinlar belgilanganda shu yerda paydo bo‘ladi." },
  natijalar: { title: "Hali natijalar yo‘q", description: "O‘yinlar yakunlangach natijalar shu yerda ko‘rinadi." },
  taqvim: { title: "O‘yinlar topilmadi", description: "Filtrlarni o‘zgartirib ko‘ring." },
}

export default function MatchesPage() {
  const { index, isLoading, error, refetch } = useSeasonData()
  const [params, setParams] = useSearchParams()
  const today = todayKey()

  const hasToday = index?.bundle.matches.some((m) => confirmed(m) && localDateKey(m.kickoff) === today) ?? false
  const tab = (TABS.some((t) => t.value === params.get("tab")) ? params.get("tab") : hasToday ? "bugun" : "kelgusi") as Tab
  const stage = params.get("bosqich") ?? "all"
  const team = params.get("jamoa") ?? "all"

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value === "all") next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const days = useMemo((): DayGroup[] => {
    if (!index) return []
    let list: Match[] = index.bundle.matches
    if (stage === "playoff") list = list.filter((m) => m.stage === "PLAYOFF")
    else if (stage !== "all") list = list.filter((m) => m.groupId === stage)
    if (team !== "all") list = list.filter((m) => m.homeId === team || m.awayId === team)
    if (tab === "bugun") list = list.filter((m) => confirmed(m) && localDateKey(m.kickoff) === today)
    if (tab === "kelgusi")
      list = list.filter((m) => (m.status === "SCHEDULED" || m.status === "LIVE" || m.status === "POSTPONED") && (!confirmed(m) || localDateKey(m.kickoff) >= today))
    if (tab === "natijalar") list = list.filter((m) => m.status === "FINISHED").reverse()
    // Sanasi hali e'lon qilinmagan o'yinlar (pley-off juftliklari) — alohida, ro'yxat oxirida
    const map = new Map<string, Match[]>()
    const pending: Match[] = []
    for (const m of list) {
      if (!confirmed(m) && m.status !== "FINISHED") {
        pending.push(m)
        continue
      }
      const key = localDateKey(m.kickoff)
      map.set(key, [...(map.get(key) ?? []), m])
    }
    const groups: DayGroup[] = [...map.entries()].map(([key, l]) => ({ key, title: relativeDayLabel(l[0].kickoff), list: l }))
    if (pending.length > 0) groups.push({ key: "sana-yoq", title: UNCONFIRMED_DATE, note: "Juftliklar aniq. Sana va vaqtni tashkilotchilar tez orada e’lon qiladi.", list: pending })
    return groups
  }, [index, stage, team, tab, today])

  return (
    <div className="container-page pt-5 md:pt-8">
      <PageHeader title="O‘yinlar" description="Taqvim, bugungi o‘yinlar va barcha natijalar" />

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Tabs value={tab} onValueChange={(v) => update("tab", v)}>
          <TabsList className="w-full md:w-auto">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} aria-controls="matches-panel" className="flex-1 md:flex-none">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="grid grid-cols-2 gap-2 md:flex">
          <Select value={stage} onValueChange={(v) => update("bosqich", v)}>
            <SelectTrigger aria-label="Bosqich yoki guruh" className="w-full text-sm md:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha bosqichlar</SelectItem>
              {index?.bundle.groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name} guruhi
                </SelectItem>
              ))}
              <SelectItem value="playoff">Pley-off</SelectItem>
            </SelectContent>
          </Select>
          <Select value={team} onValueChange={(v) => update("jamoa", v)}>
            <SelectTrigger aria-label="Jamoa" className="w-full text-sm md:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha jamoalar</SelectItem>
              {index?.bundle.teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div id="matches-panel" role="tabpanel" aria-label={TABS.find((t) => t.value === tab)?.label}>
      {isLoading && !index ? (
        <div className="panel">
          <ListSkeleton rows={6} />
        </div>
      ) : error || !index ? (
        <ErrorState message={error?.message} onRetry={() => refetch()} />
      ) : days.length === 0 ? (
        <div className="panel">
          <EmptyState icon={CalendarX} {...EMPTY_TEXT[tab]} />
        </div>
      ) : (
        <div className="space-y-4">
          {days.map((day) => (
            <section key={day.key} className="panel overflow-hidden" aria-label={day.title}>
              <h2 className="border-b border-border bg-muted/60 px-3 py-2 text-sm font-semibold md:px-4">
                {day.title}
                {day.note && <span className="block text-xs font-normal text-muted-foreground">{day.note}</span>}
              </h2>
              <div className="divide-y divide-border">
                {day.list.map((m) => (
                  <MatchRow key={m.id} match={m} index={index} showStage />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      </div>
    </div>
  )
}
