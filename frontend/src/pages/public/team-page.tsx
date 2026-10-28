import { ArrowLeft, Ban, Crown, Medal, ScrollText, Shield, Star, Users } from "lucide-react"
import { useMemo, useState } from "react"
import { Link, useParams } from "react-router"
import { useTeamProfile } from "@/api/hooks"
import type { TeamSeasonRecord } from "@/api/types"
import { MatchRow } from "@/components/league/match-row"
import { isNotFound } from "@/api/types"
import { EmptyState, ErrorState, NotFoundState, PageSkeleton } from "@/components/league/states"
import { TeamCrest } from "@/components/league/team-crest"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { activeSuspensions, SUSPENSION_REASON } from "@/domain/discipline"
import { useLeagueMeta } from "@/hooks/use-document-meta"
import { useMyTeam } from "@/hooks/use-my-team"
import { ROUND_LABELS } from "@/domain/playoff"
import { useSeason } from "@/hooks/use-season"
import { buildIndex, useSeasonData } from "@/hooks/use-season-data"
import { POSITION_LABEL } from "@/lib/format"
import { teamMeta } from "@/lib/seo"
import { cn } from "@/lib/utils"

function achievementLabel(r: TeamSeasonRecord) {
  if (r.achievement === "CHAMPION") return "Chempion"
  if (r.achievement === "RUNNER_UP") return "Finalchi (2-o‘rin)"
  if (r.achievement === "THIRD") return "3-o‘rin"
  if (r.stageReached && r.stageReached !== "GROUP") return ROUND_LABELS[r.stageReached]
  if (r.season.status !== "FINISHED") return "Davom etmoqda"
  return "Guruh bosqichi"
}

