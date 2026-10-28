import { BookOpen, CornerDownRight, Info, Network } from "lucide-react"
import { useMemo, useState } from "react"
import { Link } from "react-router"
import { Bracket, BracketMatch, ChampionBanner, nextStepLabel, playoffRounds } from "@/components/league/bracket"
import { EmptyState, ErrorState, PageHeader, PageSkeleton } from "@/components/league/states"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ROUND_LABELS, createBracket, groupFinishes, isPlayInRound, playoffPlan, roundLabel, seedLotsFrom, withPositionLabels } from "@/domain/playoff"
import type { Match, PlayoffRoundKey } from "@/domain/types"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useMyTeam } from "@/hooks/use-my-team"
import { useSeasonData, type SeasonIndex } from "@/hooks/use-season-data"
import { planSummary } from "@/lib/playoff-overview"

/** Telefon uchun: bosqichni tanlab, o'yinlarni ro'yxat ko'rinishida ko'rsatadi; har o'yin ostida g'olib qayerga chiqishi */
function MobileBracket({ matches, index, linkable }: { matches: Match[]; index: SeasonIndex; linkable: boolean }) {
  const { teamId: myTeamId } = useMyTeam()
  const rounds = playoffRounds(matches)
  const withThird: PlayoffRoundKey[] = matches.some((m) => m.playoffRound === "THIRD") ? [...rounds.slice(0, -1), "THIRD", rounds[rounds.length - 1]] : rounds
  const mine = (m: Match) => [m.homeId, m.awayId].some((id) => id && index.team(id)?.teamId === myTeamId)
  // Avval muxlis jamoasining hali o'ynalmagan o'yini, bo'lmasa birinchi tugallanmagan bosqich
  const myOpen = myTeamId ? matches.find((m) => mine(m) && m.status !== "FINISHED") : undefined
  const firstOpen = myOpen?.playoffRound ?? withThird.find((r) => matches.some((m) => m.playoffRound === r && m.status !== "FINISHED")) ?? withThird[withThird.length - 1]
  const [round, setRound] = useState<PlayoffRoundKey>(firstOpen)
  const list = matches.filter((m) => m.playoffRound === round).sort((a, b) => (a.bracketIndex ?? 0) - (b.bracketIndex ?? 0))
  // Telefonda qisqa yorliqlar: 6 tagacha bosqich bitta qatorga sig'adi
  const SHORT: Record<PlayoffRoundKey, string> = { R64: "1/32", R32: "1/16", R16: "1/8", QF: "1/4", SF: "1/2", THIRD: "3-o‘rin", F: "Final" }
  const tabLabel = (r: PlayoffRoundKey) => (isPlayInRound(r, matches) ? "Saralash" : withThird.length > 4 ? SHORT[r] : r === "THIRD" ? "3-o‘rin" : ROUND_LABELS[r])
  return (
    <div>
      <ChampionBanner matches={matches} index={index} />
      <Tabs value={round} onValueChange={(v) => setRound(v as PlayoffRoundKey)}>
        <TabsList className="mb-4 w-full">
          {withThird.map((r) => (
            <TabsTrigger key={r} value={r} aria-controls="playoff-round-panel" aria-label={r === "THIRD" ? "3-o‘rin uchun o‘yin" : roundLabel(r, matches)}>
              {tabLabel(r)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div id="playoff-round-panel" role="tabpanel" aria-label={round === "THIRD" ? "3-o‘rin" : roundLabel(round, matches)}>
        <ol className="space-y-3">
          {list.map((m, i) => {
            const target = nextStepLabel(m, matches)
            return (
              <li key={m.id}>
                {round !== "F" && (
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">
                    {round === "THIRD" ? "3-o‘rin uchun o‘yin" : roundLabel(round, matches)}
                    {list.length > 1 ? `, ${i + 1}-o‘yin` : ""}
                  </p>
                )}
                <BracketMatch match={m} index={index} linkable={linkable} />
                {target && round !== "F" && round !== "THIRD" && (
                  <p className="mt-1 flex items-center gap-1 pl-3 text-xs text-muted-foreground">
                    <CornerDownRight className="size-3.5" aria-hidden="true" />
                    G‘olib: {target}
                  </p>
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

export default function PlayoffPage() {
  const { index, isLoading, error, refetch } = useSeasonData()
  const desktop = useMediaQuery("(min-width: 768px)")

  const data = useMemo(() => {
    if (!index) return null
    const real = index.bundle.matches.filter((m) => m.stage === "PLAYOFF")
    if (real.length > 0) return { matches: real, projected: false, error: undefined, summary: undefined }
    const { groups, standings, season } = index.bundle
    if (groups.length === 0) return { matches: [], projected: true, error: undefined, summary: undefined }
    // Joriy jadvallar bo'yicha: guruh bosqichi tugasa, xuddi shu setka avtomatik tuziladi
    const plan = playoffPlan(groupFinishes(groups, standings, season.rules), seedLotsFrom(index.bundle.lots ?? []))
    if (plan.error) return { matches: [], projected: true, error: plan.error, summary: undefined }
    let n = 0
    const bracket = createBracket({
      seasonId: season.id,
      plan,
      thirdPlace: season.rules.thirdPlaceMatch,
      kickoffFor: () => season.endDate + "T18:00:00+05:00",
      newId: () => `projected-${n++}`,
      // Taxminiy setka: sana hali e'lon qilinmagan
      timeConfirmed: false,
    })
    // Guruh bosqichi tugamaguncha jamoa nomlari emas, guruhdagi o'rinlar ko'rsatiladi
    return { matches: withPositionLabels(bracket, plan), projected: true, error: undefined, summary: planSummary(plan) }
  }, [index])

  if (isLoading && !index) return <PageSkeleton />
  if (error || !index || !data) return <ErrorState message={error?.message} onRetry={() => refetch()} className="container-page" />

  return (
    <div className="container-page pt-5 md:pt-8">
      <PageHeader
        title="Pley-off"
        description={
          data.projected
            ? "Guruh bosqichi yakunlangach pley-off sxemasi tuziladi. G‘olib keyingi bosqichga avtomatik o‘tadi."
            : "G‘olib keyingi bosqichga avtomatik o‘tadi. Durangda qo‘shimcha vaqt va penaltilar natijasi ko‘rsatiladi."
        }
      />
      {data.projected && data.matches.length > 0 && (
        <p className="mb-5 flex items-start gap-2 rounded-xl border border-gold/40 bg-gold-soft px-4 py-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-gold-text" aria-hidden="true" />
          <span>
            Setka hali tuzilmagan: guruh bosqichining barcha o‘yinlari tugagach, jadval bo‘yicha avtomatik tuziladi va o‘rinlarga jamoalar joylashadi. Bir guruh jamoalari birinchi bosqichda uchrashmaydi.
            {data.summary && <span className="mt-1 block font-semibold">{data.summary}</span>}
          </span>
        </p>
      )}
      <p className="mb-5 text-sm">
        <Link to="/nizom#pley-off" className="inline-flex min-h-10 items-center gap-1.5 font-semibold underline-offset-4 hover:underline">
          <BookOpen className="size-4" aria-hidden="true" />
          Pley-off qanday o‘tadi: kim chiqadi, saralash o‘yinlari, durangda nima bo‘ladi
        </Link>
      </p>
      {data.matches.length === 0 ? (
        <div className="panel">
          <EmptyState icon={Network} title="Pley-off sxemasi hali yo‘q" description={data.error ?? "Guruhlar tuzilib, o‘yinlar boshlangach sxema shu yerda ko‘rinadi."} />
        </div>
      ) : desktop ? (
        <div className="panel p-4 md:p-5">
          <Bracket matches={data.matches} index={index} linkable={!data.projected} headingLevel={2} />
        </div>
      ) : (
        <MobileBracket matches={data.matches} index={index} linkable={!data.projected} />
      )}
    </div>
  )
}
