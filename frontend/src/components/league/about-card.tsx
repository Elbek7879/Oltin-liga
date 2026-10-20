import { ArrowRight, Info } from "lucide-react"
import { Link } from "react-router"
import { useSettings } from "@/api/hooks"
import { cn } from "@/lib/utils"
import { LeagueContacts } from "./league-contacts"
import { introOf } from "./rich-text"
import { SocialLinks } from "./social-links"

/**
 * Muxlis va tomoshabinlar uchun qisqa tanishtiruv: liga haqida birinchi xatboshi, «Batafsil» va murojaat raqamlari.
 * Matn «Sozlamalar → Liga ma'lumotlari»dan olinadi.
 */
export function AboutCard({ className, titleId = "about-card-title" }: { className?: string; titleId?: string }) {
  const { data: settings } = useSettings()
  const intro = settings ? introOf(settings.about) : ""
  if (!settings || !intro) return null
  return (
    <section aria-labelledby={titleId} className={cn("panel p-4 md:p-5", className)}>
      <h2 id={titleId} className="flex items-center gap-2 font-display text-lg">
        <Info className="size-5 shrink-0 text-gold-text" aria-hidden="true" />
        Chempionat haqida
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground md:text-base md:leading-7">{intro}</p>
      {(settings.contactPhone || settings.telegram) && (
        <div className="mt-3">
          <p className="text-sm font-semibold">Qatnashish uchun murojaat:</p>
          <LeagueContacts settings={settings} />
        </div>
      )}
      <SocialLinks settings={settings} className="mt-3" />
      <Link to="/liga-haqida" className="mt-2 inline-flex min-h-11 items-center gap-1.5 font-semibold text-gold-text underline-offset-4 hover:underline">
        Batafsil: qayerda, kimlar uchun, qanday qatnashiladi
        <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
      </Link>
    </section>
  )
}
