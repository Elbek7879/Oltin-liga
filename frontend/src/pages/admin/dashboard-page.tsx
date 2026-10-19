import { Ban, CalendarPlus, ChartColumn, ClipboardList, Handshake, Layers, Newspaper, ScrollText, Shield, TriangleAlert } from "lucide-react"
import { Link } from "react-router"
import { useDashboard, useMe } from "@/api/hooks"
import { AdminMatchItem } from "@/components/admin/admin-match-item"
import { AdminPageHeader, ReadOnlyBanner, StatTile, useReadOnly } from "@/components/admin/admin-ui"
import { SeasonRoadmap } from "@/components/admin/season-roadmap"
import { SuspensionsList, SUSPENSION_RULE } from "@/components/league/suspensions-list"
import { EmptyState, ErrorState, PageSkeleton } from "@/components/league/states"
import { Button } from "@/components/ui/button"
import { activeSuspensions } from "@/domain/discipline"
import { useSeason } from "@/hooks/use-season"
import { useSeasonData } from "@/hooks/use-season-data"
import { formatDateTime, SEASON_STATUS_LABEL } from "@/lib/format"
import { canEnterResults, canManageCompetition, canOpen } from "@/lib/roles"

const QUICK = [
  { to: "/admin/natijalar", label: "Natija kiritish", hint: "Hisob va gol mualliflari", icon: ClipboardList },
  { to: "/admin/oyinlar?yangi=1", label: "O‘yin belgilash", hint: "Sana, vaqt va maydon", icon: CalendarPlus },
  { to: "/admin/jamoalar?yangi=1", label: "Jamoa qo‘shish", hint: "Nomi, qishlog‘i, ranglari", icon: Shield },
  { to: "/admin/guruhlar", label: "Qur’a tashlash", hint: "Guruhlarni tuzish", icon: Layers },
  { to: "/admin/yangiliklar", label: "Yangilik yozish", hint: "E’lonlar va o‘yin sharhlari", icon: Newspaper, helperOnly: true },
  { to: "/admin/homiylar", label: "Homiylar", hint: "Logotip va havolalar", icon: Handshake, helperOnly: true },
  { to: "/admin/hisobotlar", label: "Hisobotlar", hint: "Mavsum ko‘rsatkichlari", icon: ChartColumn, helperOnly: true },
]

