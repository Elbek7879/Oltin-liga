import { ArrowLeft, ImageDown, ListX, Share2 } from "lucide-react"
import { useEffect, useState } from "react"
import { Link, useParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { api } from "@/api/client"
import { useHeadToHead } from "@/api/hooks"
import { FeaturedMatch } from "@/components/league/featured-match"
import { MatchImageDialog, matchImageTitle } from "@/components/league/match-image-dialog"
import { BallIcon, CardIcon } from "@/components/league/icons"
import { EmptyState, ErrorState, NotFoundState, PageSkeleton } from "@/components/league/states"
import { SuspensionsList } from "@/components/league/suspensions-list"
import { TeamCrest } from "@/components/league/team-crest"
import { Button } from "@/components/ui/button"
import type { Match, MatchEvent } from "@/domain/types"
import { useSeasonData, type SeasonIndex } from "@/hooks/use-season-data"
import { useSeason } from "@/hooks/use-season"
import { suspendedFor } from "@/domain/discipline"
import { formatDate, formatShortDate, formatTime, localDateKey, MATCH_STATUS_LABEL, positionShort } from "@/lib/format"
import { sideName, stageLabel, totalScore } from "@/lib/match"
import { cn } from "@/lib/utils"
import { useLeagueMeta } from "@/hooks/use-document-meta"
import { getScript } from "@/hooks/use-script"
import { matchMeta } from "@/lib/seo"
import { toCyrillic } from "@/lib/translit"

function EventIcon({ type }: { type: MatchEvent["type"] }) {
  if (type === "YELLOW") return <CardIcon kind="yellow" />
  if (type === "RED") return <CardIcon kind="red" />
  if (type === "SECOND_YELLOW") return <CardIcon kind="second" />
  return <BallIcon className={cn(type === "OWN_GOAL" && "text-loss")} />
}

const EVENT_NOTE: Partial<Record<MatchEvent["type"], string>> = {
  PENALTY_GOAL: "penalti",
  OWN_GOAL: "avtogol",
  SECOND_YELLOW: "ikkinchi sariq",
}

function Timeline({ match, index }: { match: Match; index: SeasonIndex }) {
  const events = index.eventsOf(match.id)
  if (events.length === 0) {
    return <EmptyState icon={ListX} title="Voqealar kiritilmagan" description="Gollar va kartochkalar natija bilan birga kiritiladi." />
  }
  return (
    <ol className="divide-y divide-border">
      {events.map((e) => {
        const player = index.player(e.playerId)
        const assist = index.player(e.assistId)
        // Avtogol raqib jamoa foydasiga yoziladi — shuning uchun raqib tomonida ko'rsatiladi
        const forHome = e.type === "OWN_GOAL" ? e.seasonTeamId !== match.homeId : e.seasonTeamId === match.homeId
        const team = index.team(e.seasonTeamId)
        return (
          <li key={e.id} className={cn("flex items-center gap-3 px-3 py-2.5 md:px-4", !forHome && "md:flex-row-reverse md:text-right")}>
            <span className="w-9 shrink-0 font-score text-md text-muted-foreground md:text-center">{e.minute ? `${e.minute}′` : "—"}</span>
            <span className="flex w-5 shrink-0 justify-center">
              <EventIcon type={e.type} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">
                {player ? (
                  <Link to={`/futbolchilar/${player.id}`} className="hover:underline">
                    {player.firstName} {player.lastName}
                  </Link>
                ) : (
                  "Muallif ko‘rsatilmagan"
                )}
                {EVENT_NOTE[e.type] && <span className="font-normal text-muted-foreground"> ({EVENT_NOTE[e.type]})</span>}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                <span className="md:hidden">{team?.name}</span>
                {assist && (
                  <>
                    <span className="md:hidden">, </span>assist: {assist.firstName} {assist.lastName}
                  </>
                )}
              </span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function Lineups({ match, index }: { match: Match; index: SeasonIndex }) {
  const apps = index.bundle.appearances.filter((a) => a.matchId === match.id)
  if (apps.length === 0) return <p className="px-4 py-6 text-sm text-muted-foreground">O‘yinda qatnashgan futbolchilar kiritilmagan.</p>
  return (
    <div className="grid gap-px bg-border sm:grid-cols-2">
      {(["home", "away"] as const).map((side) => {
        const teamId = side === "home" ? match.homeId : match.awayId
        const list = apps
          .filter((a) => a.seasonTeamId === teamId)
          .map((a) => index.player(a.playerId)!)
          .filter(Boolean)
          .sort((a, b) => (index.numberOf(a.id) ?? 99) - (index.numberOf(b.id) ?? 99))
        return (
          <div key={side} className="bg-card">
            <p className="flex items-center gap-2 border-b border-border px-4 py-2 text-sm font-semibold">
              <TeamCrest team={index.team(teamId)} size="xs" />
              {sideName(match, side, index)}
            </p>
            <ul className="px-4 py-2 text-sm">
              {list.map((p) => (
                <li key={p.id} className="flex items-center gap-2 py-1">
                  <span className="w-6 text-right font-score text-muted-foreground">{index.numberOf(p.id) ?? ""}</span>
                  <Link to={`/futbolchilar/${p.id}`} className="truncate hover:underline">
                    {p.firstName} {p.lastName}
                  </Link>
                  <span className="ml-auto text-xs text-muted-foreground">{positionShort(p.position)}</span>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

function HeadToHeadPanel({ match, index }: { match: Match; index: SeasonIndex }) {
  const home = index.team(match.homeId)
  const away = index.team(match.awayId)
  const { data } = useHeadToHead(home?.teamId, away?.teamId)
  if (!home || !away) return null
  const list = (data?.matches ?? []).filter((m) => m.id !== match.id)
  const teamOf = (stId: string | null) => data?.teams.find((t) => t.id === stId)
  let homeWins = 0
  let draws = 0
  let awayWins = 0
  for (const m of list) {
    const winner = m.winnerId ? teamOf(m.winnerId)?.teamId : null
    if (!winner) draws++
    else if (winner === home.teamId) homeWins++
    else awayWins++
  }
  return (
    <section className="panel overflow-hidden" aria-labelledby="h2h-title">
      <h2 id="h2h-title" className="border-b border-border px-4 py-3 font-display text-lg">
        O‘zaro o‘yinlar
      </h2>
      {list.length === 0 ? (
        <p className="px-4 py-5 text-sm text-muted-foreground">Bu jamoalar avval rasmiy o‘yinda uchrashmagan.</p>
      ) : (
        <>
          <dl className="grid grid-cols-3 border-b border-border text-center">
            <div className="px-2 py-3">
              <dt className="truncate text-xs text-muted-foreground">{home.name}</dt>
              <dd className="font-score text-2xl">{homeWins}</dd>
            </div>
            <div className="border-x border-border px-2 py-3">
              <dt className="text-xs text-muted-foreground">Durang</dt>
              <dd className="font-score text-2xl">{draws}</dd>
            </div>
            <div className="px-2 py-3">
              <dt className="truncate text-xs text-muted-foreground">{away.name}</dt>
              <dd className="font-score text-2xl">{awayWins}</dd>
            </div>
          </dl>
          <ul className="divide-y divide-border text-sm">
            {list.slice(0, 5).map((m) => {
              const t = totalScore(m)
              return (
                <li key={m.id} className="flex items-center gap-2 px-4 py-2">
                  <span className="w-[4.5rem] shrink-0 text-xs text-muted-foreground">{formatShortDate(m.kickoff)} {localDateKey(m.kickoff).slice(0, 4)}</span>
                  <span className="min-w-0 flex-1 truncate text-right">{teamOf(m.homeId)?.name}</span>
                  <span className="shrink-0 rounded bg-muted px-1.5 font-score">
                    {t?.home}:{t?.away}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{teamOf(m.awayId)?.name}</span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}

async function share(match: Match, index: SeasonIndex) {
  const t = totalScore(match)
  const home = sideName(match, "home", index)
  const away = sideName(match, "away", index)
  const text = t ? `${home} ${t.home}:${t.away} ${away} — Payariq Oltin Ligasi` : `${home} — ${away}, ${formatDate(match.kickoff)} ${formatTime(match.kickoff)}`
  const url = window.location.href
  try {
    if (navigator.share) {
      await navigator.share({ title: getScript() === "cyrl" ? toCyrillic("Payariq Oltin Ligasi") : "Payariq Oltin Ligasi", text: getScript() === "cyrl" ? toCyrillic(text) : text, url })
      return
    }
    await navigator.clipboard.writeText(`${getScript() === "cyrl" ? toCyrillic(text) : text}\n${url}`)
    toast.success("Havola nusxalandi")
  } catch (err) {
    if ((err as Error).name !== "AbortError") toast.error("Ulashib bo‘lmadi. Havolani brauzer manzil satridan nusxalang.")
  }
}

export default function MatchPage() {
  const { matchId = "" } = useParams()
  const { index, isLoading, error, refetch } = useSeasonData()
  const [imageOpen, setImageOpen] = useState(false)
  const match = index?.bundle.matches.find((m) => m.id === matchId)
  // Serverdagidek: jamoa hali aniqlanmagan bo'lsa (pley-off) — «Pley-off o‘yini»
  const teamName = (id: Match["homeId"]) => index?.team(id)?.name ?? null
  useLeagueMeta((league) => (match ? matchMeta(match, teamName(match.homeId), teamName(match.awayId), league) : undefined))

  // O'yin tanlangan mavsumda bo'lmasa (masalan, Telegram'dagi o'tgan mavsum havolasi), u qaysi mavsumniki ekani
  // aniqlanadi va shu mavsumga o'tiladi. Tanlov brauzerda saqlanmaydi — muxlisning odatdagi mavsumi o'zgarmaydi.
  const { setSeasonId } = useSeason()
  const owner = useQuery({
    queryKey: ["match-season", matchId],
    queryFn: () => api.getMatchSeason(matchId),
    enabled: Boolean(index) && !match && Boolean(matchId),
    retry: false,
    staleTime: Infinity,
  })
  const ownerSeasonId = owner.data?.seasonId
  const shownSeasonId = index?.bundle.season.id
  useEffect(() => {
    if (ownerSeasonId && shownSeasonId && ownerSeasonId !== shownSeasonId) setSeasonId(ownerSeasonId, { persist: false })
  }, [ownerSeasonId, shownSeasonId, setSeasonId])

  if (isLoading && !index) return <PageSkeleton />
  if (error || !index) return <ErrorState message={error?.message} onRetry={() => refetch()} className="container-page" />
  if (!match && (owner.isPending || (ownerSeasonId && ownerSeasonId !== shownSeasonId))) return <PageSkeleton />
  if (!match) {
    return (
      <NotFoundState
        icon={ListX}
        title="O‘yin topilmadi"
        description="Havola eskirgan yoki o‘yin o‘chirilgan bo‘lishi mumkin. O‘yinlar ro‘yxatidan kerakli o‘yinni toping."
        backTo="/oyinlar"
        backLabel="O‘yinlar ro‘yxati"
      />
    )
  }
  const venue = index.venue(match.venueId)
  const banned = suspendedFor(match.id, index.bundle.matches, index.bundle.events)
  const info: [string, string][] = [
    ["Bosqich", stageLabel(match, index)],
    ["Sana", match.timeConfirmed === false ? "Tez orada e’lon qilinadi" : formatDate(match.kickoff, { weekday: true, year: true })],
    ["Boshlanish vaqti", match.timeConfirmed === false ? "Belgilanmagan" : formatTime(match.kickoff)],
    ["Maydon", venue ? [venue.name, venue.village].filter(Boolean).join(", ") : "Belgilanmagan"],
    ["Hakam", match.referee ?? "Belgilanmagan"],
    ["Holati", MATCH_STATUS_LABEL[match.status]],
  ]
  const played = match.status === "FINISHED" || match.status === "LIVE"

  return (
    <>
      <section className="bg-band pb-6 text-band-foreground md:pb-8">
        <div className="container-page pt-3 md:pt-5">
          <div className="mb-3 flex items-center justify-between">
            <Link to="/oyinlar" className="inline-flex min-h-10 items-center gap-1.5 rounded-md text-sm text-band-muted hover:text-band-foreground">
              <ArrowLeft className="size-4" aria-hidden="true" />
              O‘yinlar
            </Link>
            <div className="flex gap-1">
              {match.homeId && match.awayId && match.status !== "CANCELLED" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setImageOpen(true)}
                  className="text-band-foreground hover:bg-white/10 hover:text-band-foreground"
                >
                  <ImageDown aria-hidden="true" />
                  {matchImageTitle(match)}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => share(match, index)}
                className="text-band-foreground hover:bg-white/10 hover:text-band-foreground"
              >
                <Share2 aria-hidden="true" />
                Ulashish
              </Button>
            </div>
          </div>
          <h1 className="sr-only">
            {sideName(match, "home", index)} — {sideName(match, "away", index)}
          </h1>
          <FeaturedMatch match={match} index={index} eyebrow={MATCH_STATUS_LABEL[match.status]} showLink={false} />
        </div>
      </section>

      <div className="container-page mt-6 grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          {match.note && (
            <p className="rounded-xl border border-gold/40 bg-gold-soft px-4 py-3 text-sm">{match.note}</p>
          )}
          {played && (
            <section className="panel overflow-hidden" aria-labelledby="events-title">
              <h2 id="events-title" className="flex items-center justify-between border-b border-border px-4 py-3 font-display text-lg">
                O‘yin voqealari
                <span className="hidden gap-6 font-sans text-xs font-normal text-muted-foreground md:flex">
                  <span>{sideName(match, "home", index)}</span>
                  <span>{sideName(match, "away", index)}</span>
                </span>
              </h2>
              <Timeline match={match} index={index} />
            </section>
          )}
          {played && (
            <section className="panel overflow-hidden" aria-labelledby="lineups-title">
              <h2 id="lineups-title" className="border-b border-border px-4 py-3 font-display text-lg">
                Tarkiblar
              </h2>
              <Lineups match={match} index={index} />
            </section>
          )}
          {!played && (
            <div className="panel">
              <EmptyState icon={ListX} title="O‘yin hali boshlanmagan" description="Natija va voqealar o‘yin davomida va yakunida shu yerda paydo bo‘ladi." />
            </div>
          )}
          {!played && banned.length > 0 && (
            <section className="panel overflow-hidden" aria-labelledby="bans-title">
              <h2 id="bans-title" className="border-b border-border px-4 py-3 font-display text-lg">
                Bu o‘yinda o‘ynamaydi
              </h2>
              <SuspensionsList index={index} list={banned} />
            </section>
          )}
        </div>
        <aside className="space-y-6 lg:col-span-4">
          <section className="panel" aria-labelledby="info-title">
            <h2 id="info-title" className="border-b border-border px-4 py-3 font-display text-lg">
              O‘yin haqida
            </h2>
            <dl className="divide-y divide-border text-sm">
              {info.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
          <HeadToHeadPanel match={match} index={index} />
        </aside>
      </div>
      <MatchImageDialog match={match} index={index} open={imageOpen} onOpenChange={setImageOpen} />
    </>
  )
}
