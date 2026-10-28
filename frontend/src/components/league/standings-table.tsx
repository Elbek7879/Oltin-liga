import { Link } from "react-router"
import type { StandingRow } from "@/domain/standings"
import type { FormResult } from "@/domain/types"
import type { SeasonIndex } from "@/hooks/use-season-data"
import { cn } from "@/lib/utils"
import { TeamCrest } from "./team-crest"

const FORM_STYLE: Record<FormResult, { label: string; short: string; className: string }> = {
  W: { label: "G‘alaba", short: "G", className: "bg-win text-white" },
  D: { label: "Durang", short: "D", className: "bg-draw text-white" },
  L: { label: "Mag‘lubiyat", short: "M", className: "bg-loss text-white" },
}

export function FormBadges({ form }: { form: FormResult[] }) {
  if (form.length === 0) return <span className="text-muted-foreground">—</span>
  return (
    <span className="inline-flex gap-1">
      {form.map((f, i) => (
        <span
          key={i}
          title={FORM_STYLE[f].label}
          className={cn("inline-flex size-[18px] items-center justify-center rounded-[5px] text-2xs font-bold", FORM_STYLE[f].className)}
        >
          <span aria-hidden="true">{FORM_STYLE[f].short}</span>
          <span className="sr-only">{FORM_STYLE[f].label}</span>
        </span>
      ))}
    </span>
  )
}

const COLUMNS = [
  { key: "played", short: "O‘", full: "O‘yinlar", compact: true },
  { key: "won", short: "G‘", full: "G‘alaba", compact: false },
  { key: "drawn", short: "D", full: "Durang", compact: false },
  { key: "lost", short: "M", full: "Mag‘lubiyat", compact: false },
  { key: "goalsFor", short: "UG", full: "Urilgan gollar", compact: false },
  { key: "goalsAgainst", short: "O‘G", full: "O‘tkazilgan gollar", compact: false },
  { key: "goalDiff", short: "TF", full: "To‘plar farqi", compact: true },
] as const

/**
 * Turnir jadvali. "compact" — telefon va bosh sahifa uchun (O‘, TF, Och),
 * "full" — barcha ustunlar. Telefonda to'liq jadval faqat o'z ichida suriladi.
 */
export function StandingsTable({
  rows,
  index,
  mode = "full",
  qualifiers = 0,
  caption,
  highlightTeamId,
}: {
  rows: StandingRow[]
  index: SeasonIndex
  mode?: "compact" | "full"
  qualifiers?: number
  caption?: string
  highlightTeamId?: string
}) {
  const cols = mode === "compact" ? COLUMNS.filter((c) => c.compact) : COLUMNS
  return (
    <div className={cn(mode === "full" && "overflow-x-auto overscroll-x-contain")}>
      <table className={cn("w-full border-collapse text-sm md:text-base", mode === "full" && "min-w-[640px]")}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th scope="col" className="sticky left-0 z-10 w-9 bg-card py-2 pl-3 text-left font-medium md:pl-4">
              <abbr title="O‘rin" className="no-underline">#</abbr>
            </th>
            <th scope="col" className="sticky left-9 z-10 bg-card py-2 pr-2 text-left font-medium">
              Jamoa
            </th>
            {cols.map((c) => (
              <th key={c.key} scope="col" className="w-10 px-1 py-2 text-center font-medium">
                <abbr title={c.full} className="no-underline">
                  {c.short}
                </abbr>
              </th>
            ))}
            <th scope="col" className="w-11 px-1 py-2 text-center font-semibold text-foreground">
              <abbr title="Ochko" className="no-underline">
                Och
              </abbr>
            </th>
            {mode === "full" && (
              <th scope="col" className="w-[118px] py-2 pr-4 pl-2 text-left font-medium">
                Shakl
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const team = index.team(row.seasonTeamId)
            const qualifies = row.position <= qualifiers && row.played > 0
            const highlighted = highlightTeamId === row.seasonTeamId
            return (
              <tr
                key={row.seasonTeamId}
                className={cn("border-b border-border last:border-b-0", highlighted ? "bg-gold-soft" : "hover:bg-row-hover")}
              >
                <td
                  className={cn(
                    "sticky left-0 z-10 py-2.5 pl-3 font-score text-md md:pl-4",
                    highlighted ? "bg-gold-soft" : "bg-card",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={cn("h-5 w-[3px] rounded-full", qualifies ? (row.position === 1 ? "bg-gold" : "bg-qualify") : "bg-transparent")}
                    />
                    {row.position}
                    {qualifies && <span className="sr-only">, pley-off zonasida</span>}
                  </span>
                </td>
                <td className={cn("sticky left-9 z-10 py-2 pr-2", highlighted ? "bg-gold-soft" : "bg-card")}>
                  <Link
                    to={team ? `/jamoalar/${team.teamId}` : "#"}
                    // -my-2 py-2: bosiladigan joy katakning butun balandligi, qator balandligi o'zgarmaydi
                    className="-my-2 flex min-w-0 items-center gap-2 rounded-sm py-2 font-medium hover:underline"
                  >
                    <TeamCrest team={team} size="sm" />
                    <span className="truncate">{team?.name}</span>
                    {row.unresolvedTie && (
                      <span className="text-2xs text-muted-foreground" title="Mezonlar bo‘yicha teng — qur’a kerak">
                        *
                      </span>
                    )}
                  </Link>
                </td>
                {cols.map((c) => (
                  <td key={c.key} className="px-1 py-2 text-center tabular-nums text-muted-foreground">
                    {c.key === "goalDiff" && row.goalDiff > 0 ? `+${row.goalDiff}` : row[c.key]}
                  </td>
                ))}
                <td data-col="points" className="px-1 py-2 text-center font-score text-md">
                  {row.points}
                  {row.adjustment !== 0 && (
                    <sup className="ml-0.5 text-2xs font-semibold text-loss" title="Jarima yoki bonus ochkolari">
                      {row.adjustment > 0 ? `+${row.adjustment}` : row.adjustment}
                    </sup>
                  )}
                </td>
                {mode === "full" && (
                  <td className="py-2 pr-4 pl-2">
                    <FormBadges form={row.form} />
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
