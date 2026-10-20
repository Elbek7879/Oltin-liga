import { CalendarX, Megaphone, Trophy } from "lucide-react"
import { useMemo, useState } from "react"
import { Link } from "react-router"
import { useNews } from "@/api/hooks"
import { AboutCard } from "@/components/league/about-card"
import { FeaturedMatch } from "@/components/league/featured-match"
import { MyTeamPanel } from "@/components/league/my-team-panel"
import { MatchRow } from "@/components/league/match-row"
import { RoundTeamTeaser } from "@/components/league/round-team-teaser"
import { ScorersList } from "@/components/league/scorers-list"
import { StandingsTable } from "@/components/league/standings-table"
import { EmptyState, ErrorState, PageSkeleton, SectionHeader } from "@/components/league/states"
import { TeamCrest } from "@/components/league/team-crest"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { qualifiersFor } from "@/domain/playoff"
import { topScorers } from "@/domain/stats"
import { useMyTeam } from "@/hooks/use-my-team"
import type { Match } from "@/domain/types"
import { useSeasonData, type SeasonIndex } from "@/hooks/use-season-data"
import { formatDate, localDateKey, relativeDayLabel } from "@/lib/format"

function groupByDay(matches: Match[]) {
  const days = new Map<string, Match[]>()
  for (const m of matches) {
    const key = localDateKey(m.kickoff)
    days.set(key, [...(days.get(key) ?? []), m])
  }
  return [...days.entries()]
}

