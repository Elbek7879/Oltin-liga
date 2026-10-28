import { ArrowLeft, Printer, TriangleAlert } from "lucide-react"
import { Link, useParams } from "react-router"
import { EmptyState, ErrorState, PageSkeleton } from "@/components/league/states"
import { TeamCrest } from "@/components/league/team-crest"
import { Button } from "@/components/ui/button"
import { suspendedFor } from "@/domain/discipline"
import type { ID, Match, MatchEvent } from "@/domain/types"
import { useSeasonData, type SeasonIndex } from "@/hooks/use-season-data"
import { formatDate, formatTime, seasonLabel } from "@/lib/format"
import { scoreNote, sideName, stageLabel, totalScore } from "@/lib/match"
import { cn } from "@/lib/utils"

/** Tarkib jadvalidagi qatorlar soni: ro'yxatdan tashqari qo'lda yoziladigan bo'sh qatorlar ham bo'ladi */
const ROSTER_ROWS = 16
const EVENT_ROWS = 7

const EVENT_LABEL: Partial<Record<MatchEvent["type"], string>> = {
  GOAL: "Gol",
  PENALTY_GOAL: "Penalti",
  OWN_GOAL: "Avtogol",
  YELLOW: "Sariq",
  SECOND_YELLOW: "2-sariq",
  RED: "Qizil",
}

function Blank({ className }: { className?: string }) {
  return <span className={cn("inline-block min-w-16 border-b border-current/60 align-bottom", className)}>&nbsp;</span>
}

