import { ChartColumn } from "lucide-react"
import { useState, type KeyboardEvent } from "react"
import { useVisitStats } from "@/api/hooks"
import type { VisitStats } from "@/api/types"
import { AdminPageHeader, StatTile } from "@/components/admin/admin-ui"
import { EmptyState, ErrorState, PageSkeleton } from "@/components/league/states"
import { niceMax } from "@/lib/chart"
import { formatDate, formatShortDate } from "@/lib/format"
import { cn } from "@/lib/utils"

/** 3215 → «3 215» (o'zbekcha: minglar bo'sh joy bilan; brauzerning til ma'lumotiga bog'liq emas) */
const fmt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")
/** Kun kaliti (YYYY-MM-DD) → Toshkent vaqtidagi tush (sana formatlari shuni kutadi) */
const noon = (day: string) => `${day}T12:00:00+05:00`

const SOURCE_LABEL: Record<string, string> = {
  telegram: "Telegram",
  instagram: "Instagram",
  google: "Google qidiruvi",
  yandex: "Yandex qidiruvi",
  youtube: "YouTube",
  facebook: "Facebook",
  other: "Boshqa saytlar",
  direct: "To‘g‘ridan-to‘g‘ri (manzilni yozib yoki saqlangan havola orqali)",
}
const DEVICE_LABEL: Record<string, string> = { phone: "Telefon", desktop: "Kompyuter" }

/** Grafik ustunlari: yorug' rejimda yashil, tungi rejimda oltin (ikkalasi ham fon bilan 3:1 dan yuqori kontrast) */
const MARK = "bg-pitch-500 dark:bg-gold-600"