export default function TeamPage() {
  const { teamId = "" } = useParams()
  const profile = useTeamProfile(teamId)
  const { index } = useSeasonData()
  const { season } = useSeason()
  const [tab, setTab] = useState("tarkib")
  const { teamId: myTeamId, setMyTeam } = useMyTeam()
  const isMine = myTeamId === teamId

  const current = index?.bundle.teams.find((t) => t.teamId === teamId)
  const roster = useMemo(() => {
    if (!index || !current) return []
    return index.bundle.rosters
      .filter((r) => r.seasonTeamId === current.id)
      .map((r) => {
        const p = index.player(r.playerId)!
        const s = index.bundle.playerStats.find((x) => x.playerId === r.playerId && x.seasonTeamId === current.id)
        return { p, number: r.number, s }
      })
      .sort((a, b) => (a.number ?? 99) - (b.number ?? 99))
  }, [index, current])

  // Jamoa o'yinlari bir nechta mavsumdan bo'lishi mumkin — ko'rinish uchun umumiy indeks
  const crossIndex = useMemo(() => {
    if (!profile.data || !index) return undefined
    return buildIndex({ ...index.bundle, teams: [...profile.data.teams, ...index.bundle.teams] })
  }, [profile.data, index])
  useLeagueMeta((league) => (profile.data ? teamMeta(profile.data.team, league) : undefined))

  if (profile.isLoading) return <PageSkeleton />
  if (isNotFound(profile.error))
    return <NotFoundState icon={Shield} title="Jamoa topilmadi" description="Havola eskirgan yoki jamoa o‘chirilgan bo‘lishi mumkin." backTo="/jamoalar" backLabel="Barcha jamoalar" />
  if (profile.error || !profile.data) return <ErrorState message={profile.error?.message} onRetry={() => profile.refetch()} className="container-page" />

  const { team, records, matches } = profile.data
  const seasonMatches = matches.filter((m) => m.seasonId === season?.id).sort((a, b) => a.kickoff.localeCompare(b.kickoff))
  const titles = records.filter((r) => r.achievement === "CHAMPION").length
  const record = records.find((r) => r.season.id === season?.id)
  const captain = current?.captainId ? index?.player(current.captainId) : undefined
  const bans = new Map(
    index && current ? activeSuspensions(index.bundle.matches, index.bundle.events).filter((s) => s.seasonTeamId === current.id).map((s) => [s.playerId, s]) : [],
  )

  return (
    <>
      <section className="bg-band text-band-foreground">
        <div className="container-page pt-3 pb-6 md:pb-8">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Link to="/jamoalar" className="inline-flex min-h-10 items-center gap-1.5 text-sm text-band-muted hover:text-band-foreground">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Jamoalar
            </Link>
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={isMine}
              onClick={() => setMyTeam(isMine ? null : teamId)}
              className={cn("hover:bg-white/10 hover:text-band-foreground", isMine ? "text-gold-400" : "text-band-foreground")}
            >
              <Star className={cn(isMine && "fill-current")} aria-hidden="true" />
              {isMine ? "Mening jamoam" : "Mening jamoam qilish"}
            </Button>
          </div>
          <div className="flex items-center gap-4 md:gap-6">
            <TeamCrest team={team} size="xl" />
            <div className="min-w-0">
              <h1 className="font-display text-3xl [overflow-wrap:anywhere] md:text-5xl">{team.name}</h1>
              <p className="mt-1 text-sm text-band-muted md:text-base">
                {team.village} qishlog‘i{team.founded ? `, ${team.founded}-yildan beri` : ""}
              </p>
              {titles > 0 && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-gold-400 px-2.5 py-0.5 text-xs font-bold text-pitch-900">
                  <Crown className="size-3.5" aria-hidden="true" />
                  {titles} karra chempion
                </p>
              )}
            </div>
          </div>
          {record && (
            <dl className="mt-5 grid grid-cols-5 divide-x divide-white/10 rounded-xl border border-white/10 bg-white/5 text-center">
              {[
                ["O‘yin", record.played],
                ["G‘alaba", record.won],
                ["Durang", record.drawn],
                ["Mag‘lub.", record.lost],
                ["Gollar", `${record.goalsFor}:${record.goalsAgainst}`],
              ].map(([k, v]) => (
                <div key={k} className="px-1 py-2.5">
                  <dt className="truncate text-2xs text-band-muted md:text-xs">{k}</dt>
                  <dd className="font-score text-xl md:text-2xl">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      <div className="container-page mt-5">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4 w-full md:w-auto">
            <TabsTrigger value="tarkib" aria-controls="team-panel" className="flex-1 md:flex-none">Tarkib</TabsTrigger>
            <TabsTrigger value="oyinlar" aria-controls="team-panel" className="flex-1 md:flex-none">O‘yinlar</TabsTrigger>
            <TabsTrigger value="tarix" aria-controls="team-panel" className="flex-1 md:flex-none">Tarix</TabsTrigger>
          </TabsList>
        </Tabs>

        <div id="team-panel" role="tabpanel" aria-label={{ tarkib: "Tarkib", oyinlar: "O‘yinlar", tarix: "Tarix" }[tab]}>
        {tab === "tarkib" &&
          (!current ? (
            <div className="panel">
              <EmptyState icon={Users} title="Bu mavsumda ishtirok etmagan" description="Jamoa tarixini «Tarix» bo‘limida ko‘ring." />
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-12">
              <section className="panel overflow-hidden lg:col-span-8" aria-label="Jamoa tarkibi">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm md:text-base">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th scope="col" className="w-12 py-2 pl-4 text-left font-medium">№</th>
                        <th scope="col" className="py-2 text-left font-medium">Futbolchi</th>
                        <th scope="col" className="py-2 text-left font-medium">Pozitsiya</th>
                        <th scope="col" className="w-12 py-2 text-center font-medium"><abbr title="O‘yinlar" className="no-underline">O‘</abbr></th>
                        <th scope="col" className="w-12 py-2 text-center font-medium">Gol</th>
                        <th scope="col" className="w-14 py-2 pr-4 text-center font-medium">Assist</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roster.map(({ p, number, s }) => (
                        <tr key={p.id} className="border-b border-border last:border-0 hover:bg-row-hover">
                          <td className="py-2 pl-4 font-score text-muted-foreground">{number ?? "—"}</td>
                          <td className="py-2">
                            <Link to={`/futbolchilar/${p.id}`} className="font-medium hover:underline">
                              {p.firstName} {p.lastName}
                            </Link>
                            {current.captainId === p.id && (
                              <span className="ml-1.5 rounded bg-gold-soft px-1 text-2xs font-bold text-gold-text" title="Sardor">
                                C
                              </span>
                            )}
                            {bans.has(p.id) && (
                              <span className="ml-1.5 inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 text-2xs font-semibold text-destructive">
                                <Ban className="size-3" aria-hidden="true" />
                                Keyingi o‘yinda o‘ynamaydi ({SUSPENSION_REASON[bans.get(p.id)!.reason]})
                              </span>
                            )}
                          </td>
                          <td className="py-2 text-muted-foreground">{p.position ? POSITION_LABEL[p.position] : "—"}</td>
                          <td className="py-2 text-center tabular-nums">{s?.appearances ?? 0}</td>
                          <td className={cn("py-2 text-center tabular-nums", (s?.goals ?? 0) > 0 && "font-semibold")}>{s?.goals ?? 0}</td>
                          <td className="py-2 pr-4 text-center tabular-nums">{s?.assists ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <aside className="panel h-fit p-4 lg:col-span-4">
                <h2 className="mb-3 font-display text-lg">Jamoa haqida</h2>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Qishloq</dt><dd className="font-medium">{team.village}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Sardor</dt><dd className="font-medium">{captain ? `${captain.firstName} ${captain.lastName}` : "—"}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Murabbiy</dt><dd className="font-medium">{current.coach ?? "Ko‘rsatilmagan"}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Guruh</dt><dd className="font-medium">{index?.groupOfTeam(current.id)?.name ?? "—"}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Futbolchilar</dt><dd className="font-medium">{roster.length} ta</dd></div>
                </dl>
              </aside>
            </div>
          ))}

        {tab === "oyinlar" && (
          <div className="panel divide-y divide-border overflow-hidden">
            {seasonMatches.length === 0 ? (
              <EmptyState icon={Shield} title="Bu mavsumda o‘yinlar yo‘q" />
            ) : (
              seasonMatches.map((m) => <MatchRow key={m.id} match={m} index={crossIndex} showDate showStage />)
            )}
          </div>
        )}

        {tab === "tarix" && (
          <section className="panel overflow-hidden" aria-label="Mavsumlar tarixi">
            {records.length === 0 ? (
              <EmptyState icon={ScrollText} title="Tarix hali yo‘q" />
            ) : (
              <ul className="divide-y divide-border">
                {records.map((r) => (
                  <li key={r.season.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                    <span className="w-20 font-score text-xl">{r.season.year}</span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("inline-flex items-center gap-1.5 font-semibold", r.achievement === "CHAMPION" && "text-gold-text")}>
                        {r.achievement && <Medal className="size-4" aria-hidden="true" />}
                        {achievementLabel(r)}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {r.groupName ? `${r.groupName} guruhi` : ""}
                        {r.position ? `, ${r.position}-o‘rin` : ""}
                      </span>
                    </span>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {r.played} o‘yin: {r.won} g‘alaba, {r.drawn} durang, {r.lost} mag‘lubiyat; gollar {r.goalsFor}:{r.goalsAgainst}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        </div>
      </div>
    </>
  )
}
