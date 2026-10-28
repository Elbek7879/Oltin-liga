import { Ban, CalendarClock, Gavel, ListOrdered, MapPin, Network, Shuffle, Swords, Trophy } from "lucide-react"
import type { ReactNode } from "react"
import { Link } from "react-router"
import { ErrorState, PageHeader, PageSkeleton } from "@/components/league/states"
import { YELLOWS_FOR_BAN } from "@/domain/discipline"
import { firstRoundFor, groupFinishes, playoffPlan, qualifiersFor, ROUND_LABELS, seedLotsFrom } from "@/domain/playoff"
import { DEFAULT_HALF_MINUTES } from "@/domain/schedule"
import { FAIR_PLAY_POINTS, TIEBREAKER_LABELS } from "@/domain/standings"
import { useSeasonData } from "@/hooks/use-season-data"
import { seasonLabel } from "@/lib/format"
import { UNCONFIRMED_DATE } from "@/lib/playoff-overview"

const ORDINAL = (n: number) => Array.from({ length: n }, (_, i) => `${i + 1}`).join("-, ") + "-o‘rin"

function Section({ id, icon: Icon, title, children }: { id: string; icon: typeof Trophy; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="panel scroll-mt-24 p-4 md:p-6">
      <h2 id={`${id}-title`} className="mb-3 flex items-center gap-2 font-display text-xl md:text-2xl">
        <Icon className="size-5 shrink-0 text-gold-text" aria-hidden="true" />
        {title}
      </h2>
      <div className="max-w-[72ch] space-y-3 text-sm leading-6 md:text-base md:leading-7">{children}</div>
    </section>
  )
}

/**
 * Musobaqa nizomi — muxlis uchun «qanday o'tadi?» savollariga javob.
 * Hamma raqamlar joriy mavsum sozlamalari va guruhlaridan olinadi, qo'lda yozilmaydi.
 */
