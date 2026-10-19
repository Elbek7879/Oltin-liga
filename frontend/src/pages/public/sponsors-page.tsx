import { ExternalLink, Handshake } from "lucide-react"
import { Link } from "react-router"
import { useSponsors } from "@/api/hooks"
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from "@/components/league/states"
import type { Sponsor, SponsorTier } from "@/domain/types"
import { cn } from "@/lib/utils"

const TIERS: { tier: SponsorTier; title: string }[] = [
  { tier: "GENERAL", title: "Bosh homiy" },
  { tier: "OFFICIAL", title: "Rasmiy hamkorlar" },
  { tier: "PARTNER", title: "Hamkorlar" },
]

function SponsorCard({ s }: { s: Sponsor }) {
  const big = s.tier === "GENERAL"
  const content = (
    <>
      {s.logoUrl ? (
        <img
          src={s.logoUrl}
          alt=""
          width={big ? 80 : 48}
          height={big ? 80 : 48}
          loading="lazy"
          className={cn("shrink-0 rounded-lg bg-white object-contain p-1", big ? "size-16 md:size-20" : "size-12")}
        />
      ) : (
      <span
        aria-hidden="true"
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg bg-band font-display text-gold-400",
          big ? "size-16 text-2xl md:size-20 md:text-3xl" : "size-12 text-lg",
        )}
      >
        {s.name
          .split(/\s+/)
          .slice(0, 2)
          .map((w) => w[0])
          .join("")}
      </span>
      )}
      <span className="min-w-0">
        <span className={cn("block font-display", big ? "text-2xl md:text-3xl" : "text-lg")}>{s.name}</span>
        <span className="block text-sm text-muted-foreground">{s.description}</span>
        {s.url && (
          <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-gold-text">
            Saytiga o‘tish <ExternalLink className="size-3.5" aria-hidden="true" />
          </span>
        )}
      </span>
    </>
  )
  const className = cn("panel flex items-center gap-4 p-4", big && "md:p-6", s.url && "transition-colors hover:border-pitch-300")
  return s.url ? (
    <a href={s.url} target="_blank" rel="noopener noreferrer sponsored" className={className}>
      {content}
    </a>
  ) : (
    <div className={className}>{content}</div>
  )
}

export default function SponsorsPage() {
  const { data = [], isLoading, error, refetch } = useSponsors()
  return (
    <div className="container-page pt-5 md:pt-8">
      <PageHeader title="Homiylar" description="Liga o‘tkazilishiga hissa qo‘shayotgan tashkilotlar" />
      {isLoading ? (
        <div className="panel"><ListSkeleton rows={3} /></div>
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : data.length === 0 ? (
        <div className="panel"><EmptyState icon={Handshake} title="Homiylar hali yo‘q" /></div>
      ) : (
        <div className="space-y-8">
          {TIERS.map(({ tier, title }) => {
            const list = data.filter((s) => s.tier === tier)
            if (list.length === 0) return null
            return (
              <section key={tier} aria-labelledby={`tier-${tier}`}>
                <h2 id={`tier-${tier}`} className="section-title mb-3">
                  {title}
                </h2>
                <ul className={cn("grid gap-3", tier === "GENERAL" ? "grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-3")}>
                  {list.map((s) => (
                    <li key={s.id}>
                      <SponsorCard s={s} />
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}
      <section className="mt-10 rounded-2xl bg-band p-5 text-band-foreground md:p-8" aria-labelledby="become-sponsor">
        <h2 id="become-sponsor" className="font-display text-2xl md:text-3xl">
          Liga homiysi bo‘ling
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-band-muted md:text-base">
          Homiylar logotipi saytda, o‘yin sahifalarida va liga e’lonlarida ko‘rsatiladi. Tur homiysi yoki «O‘yinning eng yaxshi futbolchisi» nominatsiyasi homiyligi ham mavjud.
        </p>
        <Link
          to="/liga-haqida"
          className="mt-4 inline-flex h-11 items-center rounded-full bg-gold-400 px-5 text-sm font-bold text-pitch-900 transition-colors hover:bg-gold-300"
        >
          Tashkilotchilar bilan bog‘lanish
        </Link>
      </section>
    </div>
  )
}
