import { BookOpen } from "lucide-react"
import { Link } from "react-router"
import { useSettings } from "@/api/hooks"
import { LeagueContacts } from "@/components/league/league-contacts"
import { RichText } from "@/components/league/rich-text"
import { socialLinks, SocialLinks } from "@/components/league/social-links"
import { PageHeader, PageSkeleton } from "@/components/league/states"
import { LeagueMark } from "@/components/layout/brand"
import { qualifiersFor } from "@/domain/playoff"
import { TIEBREAKER_LABELS } from "@/domain/standings"
import { useSeason } from "@/hooks/use-season"

export default function AboutPage() {
  const { data: settings, isLoading } = useSettings()
  const { current } = useSeason()
  if (isLoading || !settings) return <PageSkeleton />
  const rules = current?.rules

  return (
    <div className="container-page pt-5 md:pt-8">
      <PageHeader title="Liga haqida" description={settings.region} />
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          <section className="panel p-4 md:p-6">
            <LeagueMark size="lg" label="Payariq Oltin Ligasi logotipi" className="mx-auto mb-4 size-24 sm:float-right sm:mb-2 sm:ml-5 md:size-28" />
            <RichText text={settings.about} className="max-w-[70ch]" />
          </section>
          {rules && (
            <section className="panel p-4 md:p-6" aria-labelledby="rules-title">
              <h2 id="rules-title" className="section-title mb-3">
                Musobaqa qoidalari ({current?.year}-yil)
              </h2>
              <ul className="list-disc space-y-1.5 pl-5 text-sm md:text-base">
                <li>Guruh bosqichi {rules.legs === 2 ? "ikki davrali" : "bir davrali"} tizimda o‘tadi.</li>
                <li>
                  G‘alaba uchun {rules.pointsWin} ochko, durang uchun {rules.pointsDraw} ochko, mag‘lubiyat uchun {rules.pointsLoss} ochko beriladi.
                </li>
                <li>
                  Pley-offga 4 jamoali guruhdan {qualifiersFor(rules, 4)} ta, 5 jamoali guruhdan {qualifiersFor(rules, 5)} ta jamoa chiqadi. Kerak bo‘lsa, pley-off oldidan saralash
                  o‘yinlari o‘tkaziladi.
                </li>
                <li>Pley-offda durang bo‘lsa, qo‘shimcha vaqt, so‘ng penaltilar seriyasi o‘tkaziladi.</li>
                <li>O‘yinga kelmagan jamoaga 0:3 hisobida texnik mag‘lubiyat beriladi.</li>
                {rules.thirdPlaceMatch && <li>Yarim finalda yutqazgan jamoalar 3-o‘rin uchun o‘ynaydi.</li>}
              </ul>
              <h3 className="mt-4 mb-1 font-semibold">Teng ochko bo‘lganda o‘rin quyidagi tartibda aniqlanadi</h3>
              <ol className="list-decimal space-y-0.5 pl-5 text-sm text-muted-foreground md:text-base">
                {rules.tiebreakers.map((t) => (
                  <li key={t}>{TIEBREAKER_LABELS[t]}</li>
                ))}
                <li>Qur’a</li>
              </ol>
              <Link to="/nizom" className="mt-4 inline-flex min-h-10 items-center gap-1.5 font-semibold underline-offset-4 hover:underline">
                <BookOpen className="size-4" aria-hidden="true" />
                To‘liq nizom: kartochkalar, saralash va pley-off tartibi
              </Link>
            </section>
          )}
        </div>
        <aside className="panel h-fit p-4 md:p-6 lg:col-span-4" aria-labelledby="contact-title">
          <h2 id="contact-title" className="section-title mb-3">
            Aloqa
          </h2>
          {settings.contactPhone || settings.telegram ? (
            <>
              <p className="mb-1 text-sm text-muted-foreground">Chempionatda qatnashish va savollar uchun:</p>
              <LeagueContacts settings={settings} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Aloqa ma’lumotlari tez orada qo‘shiladi.</p>
          )}
          {socialLinks(settings).length > 0 && (
            <>
              <h3 className="mt-5 mb-2 font-semibold">Bizni kuzating</h3>
              <SocialLinks settings={settings} withLabel />
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