export default function RulesPage() {
  const { index, isLoading, error, refetch } = useSeasonData()
  if (isLoading && !index) return <PageSkeleton />
  if (error || !index) return <ErrorState message={error?.message} onRetry={() => refetch()} className="container-page" />

  const { season, groups, standings, venues, lots } = index.bundle
  const rules = season.rules
  const sizes = [...new Set(groups.map((g) => g.seasonTeamIds.length))].sort((a, b) => a - b)
  // 4 va 5 jamoali guruh qoidasi har doim ko'rsatiladi; mavsumda boshqa hajm bo'lsa — u ham
  const knownSizes = [...new Set([...sizes, 4, 5])].sort((a, b) => a - b)
  const plan = groups.length > 0 ? playoffPlan(groupFinishes(groups, standings, rules), seedLotsFrom(lots ?? [])) : null
  const qualified = plan && !plan.error ? plan.seeds.length : 0
  const first = plan && plan.bracketSize > 1 ? ROUND_LABELS[firstRoundFor(plan.bracketSize)!] : null
  const playIns = plan?.playIns.length ?? 0
  const direct = qualified - playIns * 2
  const teamCount = groups.reduce((n, g) => n + g.seasonTeamIds.length, 0)
  const venueNames = venues.map((v) => v.name)

  const toc: [string, string][] = [
    ["umumiy", "Umumiy tartib"],
    ["guruh", "Guruh bosqichi"],
    ["chiqish", "Pley-offga kim chiqadi"],
    ...(playIns > 0 ? ([["saralash", "Saralash o‘yinlari"]] as [string, string][]) : []),
    ["pley-off", "Pley-off"],
    ["teng", "Teng ochko bo‘lganda"],
    ["kartochka", "Kartochkalar va diskvalifikatsiya"],
    ["taqvim", "O‘yin vaqti va saytdagi belgilar"],
  ]

  return (
    <div className="container-page pt-5 md:pt-8">
      <PageHeader title="Musobaqa nizomi" description={`${seasonLabel(season)}. Musobaqa qanday o‘tadi: guruhlar, pley-off, ochkolar va jazolar.`} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[15rem_minmax(0,52rem)] lg:gap-8">
      <nav aria-label="Nizom bo‘limlari" className="min-w-0 lg:sticky lg:top-24 lg:h-fit">
        <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0">
          {toc.map(([id, label]) => (
            <li key={id} className="shrink-0">
              <a
                href={`#${id}`}
                className="inline-flex min-h-10 items-center rounded-full border border-border bg-card px-3 text-sm font-medium whitespace-nowrap hover:border-pitch-300 hover:bg-muted lg:w-full lg:rounded-lg lg:border-transparent lg:bg-transparent"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid min-w-0 gap-5">
        <Section id="umumiy" icon={Trophy} title="Umumiy tartib">
          <p>
            Musobaqa jahon chempionati tizimida ikki bosqichda o‘tadi: avval <b>guruh bosqichi</b>, keyin <b>pley-off</b> (bitta o‘yinda yutqazgan jamoa chiqib ketadi).
            {teamCount > 0 && ` Bu mavsumda ${teamCount} ta jamoa ${groups.length} ta guruhda o‘ynaydi.`}
          </p>
          {venueNames.length > 0 && (
            <p className="flex items-start gap-2">
              <MapPin className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>
                {venueNames.length === 1 ? (
                  <>
                    Barcha o‘yinlar <b>{venueNames[0]}</b> stadionida o‘tkaziladi.
                  </>
                ) : (
                  <>O‘yinlar quyidagi maydonlarda o‘tadi: {venueNames.join(", ")}.</>
                )}
              </span>
            </p>
          )}
        </Section>

        <Section id="guruh" icon={ListOrdered} title="Guruh bosqichi">
          <p>
            Jamoalar qur’a bilan guruhlarga bo‘linadi. Har bir jamoa o‘z guruhidagi har bir raqib bilan {rules.legs === 2 ? "ikki marta" : "bir marta"} o‘ynaydi.
            O‘yin <b>2 × {rules.halfMinutes ?? DEFAULT_HALF_MINUTES} daqiqa</b> davom etadi, bo‘limlar orasida tanaffus bor.
          </p>
          <p>
            G‘alaba — <b>{rules.pointsWin} ochko</b>, durang — <b>{rules.pointsDraw} ochko</b>, mag‘lubiyat — <b>{rules.pointsLoss} ochko</b>. Guruh bosqichida qo‘shimcha vaqt va penaltilar
            bo‘lmaydi.
          </p>
          {groups.length > 0 && (
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {groups.map((g) => (
                <li key={g.id} className="rounded-lg bg-muted px-3 py-2">
                  <b>{g.name} guruhi</b>: {g.seasonTeamIds.map((id) => index.team(id)?.name).filter(Boolean).join(", ")}
                </li>
              ))}
            </ul>
          )}
          <p>
            <Link to="/jadval" className="font-semibold underline underline-offset-4">
              Guruhlar jadvalini ko‘rish
            </Link>
          </p>
        </Section>

        <Section id="chiqish" icon={Network} title="Pley-offga kim chiqadi">
          <p>Guruhdan nechta jamoa chiqishi guruhdagi jamoalar soniga bog‘liq:</p>
          <ul className="list-disc space-y-1 pl-5">
            {knownSizes.map((n) => (
              <li key={n}>
                {n} jamoali guruhdan — <b>{qualifiersFor(rules, n)} ta</b> jamoa ({ORDINAL(qualifiersFor(rules, n))} egalari)
                {sizes.includes(n) && <span className="text-muted-foreground"> — bu mavsumda shunday guruhlar bor</span>}
              </li>
            ))}
          </ul>
          {qualified > 0 && first && (
            <p>
              Bu mavsumda pley-offga jami <b>{qualified} ta</b> jamoa chiqadi. Pley-off <b>{first.toLowerCase()}</b>dan boshlanadi
              {playIns > 0 ? `, undan oldin ${playIns} ta saralash o‘yini bo‘ladi.` : "."}
            </p>
          )}
          <p>
            Guruh bosqichi tugashi bilan sayt pley-off setkasini <b>o‘zi tuzadi</b> va raqiblarni aniqlaydi: hech kim qo‘lda tanlamaydi. Bir guruhdan chiqqan jamoalar imkon qadar birinchi
            o‘yinda uchrashmaydi.
          </p>
        </Section>

        {playIns > 0 && (
          <Section id="saralash" icon={Swords} title="Saralash o‘yinlari">
            <p>
              Pley-off setkasida joylar soni 2, 4, 8, 16 yoki 32 bo‘lishi kerak. Bu mavsumda {qualified} ta jamoa chiqadi, setkada esa {plan!.bracketSize} ta joy bor. Shuning uchun:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                reytingdagi eng kuchli <b>{direct} ta</b> jamoa to‘g‘ridan-to‘g‘ri {first?.toLowerCase()}ga chiqadi;
              </li>
              <li>
                qolgan <b>{playIns * 2} ta</b> jamoa {playIns} ta saralash o‘yinida bellashadi — g‘oliblar {first?.toLowerCase()}dagi bo‘sh joylarni egallaydi.
              </li>
            </ul>
            <p>
              <b>Reyting qanday tuziladi:</b> avval guruh g‘oliblari, keyin 2-o‘rin egalari, so‘ng 3-o‘rin egalari. Bir toifa ichida jamoalar bitta o‘yinga to‘g‘ri keladigan ochko, to‘plar
              farqi, urilgan gollar va kamroq kartochka bo‘yicha solishtiriladi. O‘rtacha ko‘rsatkich olinadi, chunki guruhlarda jamoalar soni har xil (4 va 5 jamoali guruhda o‘yinlar soni
              teng emas).
            </p>
          </Section>
        )}

        <Section id="pley-off" icon={Trophy} title="Pley-off">
          <ul className="list-disc space-y-1 pl-5">
            <li>Har bir juftlik bitta o‘yin o‘ynaydi, g‘olib keyingi bosqichga avtomatik o‘tadi.</li>
            <li>Asosiy vaqtda durang bo‘lsa — qo‘shimcha vaqt, u ham durang bo‘lsa — penaltilar seriyasi.</li>
            {rules.thirdPlaceMatch && <li>Yarim finalda yutqazgan jamoalar 3-o‘rin uchun o‘ynaydi.</li>}
            <li>Finalda g‘olib bo‘lgan jamoa mavsum chempioni bo‘ladi va «Chempionlar tarixi»ga yoziladi.</li>
          </ul>
          <p>
            <Link to="/pley-off" className="font-semibold underline underline-offset-4">
              Pley-off setkasini ko‘rish
            </Link>
          </p>
        </Section>

        <Section id="teng" icon={Shuffle} title="Teng ochko bo‘lganda">
          <p>Ikki yoki undan ortiq jamoaning ochkosi teng bo‘lsa, o‘rin quyidagi tartibda aniqlanadi:</p>
          <ol className="list-decimal space-y-0.5 pl-5">
            {rules.tiebreakers.map((t) => (
              <li key={t}>{TIEBREAKER_LABELS[t]}</li>
            ))}
            <li>Qur’a</li>
          </ol>
          <p className="text-muted-foreground">
            Fair Play: sariq kartochka — {FAIR_PLAY_POINTS.YELLOW} ball, qizil yoki ikkinchi sariq — {FAIR_PLAY_POINTS.RED} ball; kamroq ball to‘plagan jamoa yuqorida turadi. Qur’ani
            tashkilotchilar o‘tkazadi, natijasi jadvalda darhol ko‘rinadi.
          </p>
        </Section>

        <Section id="kartochka" icon={Ban} title="Kartochkalar va diskvalifikatsiya">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Har xil o‘yinlarda <b>{YELLOWS_FOR_BAN} ta sariq kartochka</b> olgan futbolchi jamoasining keyingi o‘yinini o‘tkazib yuboradi, so‘ng sariqlar hisobi yangidan boshlanadi.
            </li>
            <li>
              <b>Qizil kartochka</b> yoki bir o‘yinda <b>ikkinchi sariq</b> — futbolchi maydondan chiqariladi va keyingi o‘yinni o‘tkazib yuboradi.
            </li>
            <li>Bekor qilingan yoki qoldirilgan o‘yin jazoni o‘tash hisoblanmaydi.</li>
          </ul>
          <p>
            <Link to="/statistika?tab=kartochkalar" className="font-semibold underline underline-offset-4">
              Hozir kimlar diskvalifikatsiyada
            </Link>
          </p>
          <p className="flex items-start gap-2 text-muted-foreground">
            <Gavel className="mt-1 size-4 shrink-0" aria-hidden="true" />
            O‘yinga kelmagan jamoaga 0:3 hisobida texnik mag‘lubiyat beriladi.
          </p>
        </Section>

        <Section id="taqvim" icon={CalendarClock} title="O‘yin vaqti va saytdagi belgilar">
          <dl className="grid gap-2 sm:grid-cols-[12rem_1fr] sm:gap-x-4">
            <dt className="font-semibold">Jonli</dt>
            <dd className="text-muted-foreground">O‘yin hozir davom etmoqda, hisob va daqiqa tashkilotchilar tomonidan yangilab boriladi.</dd>
            <dt className="font-semibold">{UNCONFIRMED_DATE}</dt>
            <dd className="text-muted-foreground">Juftlik aniq, lekin sana va vaqtni tashkilotchilar hali e’lon qilmagan.</dd>
            <dt className="font-semibold">Aniqlanmagan</dt>
            <dd className="text-muted-foreground">Raqib oldingi bosqich natijasidan keyin ma’lum bo‘ladi.</dd>
            <dt className="font-semibold">Jadvaldagi chiziq</dt>
            <dd className="text-muted-foreground">Oltin — guruh g‘olibi, yashil — pley-offga chiqish zonasi.</dd>
            <dt className="font-semibold">Mening jamoam</dt>
            <dd className="text-muted-foreground">Jamoa sahifasida yulduzchani bosing — bosh sahifada uning keyingi o‘yini va o‘rni doim ko‘rinadi.</dd>
          </dl>
          <p>
            Savollar bo‘lsa, tashkilotchilarga murojaat qiling:{" "}
            <Link to="/liga-haqida" className="font-semibold underline underline-offset-4">
              aloqa ma’lumotlari
            </Link>
            .
          </p>
        </Section>
      </div>
      </div>
    </div>
  )
}