function DayList({ matches, index }: { matches: Match[]; index: SeasonIndex }) {
  return (
    <div>
      {groupByDay(matches).map(([day, list]) => (
        <section key={day} aria-label={relativeDayLabel(list[0].kickoff)}>
          <h3 className="border-b border-border bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground md:px-4">
            {relativeDayLabel(list[0].kickoff)}
          </h3>
          <div className="divide-y divide-border">
            {list.map((m) => (
              <MatchRow key={m.id} match={m} index={index} showStage />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function ChampionBanner({ index }: { index: SeasonIndex }) {
  const award = index.bundle.awards.find((a) => a.type === "CHAMPION")
  const team = index.team(award?.seasonTeamId)
  if (!team) return null
  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-gold/40 bg-white/5 px-4 py-3">
      <Trophy className="size-6 text-gold-400" aria-hidden="true" />
      <TeamCrest team={team} size="md" />
      <div className="min-w-0">
        <p className="text-xs text-band-muted">{index.bundle.season.year}-yil chempioni</p>
        <p className="truncate font-display text-xl text-gold-400">{team.name}</p>
      </div>
    </div>
  )
}

export default function HomePage() {
  const { index, isLoading, error, refetch } = useSeasonData()
  const { data: news = [] } = useNews()
  const [group, setGroup] = useState<string>()
  const { teamId: myTeamId } = useMyTeam()

  const view = useMemo(() => {
    if (!index) return null
    const now = Date.now()
    const matches = index.bundle.matches
    const live = matches.filter((m) => m.status === "LIVE")
    const upcoming = matches.filter((m) => m.status === "SCHEDULED" && m.timeConfirmed !== false && Date.parse(m.kickoff) >= now - 3 * 3600_000)
    const finished = matches.filter((m) => m.status === "FINISHED").sort((a, b) => b.kickoff.localeCompare(a.kickoff))
    const final = matches.find((m) => m.playoffRound === "F" && m.status === "FINISHED")
    const featured = live[0] ?? (index.bundle.season.status === "FINISHED" ? final : undefined) ?? upcoming[0] ?? finished[0]
    const eyebrow =
      featured?.status === "SCHEDULED" ? "Keyingi o‘yin" : featured?.playoffRound === "F" ? "Mavsum finali" : "So‘nggi o‘yin"
    const nearest = [...live.filter((m) => m.id !== featured?.id), ...upcoming.filter((m) => m.id !== featured?.id)].slice(0, 6)
    const scorers = topScorers(index.bundle.playerStats, (id) => index.player(id)?.lastName ?? "")
    return { featured, eyebrow, nearest, results: finished.filter((m) => m.id !== featured?.id).slice(0, 6), scorers }
  }, [index])

  if (isLoading && !index) return <PageSkeleton />
  if (error || !index || !view) return <ErrorState message={error?.message} onRetry={() => refetch()} className="container-page" />

  const groups = index.bundle.groups
  const myTeam = index.bundle.teams.find((t) => t.teamId === myTeamId)
  // Muxlis jamoasi tanlangan bo'lsa — avval uning guruhi ochiladi
  const myGroup = myTeam ? index.groupOfTeam(myTeam.id)?.id : undefined
  const activeGroup = group && groups.some((g) => g.id === group) ? group : (myGroup ?? groups[0]?.id)
  const important = news.find((n) => n.important)
  const latestNews = news.filter((n) => n.id !== important?.id).slice(0, 3)

  return (
    <>
      <section aria-labelledby="hero-title" className="bg-band pb-6 text-band-foreground md:pb-8">
        <div className="container-page pt-3 md:pt-5">
          <h1 id="hero-title" className="sr-only">
            Payariq Oltin Ligasi, {index.bundle.season.year}-yil mavsumi
          </h1>
          {index.bundle.season.status === "FINISHED" && <ChampionBanner index={index} />}
          {view.featured ? (
            <FeaturedMatch match={view.featured} index={index} eyebrow={view.eyebrow} />
          ) : (
            <EmptyState icon={CalendarX} title="Hali o‘yinlar belgilanmagan" description="O‘yinlar taqvimi e’lon qilinganda shu yerda ko‘rinadi." />
          )}
        </div>
      </section>

      {important && (
        <div className="container-page mt-4">
          <Link
            to={`/yangiliklar/${important.slug}`}
            className="flex items-start gap-3 rounded-xl border border-gold/40 bg-gold-soft px-4 py-3 transition-colors hover:border-gold"
          >
            <Megaphone className="mt-0.5 size-5 shrink-0 text-gold-text" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-gold-text">Muhim e’lon</span>
              <span className="block font-semibold">{important.title}</span>
            </span>
          </Link>
        </div>
      )}

      <div className="container-page mt-6 grid gap-6 md:mt-8 lg:grid-cols-12 lg:gap-8">
        <div className="space-y-6 lg:col-span-7 xl:col-span-8">
          <MyTeamPanel index={index} />
          <section aria-labelledby="nearest-title">
            <SectionHeader id="nearest-title" title="Eng yaqin o‘yinlar" action={{ label: "Barcha o‘yinlar", to: "/oyinlar" }} />
            <div className="panel overflow-hidden">
              {view.nearest.length > 0 ? (
                <DayList matches={view.nearest} index={index} />
              ) : (
                <EmptyState icon={CalendarX} title="Rejalashtirilgan o‘yinlar yo‘q" description="Yangi o‘yinlar belgilanganda shu yerda paydo bo‘ladi." />
              )}
            </div>
          </section>

          <section aria-labelledby="results-title">
            <SectionHeader id="results-title" title="Oxirgi natijalar" action={{ label: "Barcha natijalar", to: "/oyinlar?tab=natijalar" }} />
            <div className="panel divide-y divide-border overflow-hidden">
              {view.results.length > 0 ? (
                view.results.map((m) => <MatchRow key={m.id} match={m} index={index} showDate showStage />)
              ) : (
                <EmptyState icon={CalendarX} title="Hali natijalar yo‘q" />
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-6 lg:col-span-5 xl:col-span-4" aria-label="Jadval va to‘purarlar">
          <section aria-labelledby="groups-title">
            <SectionHeader id="groups-title" title="Guruhlar jadvali" action={{ label: "To‘liq jadval", to: "/jadval" }} />
            {groups.length > 0 && activeGroup ? (
              <div className="panel overflow-hidden">
                <Tabs value={activeGroup} onValueChange={setGroup} className="gap-0">
                  <div className="border-b border-border px-2 pt-2 pb-2">
                    <TabsList className="w-full">
                      {groups.map((g) => (
                        <TabsTrigger key={g.id} value={g.id} aria-label={`${g.name} guruhi`}>
                          {g.name}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </div>
                  {groups.map((g) => (
                    <TabsContent key={g.id} value={g.id}>
                      <StandingsTable
                        rows={index.bundle.standings[g.id] ?? []}
                        index={index}
                        mode="compact"
                        qualifiers={qualifiersFor(index.bundle.season.rules, (index.bundle.standings[g.id] ?? []).length || g.seasonTeamIds.length)}
                        caption={`${g.name} guruhi jadvali`}
                        highlightTeamId={myTeam?.id}
                      />
                    </TabsContent>
                  ))}
                </Tabs>
                <p className="flex items-center gap-2 border-t border-border px-4 py-2 text-xs text-muted-foreground">
                  <span className="h-3 w-[3px] rounded-full bg-qualify" aria-hidden="true" />
                  Pley-offga chiqish zonasi
                </p>
              </div>
            ) : (
              <div className="panel">
                <EmptyState icon={CalendarX} title="Guruhlar hali tuzilmagan" description="Qur’a o‘tkazilgach jadval shu yerda ko‘rinadi." />
              </div>
            )}
          </section>

          <section aria-labelledby="scorers-title">
            <SectionHeader id="scorers-title" title="To‘purarlar" action={{ label: "To‘liq reyting", to: "/statistika" }} />
            <div className="panel overflow-hidden">
              {view.scorers.length > 0 ? (
                <ScorersList stats={view.scorers} index={index} limit={5} />
              ) : (
                <EmptyState icon={Trophy} title="Hali gol urilmagan" />
              )}
            </div>
          </section>
          <RoundTeamTeaser index={index} />
          <AboutCard />
        </aside>
      </div>

      {(important || latestNews.length > 0) && (
        <section aria-labelledby="news-title" className="container-page mt-8">
          <SectionHeader id="news-title" title="E’lonlar va yangiliklar" action={{ label: "Barcha yangiliklar", to: "/yangiliklar" }} />
          <ul className="grid gap-3 md:grid-cols-3">
            {latestNews.map((n) => (
              <li key={n.id}>
                <Link to={`/yangiliklar/${n.slug}`} className="panel flex h-full flex-col p-4 transition-colors hover:border-pitch-300">
                  <time dateTime={n.publishedAt} className="text-xs text-muted-foreground">
                    {formatDate(n.publishedAt, { year: true })}
                  </time>
                  <span className="mt-1 font-semibold leading-snug">{n.title}</span>
                  <span className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{n.excerpt}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
