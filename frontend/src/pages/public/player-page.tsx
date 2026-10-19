import { ArrowLeft, Award } from "lucide-react"
import { Link, useParams } from "react-router"
import { usePlayerProfile } from "@/api/hooks"
import { ErrorState, PageSkeleton } from "@/components/league/states"
import { TeamCrest } from "@/components/league/team-crest"
import type { AwardType } from "@/domain/types"
import { positionLabel } from "@/lib/format"

const AWARD_LABEL: Partial<Record<AwardType, string>> = {
  TOP_SCORER: "Mavsumning eng yaxshi to‘purari",
  BEST_PLAYER: "Mavsumning eng yaxshi futbolchisi",
  BEST_GOALKEEPER: "Mavsumning eng yaxshi darvozaboni",
}

export default function PlayerPage() {
  const { playerId = "" } = useParams()
  const { data, isLoading, error, refetch } = usePlayerProfile(playerId)
  if (isLoading) return <PageSkeleton />
  if (error || !data) return <ErrorState message={error?.message} onRetry={() => refetch()} className="container-page" />

  const { player, records, awards } = data
  const latest = records[0]
  const totals = records.reduce(
    (acc, r) => ({
      apps: acc.apps + r.stats.appearances,
      goals: acc.goals + r.stats.goals,
      assists: acc.assists + r.stats.assists,
      yellow: acc.yellow + r.stats.yellow,
      red: acc.red + r.stats.red,
    }),
    { apps: 0, goals: 0, assists: 0, yellow: 0, red: 0 },
  )
  const initials = `${player.firstName[0]}${player.lastName[0]}`

  return (
    <>
      <section className="bg-band text-band-foreground">
        <div className="container-page pt-3 pb-6 md:pb-8">
          <Link to="/futbolchilar" className="mb-3 inline-flex min-h-10 items-center gap-1.5 text-sm text-band-muted hover:text-band-foreground">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Futbolchilar
          </Link>
          <div className="flex items-center gap-4">
            <span className="flex size-16 shrink-0 items-center justify-center rounded-full border-2 border-gold-400 font-display text-2xl text-gold-400 md:size-20 md:text-3xl" aria-hidden="true">
              {initials}
            </span>
            <div className="min-w-0">
              <h1 className="truncate font-display text-3xl md:text-5xl">
                {player.firstName} {player.lastName}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-band-muted md:text-base">
                <span>{positionLabel(player.position)}</span>
                {player.birthYear && <span>{player.birthYear}-yilda tug‘ilgan</span>}
                {latest && (
                  <span className="inline-flex items-center gap-1.5">
                    <TeamCrest team={latest.team} size="xs" />
                    {latest.team.name}
                    {latest.number ? `, ${latest.number}-raqam` : ""}
                  </span>
                )}
              </p>
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-5 divide-x divide-white/10 rounded-xl border border-white/10 bg-white/5 text-center">
            {[
              ["O‘yin", totals.apps],
              ["Gol", totals.goals],
              ["Assist", totals.assists],
              ["Sariq", totals.yellow],
              ["Qizil", totals.red],
            ].map(([k, v]) => (
              <div key={k} className="px-1 py-2.5">
                <dt className="text-2xs text-band-muted md:text-xs">{k}</dt>
                <dd className="font-score text-xl md:text-2xl">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-band-muted">Barcha mavsumlar bo‘yicha jami</p>
        </div>
      </section>

      <div className="container-page mt-6 grid gap-5 lg:grid-cols-12">
        <section className="panel overflow-hidden lg:col-span-8" aria-labelledby="career-title">
          <h2 id="career-title" className="border-b border-border px-4 py-3 font-display text-lg">
            Mavsumlar bo‘yicha
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm md:text-base">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th scope="col" className="py-2 pl-4 text-left font-medium">Mavsum</th>
                  <th scope="col" className="py-2 text-left font-medium">Jamoa</th>
                  <th scope="col" className="w-12 py-2 text-center font-medium">O‘yin</th>
                  <th scope="col" className="w-12 py-2 text-center font-medium">Gol</th>
                  <th scope="col" className="w-14 py-2 text-center font-medium">Assist</th>
                  <th scope="col" className="w-20 py-2 pr-4 text-center font-medium">Kartochka</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.season.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 pl-4 font-score text-md">{r.season.year}</td>
                    <td className="py-2.5">
                      <Link to={`/jamoalar/${r.team.teamId}`} className="inline-flex items-center gap-2 font-medium hover:underline">
                        <TeamCrest team={r.team} size="xs" />
                        {r.team.name}
                      </Link>
                    </td>
                    <td className="py-2.5 text-center tabular-nums">{r.stats.appearances}</td>
                    <td className="py-2.5 text-center font-semibold tabular-nums">{r.stats.goals}</td>
                    <td className="py-2.5 text-center tabular-nums">{r.stats.assists}</td>
                    <td className="py-2.5 pr-4 text-center tabular-nums">
                      {r.stats.yellow} / {r.stats.red}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {records.length > 1 && new Set(records.map((r) => r.team.teamId)).size > 1 && (
            <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
              Futbolchi mavsumlar orasida jamoa almashtirgan. Har bir mavsum statistikasi o‘sha jamoa uchun saqlanadi.
            </p>
          )}
        </section>
        <aside className="panel h-fit p-4 lg:col-span-4" aria-labelledby="awards-title">
          <h2 id="awards-title" className="mb-3 font-display text-lg">
            Mukofotlar
          </h2>
          {awards.length === 0 ? (
            <p className="text-sm text-muted-foreground">Hozircha shaxsiy mukofotlar yo‘q.</p>
          ) : (
            <ul className="space-y-2">
              {awards.map((a) => (
                <li key={a.id} className="flex items-start gap-2 text-sm">
                  <Award className="mt-0.5 size-4 text-gold-text" aria-hidden="true" />
                  <span>
                    <span className="font-semibold">{AWARD_LABEL[a.type] ?? "Mukofot"}</span>
                    <span className="block text-xs text-muted-foreground">
                      {a.season.year}-yil{a.note ? `, ${a.note}` : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </>
  )
}