export default function DashboardPage() {
  const { seasonId } = useSeason()
  const { data, isLoading, error, refetch } = useDashboard(seasonId)
  const readOnly = useReadOnly()
  const { data: me } = useMe()
  const { index } = useSeasonData()
  const role = me?.role ?? "EDITOR"
  // To'liq huquqli rollarga musobaqa amallari, yordamchilarga faqat o'z bo'limlari
  const quick = QUICK.filter((q) => canOpen(role, q.to.split("?")[0]) && (!("helperOnly" in q) || !canManageCompetition(role)))

  if (isLoading || !seasonId) return <PageSkeleton />
  if (error || !data) return <ErrorState message={error?.message} onRetry={() => refetch()} />

  const team = (id: string | null | undefined) => data.teams.find((t) => t.id === id)
  const progress = data.matchesTotal ? Math.round((data.matchesFinished / data.matchesTotal) * 100) : 0
  const bans = index ? activeSuspensions(index.bundle.matches, index.bundle.events) : []

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="Boshqaruv paneli"
        description={`${data.season.year}-yil, ${data.season.name} — ${SEASON_STATUS_LABEL[data.season.status].toLowerCase()}`}
      />
      <ReadOnlyBanner />

      {!readOnly && canEnterResults(role) && data.pendingResults.length > 0 && (
        <div className="mb-5 flex flex-col gap-3 rounded-xl border border-live/30 bg-live/5 p-4 sm:flex-row sm:items-center">
          <TriangleAlert className="size-6 shrink-0 text-live" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-semibold">{data.pendingResults.length} ta o‘yin natijasi kiritilmagan</p>
            <p className="text-sm text-muted-foreground">Bu o‘yinlar vaqti o‘tgan. Natija kiritilgach, jadval avtomatik yangilanadi.</p>
          </div>
          <Button asChild>
            <Link to="/admin/natijalar">Natijalarni kiritish</Link>
          </Button>
        </div>
      )}

      {index && canManageCompetition(role) && data.season.status !== "FINISHED" && <SeasonRoadmap bundle={index.bundle} />}
      {canManageCompetition(role) && data.season.status === "FINISHED" && (
        <section aria-labelledby="next-season-title" className="panel mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <CalendarPlus className="size-6 shrink-0 text-gold-text" aria-hidden="true" />
          <div className="flex-1">
            <h2 id="next-season-title" className="font-semibold">
              Bu mavsum yakunlangan
            </h2>
            <p className="text-sm text-muted-foreground">
              Keyingi mavsumni oching: o‘tgan mavsum jamoalari ro‘yxatda qoladi, kerakligini bitta tugma bilan yangi mavsumga qo‘shasiz.
            </p>
          </div>
          <Button asChild>
            <Link to="/admin/mavsumlar?yangi=1">Yangi mavsum ochish</Link>
          </Button>
        </section>
      )}

      {!readOnly && quick.length > 0 && (
        <section aria-label="Tezkor amallar" className="mb-6 grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
          {quick.map((q) => (
            <Link key={q.to} to={q.to} className="panel flex min-h-24 flex-col justify-between gap-2 p-3 transition-colors hover:border-pitch-300 md:p-4">
              <q.icon className="size-6 text-pitch-600 dark:text-gold-400" aria-hidden="true" />
              <span>
                <span className="block font-semibold leading-tight">{q.label}</span>
                <span className="block text-xs text-muted-foreground">{q.hint}</span>
              </span>
            </Link>
          ))}
        </section>
      )}

      <section aria-label="Mavsum ko‘rsatkichlari" className="mb-6 grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <StatTile label="Jamoalar" value={data.teamsCount} hint={`${data.groupsCount} ta guruh`} />
        <StatTile label="Futbolchilar" value={data.playersCount} />
        <StatTile label="O‘yinlar" value={`${data.matchesFinished}/${data.matchesTotal}`} hint="yakunlangan / jami" />
        <div className="panel p-3 md:p-4">
          <p className="text-xs text-muted-foreground md:text-sm">Mavsum bajarilishi</p>
          <p className="mt-1 font-score text-2xl md:text-3xl">{progress}%</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Mavsum bajarilishi">
            <div className="h-full rounded-full bg-gold" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="panel overflow-hidden" aria-labelledby="today-title">
          <h2 id="today-title" className="border-b border-border px-4 py-3 font-display text-lg">
            Bugungi o‘yinlar
          </h2>
          {data.today.length === 0 ? (
            <EmptyState icon={CalendarPlus} title="Bugun o‘yin yo‘q" />
          ) : (
            <div className="divide-y divide-border">
              {data.today.map((m) => (
                <AdminMatchItem
                  key={m.id}
                  match={m}
                  team={team}
                  action={
                    !readOnly && canEnterResults(role) && m.homeId && m.awayId ? (
                      <Button asChild size="sm" variant={m.status === "FINISHED" ? "outline" : "default"}>
                        <Link to={`/admin/natijalar/${m.id}`}>{m.status === "FINISHED" ? "Tahrirlash" : "Natija"}</Link>
                      </Button>
                    ) : undefined
                  }
                />
              ))}
            </div>
          )}
        </section>

        <section className="panel overflow-hidden" aria-labelledby="audit-title">
          <h2 id="audit-title" className="flex items-center justify-between border-b border-border px-4 py-3 font-display text-lg">
            So‘nggi o‘zgarishlar
            {canOpen(role, "/admin/sozlamalar") && (
              <Link to="/admin/sozlamalar?tab=tarix" className="font-sans text-sm font-semibold text-gold-text hover:underline">
                Hammasi
              </Link>
            )}
          </h2>
          {data.recentAudit.length === 0 ? (
            <EmptyState icon={ScrollText} title="O‘zgarishlar yo‘q" />
          ) : (
            <ul className="divide-y divide-border">
              {data.recentAudit.map((a) => (
                <li key={a.id} className="px-4 py-2.5 text-sm">
                  <p>
                    <span className="mr-1.5 rounded bg-muted px-1.5 py-0.5 text-2xs font-semibold text-muted-foreground">{a.action}</span>
                    {a.summary}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {a.user}, {formatDateTime(a.at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {index && bans.length > 0 && (
          <section className="panel overflow-hidden lg:col-span-2" aria-labelledby="bans-title">
            <h2 id="bans-title" className="flex items-center gap-2 border-b border-border px-4 py-3 font-display text-lg">
              <Ban className="size-5 text-destructive" aria-hidden="true" />
              Diskvalifikatsiyadagi futbolchilar
            </h2>
            <p className="px-4 pt-3 text-sm text-muted-foreground">{SUSPENSION_RULE} Natija kiritishda ular alohida belgilanadi.</p>
            <SuspensionsList index={index} list={bans} />
          </section>
        )}

        <section className="panel overflow-hidden lg:col-span-2" aria-labelledby="upcoming-title">
          <h2 id="upcoming-title" className="flex items-center justify-between border-b border-border px-4 py-3 font-display text-lg">
            Kelgusi o‘yinlar
            {canOpen(role, "/admin/oyinlar") && (
              <Link to="/admin/oyinlar" className="font-sans text-sm font-semibold text-gold-text hover:underline">
                Barcha o‘yinlar
              </Link>
            )}
          </h2>
          {data.upcoming.length === 0 ? (
            <EmptyState icon={CalendarPlus} title="Rejalashtirilgan o‘yinlar yo‘q" />
          ) : (
            <div className="divide-y divide-border">
              {data.upcoming.map((m) => (
                <AdminMatchItem key={m.id} match={m} team={team} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
