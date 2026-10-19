import { BookOpen, Phone, Send } from "lucide-react"
import { Link } from "react-router"
import { useSettings } from "@/api/hooks"
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
          <section className="panel flex flex-col items-center gap-5 p-4 text-center sm:flex-row sm:items-start sm:text-left md:p-6">
            <LeagueMark size="lg" label="Payariq Oltin Ligasi logotipi" className="size-28 md:size-32" />
            <p className="max-w-[70ch] text-base leading-7 md:text-lg md:leading-8">{settings.about}</p>
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
            <ul className="space-y-2 text-sm md:text-base">
              {settings.contactPhone && (
                <li>
                  <a href={`tel:${settings.contactPhone.replace(/\s/g, "")}`} className="inline-flex min-h-10 items-center gap-2 font-semibold hover:underline">
                    <Phone className="size-4" aria-hidden="true" />
                    {settings.contactPhone}
                  </a>
                </li>
              )}
              {settings.telegram && (
                <li>
                  <a
                    href={`https://t.me/${settings.telegram.replace(/^@/, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-10 items-center gap-2 font-semibold hover:underline"
                  >
                    <Send className="size-4" aria-hidden="true" />
                    {settings.telegram}
                  </a>
                </li>
              )}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Aloqa ma’lumotlari tez orada qo‘shiladi.</p>
          )}
        </aside>
      </div>
    </div>
  )
}
