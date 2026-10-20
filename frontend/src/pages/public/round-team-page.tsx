import { CalendarDays, Download, MapPin, Shirt } from "lucide-react"
import { useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { ImageShareDialog } from "@/components/league/image-share-dialog"
import { GoalBalls, PlayerSilhouette, RoundTeamPitch, statLine } from "@/components/league/round-team-pitch"
import { EmptyState, ErrorState, PageHeader, PageSkeleton } from "@/components/league/states"
import { TeamCrest } from "@/components/league/team-crest"
import { Button } from "@/components/ui/button"
import { ROUND_TEAM_SLOTS } from "@/domain/round-team"
import { useScript } from "@/hooks/use-script"
import { useSeasonData, type SeasonIndex } from "@/hooks/use-season-data"
import { publishedRoundTeams, type PublishedRoundTeam } from "@/lib/round-team-view"
import { renderRoundTeamImage, roundTeamCaption, roundTeamFileName, roundTeamImageData, roundTeamImageInCyrillic } from "@/lib/round-team-image"
import { cn } from "@/lib/utils"

/** Maydon ustidagi sarlavha: katta oltin tur raqami, pley-offda bosqich nomi */
function Lockup({ item }: { item: PublishedRoundTeam }) {
  const group = item.team.stage === "GROUP"
  return (
    <div className="flex items-end gap-3 px-1 pb-3 md:pb-4">
      {group && (
        <span className="font-score text-[5.5rem] leading-[0.74] text-gold-300 [font-stretch:62%] [text-shadow:0_6px_24px_rgb(217_177_63/0.35)] md:text-[7rem]" aria-hidden="true">
          {item.team.round}
        </span>
      )}
      <div className="min-w-0 pb-0.5">
        <p className="font-display text-xl leading-none text-gold-300 md:text-2xl" aria-hidden={group || undefined}>
          {group ? "-tur" : item.label}
        </p>
        <h2 id="rt-title" className="font-display mt-1 text-3xl leading-none md:text-4xl">
          <span className="sr-only">{item.label} </span>
          Ramziy jamoa
        </h2>
        {item.dates && <p className="mt-1.5 text-sm text-band-muted">{item.dates} o‘yinlarining eng yaxshi futbolchilari</p>}
      </div>
    </div>
  )
}

/** Futbolchilar ro'yxati: maydondagi tartibda, har biri o'z sahifasiga havola */
function PlayerList({ item }: { item: PublishedRoundTeam }) {
  return (
    <ol className="divide-y divide-border">
      {ROUND_TEAM_SLOTS.map(({ key, fullLabel }) => {
        const p = item.players[key]
        if (!p) return null
        const stats = statLine(p)
        return (
          <li key={key}>
            <Link to={`/futbolchilar/${p.playerId}`} className="flex min-h-16 items-center gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-row-hover">
              <span className="relative grid size-12 shrink-0 place-items-end overflow-hidden rounded-full bg-[radial-gradient(circle_at_50%_35%,#1d5440,#0b2a1f)] text-pitch-300/80 ring-2 ring-gold">
                {p.photoUrl ? <img src={p.photoUrl} alt="" className="size-full object-cover object-[50%_25%]" loading="lazy" /> : <PlayerSilhouette className="size-[92%]" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                  {p.firstName} {p.lastName}
                </span>
                <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <TeamCrest team={p.team} size="xs" />
                  <span className="truncate">
                    {p.team?.name ?? "—"}, {fullLabel.toLowerCase()}
                  </span>
                </span>
              </span>
              {stats && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs font-semibold text-secondary-foreground">
                  <GoalBalls goals={p.goals} />
                  {stats}
                </span>
              )}
            </Link>
          </li>
        )
      })}
    </ol>
  )
}

function RoundTeamImage({ item, index, open, onOpenChange }: { item: PublishedRoundTeam; index: SeasonIndex; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { script } = useScript()
  const source = useMemo(() => roundTeamImageData(item.team, index), [item.team, index])
  // Sayt kirill yozuvida bo'lsa — rasm va post matni ham kirillcha (fayl nomi lotincha qoladi)
  const data = useMemo(() => (script === "cyrl" ? roundTeamImageInCyrillic(source) : source), [source, script])
  const caption = roundTeamCaption(data)
  return (
    <ImageShareDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`${item.label} ramziy jamoasi`}
      description="Telegram kanali va Instagram uchun tayyor rasm. Yuklab oling yoki to‘g‘ridan-to‘g‘ri ulashing."
      render={() => renderRoundTeamImage(data)}
      renderKey={JSON.stringify(data)}
      fileName={roundTeamFileName(source, index.bundle.season.year)}
      caption={caption}
      alt={caption.split("\n").slice(0, 6).join(", ")}
    />
  )
}

export default function RoundTeamPage() {
  const { index, isLoading, error, refetch } = useSeasonData()
  const [params] = useSearchParams()
  const [imageOpen, setImageOpen] = useState(false)
  const list = useMemo(() => (index ? publishedRoundTeams(index) : []), [index])

  if (isLoading && !index) return <PageSkeleton />
  if (error || !index) return <ErrorState message={error?.message} onRetry={() => refetch()} className="container-page" />

  const current = list.find((t) => t.slug === params.get("tur")) ?? list[0]
  const venue = index.venue(current?.option?.matches.find((m) => m.venueId)?.venueId)?.name

  return (
    <div className="container-page pt-5 md:pt-8">
      <PageHeader title="Ramziy jamoa" description="Har tur yakunida eng yaxshi o‘ynagan 5 futbolchi. Gollar va uzatmalar o‘yin natijalaridan olinadi." />
      {!current ? (
        <div className="panel">
          <EmptyState icon={Shirt} title="Ramziy jamoa hali e’lon qilinmagan" description="Har bir tur yakunlangach, eng yaxshi 5 futbolchi shu yerda e’lon qilinadi." />
        </div>
      ) : (
        <>
          {list.length > 1 && (
            <nav aria-label="Turlar" className="mb-5 flex flex-wrap gap-2">
              {list.map((t) => {
                const active = t === current
                return (
                  <Link
                    key={t.slug}
                    to={`?tur=${t.slug}`}
                    replace
                    preventScrollReset
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors duration-150",
                      active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-pitch-300 hover:bg-muted",
                    )}
                  >
                    {t.label}
                  </Link>
                )
              })}
            </nav>
          )}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,540px)_minmax(0,1fr)] lg:items-start lg:gap-8">
            <section aria-labelledby="rt-title" className="rounded-3xl bg-band p-3 text-band-foreground md:p-4">
              <Lockup item={current} />
              <RoundTeamPitch players={current.players} />
            </section>

            <div className="space-y-4">
              <section className="panel overflow-hidden" aria-labelledby="rt-list-title">
                <div className="border-b border-border px-4 py-3">
                  <h2 id="rt-list-title" className="section-title">
                    {current.label} ramziy jamoasi
                  </h2>
                  {(current.dates || venue) && (
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                      {current.dates && (
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="size-3.5" aria-hidden="true" />
                          {current.dates}
                        </span>
                      )}
                      {venue && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3.5" aria-hidden="true" />
                          {venue}
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <PlayerList item={current} />
              </section>
              <Button size="lg" className="h-12 w-full" onClick={() => setImageOpen(true)}>
                <Download aria-hidden="true" />
                Rasmni yuklab olish
              </Button>
              <p className="text-center text-xs text-muted-foreground">Telegram va Instagram uchun tayyor rasm (1080×1350).</p>
            </div>
          </div>
          <RoundTeamImage item={current} index={index} open={imageOpen} onOpenChange={setImageOpen} />
        </>
      )}
    </div>
  )
}