function RosterTable({ match, side, index, finished }: { match: Match; side: "home" | "away"; index: SeasonIndex; finished: boolean }) {
  const teamId = (side === "home" ? match.homeId : match.awayId) as ID
  const team = index.team(teamId)
  const banned = new Set(suspendedFor(match.id, index.bundle.matches, index.bundle.events).map((s) => s.playerId))
  const events = finished ? index.eventsOf(match.id).filter((e) => e.seasonTeamId === teamId) : []
  const roster = index.bundle.rosters
    .filter((r) => r.seasonTeamId === teamId)
    .sort((a, b) => (a.number ?? 99) - (b.number ?? 99))
  // Yakunlangan o'yinda bo'sh qatorlar kerak emas — faqat ro'yxat
  const rows = Array.from({ length: finished && roster.length > 0 ? roster.length : Math.max(ROSTER_ROWS, roster.length) }, (_, i) => roster[i] ?? null)
  const marks = (playerId: ID, types: MatchEvent["type"][]) =>
    events
      .filter((e) => e.playerId === playerId && types.includes(e.type))
      .map((e) => (e.minute ? `${e.minute}′` : "✓"))
      .join(", ")
  const captain = team?.captainId

  return (
    <section className="min-w-0 break-inside-avoid">
      <h2 className="flex items-center gap-2 border-b-2 border-current pb-1 font-display text-lg print:text-base">
        <TeamCrest team={team} size="sm" />
        <span className="min-w-0 truncate">{sideName(match, side, index)}</span>
      </h2>
      <table className="sheet-table mt-1 w-full table-fixed text-xs">
        <thead>
          <tr>
            <th className="w-8">№</th>
            <th className="text-left">Futbolchi</th>
            <th className="w-16">Gol</th>
            <th className="w-10">Sariq</th>
            <th className="w-10">Qizil</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const p = r ? index.player(r.playerId) : null
            const out = r ? banned.has(r.playerId) : false
            return (
              <tr key={r?.playerId ?? `bo'sh-${i}`}>
                <td className="text-center font-score">{r?.number ?? ""}</td>
                <td className="truncate">
                  {p && (
                    <span className={cn(out && "line-through")}>
                      {p.lastName} {p.firstName}
                      {captain === p.id && <b> (K)</b>}
                    </span>
                  )}
                  {out && <span className="ml-1 font-semibold">— diskv.</span>}
                </td>
                <td className="text-center">{r ? marks(r.playerId, ["GOAL", "PENALTY_GOAL"]) : ""}</td>
                <td className="text-center">{r ? marks(r.playerId, ["YELLOW"]) : ""}</td>
                <td className="text-center">{r ? marks(r.playerId, ["RED", "SECOND_YELLOW"]) : ""}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs">
        Jamoa vakili: <Blank className="w-40" /> Imzo: <Blank className="w-20" />
      </p>
    </section>
  )
}

/**
 * O'yin bayonnomasi — A4 varaqqa chop etish uchun.
 * O'yin oldidan: tarkiblar va bo'sh katakchalar (hakam qo'lda to'ldiradi).
 * O'yindan keyin: hisob, gollar va kartochkalar tizimdagi ma'lumotdan to'ldiriladi.
 */
export default function MatchSheetPage() {
  const { matchId = "" } = useParams()
  const { index, isLoading, error, refetch } = useSeasonData()
  if (isLoading && !index) return <PageSkeleton />
  if (error || !index) return <ErrorState message={error?.message} onRetry={() => refetch()} />
  const match = index.bundle.matches.find((m) => m.id === matchId)
  if (!match || !match.homeId || !match.awayId) {
    return (
      <EmptyState
        icon={TriangleAlert}
        title={match ? "Jamoalar hali aniqlanmagan" : "O‘yin topilmadi"}
        description={match ? "Bayonnoma ikkala jamoa ma’lum bo‘lgach tayyorlanadi." : "Bu o‘yin tanlangan mavsumda yo‘q."}
        action={
          <Button asChild variant="outline">
            <Link to="/admin/natijalar">Natijalar ro‘yxati</Link>
          </Button>
        }
      />
    )
  }

  const finished = match.status === "FINISHED"
  const score = finished ? totalScore(match) : null
  const note = scoreNote(match)
  const venue = index.venue(match.venueId)
  const events = finished ? index.eventsOf(match.id) : []
  const eventRows = finished ? events : Array.from({ length: EVENT_ROWS }, () => null)
  const confirmed = match.timeConfirmed !== false
  const playoff = match.stage === "PLAYOFF"

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link to={`/admin/natijalar/${match.id}`} className="inline-flex min-h-10 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Natija kiritish
        </Link>
        <Button onClick={() => window.print()}>
          <Printer aria-hidden="true" />
          Chop etish
        </Button>
      </div>
      <p className="no-print mb-4 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
        {finished
          ? "Bayonnoma tizimga kiritilgan natija bilan to‘ldirilgan. Chop etib, hakam va jamoa vakillariga imzolatib qo‘ying."
          : "O‘yin oldidan chop eting: hakam gollar va kartochkalarni bo‘sh kataklarga yozadi. O‘yindan keyin shu varaqdan natijani tizimga kiriting."}
      </p>

      <article className="sheet rounded-xl border border-border bg-card p-5 text-foreground shadow-sm md:p-8 print:rounded-none print:border-0 print:p-0 print:text-black print:shadow-none">
        <header className="flex items-center gap-3 border-b-2 border-current pb-3">
          <img src="/brand/logo-96.webp" alt="" width={48} height={48} className="size-12" />
          <div className="min-w-0">
            <p className="font-display text-xl leading-tight">Payariq Oltin Ligasi</p>
            <p className="text-xs">
              {seasonLabel(index.bundle.season)}
            </p>
          </div>
          <h1 className="ml-auto text-right font-display text-2xl leading-tight">O‘yin bayonnomasi</h1>
        </header>

        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm md:grid-cols-3 print:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground print:text-black/70">Bosqich</dt>
            <dd className="font-semibold">{stageLabel(match, index)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground print:text-black/70">Sana va vaqt</dt>
            <dd className="font-semibold">{confirmed ? `${formatDate(match.kickoff, { weekday: true, year: true })}, ${formatTime(match.kickoff)}` : <Blank className="w-40" />}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground print:text-black/70">Maydon</dt>
            <dd className="font-semibold">{venue?.name ?? <Blank className="w-40" />}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground print:text-black/70">Bosh hakam</dt>
            <dd className="font-semibold">{match.referee ?? <Blank className="w-40" />}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground print:text-black/70">Yon hakamlar</dt>
            <dd>
              <Blank className="w-40" />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground print:text-black/70">Tomoshabinlar (taxminan)</dt>
            <dd>
              <Blank className="w-24" />
            </dd>
          </div>
        </dl>

        <section className="mt-4 grid grid-cols-[1fr_auto_1fr] print:mt-3 print:py-2 items-center gap-3 rounded-lg border-2 border-current px-4 py-3 text-center" aria-label="Hisob">
          <p className="truncate font-display text-lg">{sideName(match, "home", index)}</p>
          <p className="font-score text-4xl">
            {score ? (
              `${score.home} : ${score.away}`
            ) : (
              <>
                <Blank className="w-12" /> : <Blank className="w-12" />
              </>
            )}
          </p>
          <p className="truncate font-display text-lg">{sideName(match, "away", index)}</p>
          <p className="col-span-3 text-xs">
            {finished ? (
              note ?? "Asosiy vaqtda"
            ) : (
              <>
                1-bo‘lim: <Blank className="w-10" /> : <Blank className="w-10" />
                {playoff && (
                  <>
                    {"   "}Qo‘shimcha vaqt: <Blank className="w-10" /> : <Blank className="w-10" />
                    {"   "}Penaltilar: <Blank className="w-10" /> : <Blank className="w-10" />
                  </>
                )}
              </>
            )}
          </p>
        </section>

        <div className="mt-5 grid gap-6 md:grid-cols-2 print:mt-3 print:grid-cols-2 print:gap-5">
          <RosterTable match={match} side="home" index={index} finished={finished} />
          <RosterTable match={match} side="away" index={index} finished={finished} />
        </div>

        <section className="mt-5 break-inside-avoid print:mt-3">
          <h2 className="border-b-2 border-current pb-1 font-display text-lg print:text-base">Gollar va kartochkalar</h2>
          <table className="sheet-table mt-1 w-full table-fixed text-xs">
            <thead>
              <tr>
                <th className="w-16">Daqiqa</th>
                <th className="w-[30%] text-left">Jamoa</th>
                <th className="text-left">Futbolchi</th>
                <th className="w-20">Turi</th>
              </tr>
            </thead>
            <tbody>
              {finished && events.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-muted-foreground print:text-black/70">
                    Gol va kartochkalar kiritilmagan
                  </td>
                </tr>
              )}
              {eventRows.map((e, i) => {
                const p = e ? index.player(e.playerId) : null
                return (
                  <tr key={e?.id ?? `bo'sh-${i}`}>
                    <td className="text-center font-score">{e?.minute ? `${e.minute}′` : ""}</td>
                    <td className="truncate">{e ? index.team(e.seasonTeamId)?.name : ""}</td>
                    <td className="truncate">{e ? (p ? `${p.lastName} ${p.firstName}` : "Muallif noma’lum") : ""}</td>
                    <td className="text-center">{e ? EVENT_LABEL[e.type] : ""}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>

        <section className="mt-5 break-inside-avoid text-sm print:mt-3">
          <h2 className="font-display text-lg print:text-base">Hakam izohi</h2>
          <div className="mt-1 space-y-5 print:space-y-4">
            <div className="border-b border-current/60" />
            <div className="border-b border-current/60" />
          </div>
          <p className="mt-6 print:mt-4">
            Bosh hakam: <Blank className="w-48" /> Imzo: <Blank className="w-24" />
          </p>
        </section>
      </article>
    </div>
  )
}