/** So'nggi 30 kun: har kun nechta odam kirgan. Ustun ustiga olib borilsa (yoki strelkalar bilan) o'sha kun ko'rinadi */
function DailyChart({ daily }: { daily: VisitStats["daily"] }) {
  const [active, setActive] = useState<number | null>(null)
  const last = daily.length - 1
  const shown = daily[active ?? last]
  const max = niceMax(Math.max(...daily.map((d) => d.visitors)))
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return
    e.preventDefault()
    const from = active ?? last
    const next = e.key === "Home" ? 0 : e.key === "End" ? last : from + (e.key === "ArrowLeft" ? -1 : 1)
    setActive(Math.min(last, Math.max(0, next)))
  }
  return (
    <section className="panel p-4 md:p-5" aria-labelledby="visits-daily">
      <h2 id="visits-daily" className="font-display text-lg">
        Kunlik tashrif buyuruvchilar
      </h2>
      <p className="text-sm text-muted-foreground">So‘nggi 30 kun</p>
      <p className="mt-3 min-h-6 text-sm" aria-live="polite">
        <span className="font-semibold">{active === null || active === last ? "Bugun" : formatDate(noon(shown.day), { weekday: true })}:</span>{" "}
        <strong className="font-score text-md">{fmt(shown.visitors)}</strong> kishi, {fmt(shown.views)} ta sahifa ochilgan
      </p>
      <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
        {/* Y o'qi: 0, o'rtasi va eng kattasi */}
        <div className="relative h-40 w-7 text-right text-xs text-muted-foreground tabular-nums md:h-48" aria-hidden="true">
          <span className="absolute top-0 right-0 -translate-y-1/2">{fmt(max)}</span>
          <span className="absolute top-1/2 right-0 -translate-y-1/2">{fmt(max / 2)}</span>
          <span className="absolute right-0 bottom-0 translate-y-1/2">0</span>
        </div>
        <div
          role="group"
          aria-label="Kunlik grafik: strelkalar bilan kunlar bo‘ylab yuring"
          tabIndex={0}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
          // Telefonda barmoq ko'tarilganda ham tanlangan kun ko'rinib turadi
          onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
          className="relative h-40 rounded-sm outline-offset-4 md:h-48"
        >
          <div className="absolute inset-x-0 top-0 border-t border-border" aria-hidden="true" />
          <div className="absolute inset-x-0 top-1/2 border-t border-border" aria-hidden="true" />
          <div className="absolute inset-x-0 bottom-0 border-t border-border" aria-hidden="true" />
          <div className="relative flex h-full items-end gap-[2px]">
            {daily.map((d, i) => (
              <div
                key={d.day}
                onPointerEnter={() => setActive(i)}
                onPointerDown={() => setActive(i)}
                className="flex h-full min-w-0 flex-1 cursor-default items-end justify-center"
                aria-hidden="true"
              >
                <div
                  className={cn(
                    "w-full max-w-6 rounded-t-[4px] transition-opacity duration-150 motion-reduce:transition-none",
                    MARK,
                    active !== null && active !== i && "opacity-40",
                  )}
                  style={{ height: d.visitors ? `max(${(d.visitors / max) * 100}%, 3px)` : 0 }}
                />
              </div>
            ))}
          </div>
        </div>
        <div />
        <div className="mt-1.5 flex justify-between text-xs text-muted-foreground" aria-hidden="true">
          <span>{formatShortDate(noon(daily[0].day))}</span>
          <span>{formatShortDate(noon(daily[Math.floor(last / 2)].day))}</span>
          <span>Bugun</span>
        </div>
      </div>
      <details className="mt-4 text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-primary dark:text-gold-400">Jadval ko‘rinishida</summary>
        <div className="mt-2 max-h-80 overflow-y-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <caption className="sr-only">So‘nggi 30 kundagi tashriflar</caption>
            <thead className="sticky top-0 bg-card text-left text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-normal">
                  Kun
                </th>
                <th scope="col" className="px-3 py-2 text-right font-normal">
                  Kishi
                </th>
                <th scope="col" className="px-3 py-2 text-right font-normal">
                  Sahifa
                </th>
              </tr>
            </thead>
            <tbody>
              {[...daily].reverse().map((d) => (
                <tr key={d.day} className="border-t border-border">
                  <th scope="row" className="px-3 py-1.5 text-left font-normal">
                    {formatDate(noon(d.day), { weekday: true })}
                  </th>
                  <td className="px-3 py-1.5 text-right tabular-nums">{fmt(d.visitors)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{fmt(d.views)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  )
}

/** Ulushlar ro'yxati: nom, ingichka chiziq va son */
function ShareList({
  id,
  title,
  note,
  rows,
  total = rows.reduce((s, r) => s + r.value, 0),
}: {
  id: string
  title: string
  note: string
  rows: { key: string; label: string; value: number; href?: string }[]
  /** Foiz shu songa nisbatan (berilmasa — ro'yxatdagilar yig'indisi) */
  total?: number
}) {
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <section className="panel p-4 md:p-5" aria-labelledby={id}>
      <h2 id={id} className="font-display text-lg">
        {title}
      </h2>
      <p className="text-sm text-muted-foreground">{note}</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Hali ma’lumot yo‘q.</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {rows.map((r) => (
            <li key={r.key}>
              <div className="flex items-baseline gap-3 text-sm">
                {r.href ? (
                  <a href={r.href} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate underline-offset-2 hover:underline">
                    {r.label}
                  </a>
                ) : (
                  <span className="min-w-0 flex-1">{r.label}</span>
                )}
                <span className="shrink-0 tabular-nums">
                  <strong className="font-semibold">{fmt(r.value)}</strong>
                  <span className="ml-1.5 text-muted-foreground">{Math.round((r.value / total) * 100)}%</span>
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-muted" aria-hidden="true">
                <div className={cn("h-full rounded-full", MARK)} style={{ width: `${(r.value / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

export default function AdminVisitsPage() {
  const { data, isLoading, error, refetch } = useVisitStats()
  if (isLoading) return <PageSkeleton />
  if (error || !data) return <ErrorState message={error?.message} onRetry={() => refetch()} />
  const views = (n: number) => `${fmt(n)} ta sahifa ochilgan`

  return (
    <div className="mx-auto max-w-5xl">
      <AdminPageHeader
        title="Tashriflar"
        description="Saytga necha kishi kirgani. Bir odam kun davomida necha marta kirsa ham bir kishi sanaladi. Robotlar va tizimga kirgan tashkilotchilar sanalmaydi."
      />
      <section className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3" aria-label="Tashrif buyuruvchilar soni">
        <StatTile label="Bugun" value={fmt(data.today.visitors)} hint={views(data.today.views)} />
        <StatTile label="So‘nggi 7 kun" value={fmt(data.week.visitors)} hint={views(data.week.views)} />
        <StatTile label="So‘nggi 30 kun" value={fmt(data.month.visitors)} hint={views(data.month.views)} />
        <StatTile
          label="Jami"
          value={fmt(data.total.visitors)}
          hint={data.since ? `${formatDate(noon(data.since), { year: true })}dan beri` : views(data.total.views)}
        />
      </section>

      {data.total.visitors === 0 ? (
        <div className="panel">
          <EmptyState
            icon={ChartColumn}
            title="Hali tashrif yo‘q"
            description="Sayt internetga chiqqach, muxlislar soni shu yerda kunma-kun ko‘rinadi. Siz tizimga kirgan holda saytni ochsangiz, sanalmaydi."
          />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <DailyChart daily={data.daily} />
          </div>
          <div className="lg:col-span-2">
            <ShareList
              id="visits-pages"
              title="Eng ko‘p ochilgan sahifalar"
              note="So‘nggi 30 kun, necha marta ochilgani"
              rows={data.pages.map((p) => ({ key: p.path, label: p.label, value: p.views, href: p.path }))}
              total={data.month.views}
            />
          </div>
          <ShareList
            id="visits-sources"
            title="Qayerdan kelishdi"
            note="So‘nggi 30 kun, kunlik tashriflar"
            rows={data.sources.map((s) => ({ key: s.key, label: SOURCE_LABEL[s.key] ?? s.key, value: s.visits }))}
          />
          <ShareList
            id="visits-devices"
            title="Qurilmalar"
            note="So‘nggi 30 kun, kunlik tashriflar"
            rows={data.devices.map((s) => ({ key: s.key, label: DEVICE_LABEL[s.key] ?? s.key, value: s.visits }))}
          />
        </div>
      )}
    </div>
  )
}
