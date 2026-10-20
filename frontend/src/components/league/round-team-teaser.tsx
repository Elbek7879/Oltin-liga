import { useMemo } from "react"
import { Link } from "react-router"
import { PlayerSilhouette } from "@/components/league/round-team-pitch"
import { SectionHeader } from "@/components/league/states"
import type { RoundTeamSlotKey } from "@/domain/types"
import type { SeasonIndex } from "@/hooks/use-season-data"
import { publishedRoundTeams } from "@/lib/round-team-view"

/** Tarkib tartibida: darvozabondan hujumchigacha */
const LINEUP: RoundTeamSlotKey[] = ["GK", "DF", "MF_L", "MF_R", "FW"]

/** Bosh sahifadagi blok: oxirgi e'lon qilingan ramziy jamoa (e'lon qilinmagan bo'lsa ko'rinmaydi) */
export function RoundTeamTeaser({ index }: { index: SeasonIndex }) {
  const latest = useMemo(() => publishedRoundTeams(index)[0], [index])
  if (!latest) return null
  const to = `/ramziy-jamoa?tur=${latest.slug}`
  return (
    <section aria-labelledby="rt-teaser-title">
      <SectionHeader id="rt-teaser-title" title={`${latest.label} ramziy jamoasi`} action={{ label: "Barcha turlar", to }} />
      <Link
        to={to}
        aria-label={`${latest.label} ramziy jamoasini ko‘rish`}
        className="block rounded-2xl border border-[#d9b13f]/40 bg-[linear-gradient(180deg,#0f3d2d,#0a2b20)] px-2 py-4 text-white transition-colors duration-150 hover:border-[#d9b13f]/80"
      >
        <ul className="grid grid-cols-5 gap-1">
          {LINEUP.map((slot) => {
            const p = latest.players[slot]
            if (!p) return <li key={slot} />
            return (
              <li key={slot} className="min-w-0 text-center">
                <span className="mx-auto block size-12 rounded-full bg-[conic-gradient(from_200deg,#a8821f,#f0cf6a,#d9b13f,#f0cf6a,#a8821f)] p-[2px] md:size-14">
                  <span className="grid size-full place-items-end overflow-hidden rounded-full bg-[radial-gradient(circle_at_50%_35%,#1d5440,#0b2a1f)] text-pitch-300/80">
                    {p.photoUrl ? <img src={p.photoUrl} alt="" className="size-full object-cover object-[50%_25%]" loading="lazy" /> : <PlayerSilhouette className="size-[92%]" />}
                  </span>
                </span>
                <span className="font-display mt-1.5 block truncate text-sm leading-tight">{p.lastName}</span>
                <span className="block truncate text-2xs leading-tight text-gold-300">{p.team?.name}</span>
              </li>
            )
          })}
        </ul>
      </Link>
    </section>
  )
}
