import { ChartLine, Cookie, Database, Server, ShieldCheck, Target, UserCheck } from "lucide-react"
import type { ReactNode } from "react"
import { Link } from "react-router"
import { useSettings } from "@/api/hooks"
import { LeagueContacts } from "@/components/league/league-contacts"
import { PageHeader, PageSkeleton } from "@/components/league/states"

/** Siyosat matni o'zgarsa, shu sana ham yangilanadi */
const UPDATED = "2026-yil 21-oktabr"

function Section({ id, icon: Icon, title, children }: { id: string; icon: typeof Database; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-title`} className="panel p-4 md:p-6">
      <h2 id={`${id}-title`} className="mb-3 flex items-center gap-2 font-display text-xl md:text-2xl">
        <Icon className="size-5 shrink-0 text-gold-text" aria-hidden="true" />
        {title}
      </h2>
      <div className="max-w-[72ch] space-y-3 text-sm leading-6 md:text-base md:leading-7">{children}</div>
    </section>
  )
}

/**
 * Maxfiylik siyosati: sayt qanday shaxsga doir ma'lumotlarni saqlaydi, nima uchun va qanday tuzattirish mumkin.
 * Liga nomi va aloqa ma'lumotlari «Sozlamalar»dan olinadi. Matn oddiy tilda; huquqiy ko'rikdan o'tkazish tavsiya etiladi.
 */
export default function PrivacyPage() {
  const { data: settings, isLoading } = useSettings()
  if (isLoading || !settings) return <PageSkeleton />
  const league = settings.name?.trim() || "Liga"

  return (
    <div className="container-page pt-5 md:pt-8">
      <PageHeader title="Maxfiylik siyosati" description={`Oxirgi yangilanish: ${UPDATED}`} />
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          <Section id="privacy-who" icon={ShieldCheck} title="Kim javobgar">
            <p>
              Saytdagi ma’lumotlar uchun «{league}» tashkilotchilari javob beradi. Ma’lumotlar O‘zbekiston Respublikasining «Shaxsga doir ma’lumotlar to‘g‘risida»gi Qonuni
              talablariga amal qilgan holda yuritiladi. Saytga texnik xizmat ko‘rsatuvchi mutaxassis ma’lumotlardan faqat sayt ishlashi uchun foydalanadi va ularni boshqalarga bermaydi.
            </p>
          </Section>

          <Section id="privacy-data" icon={Database} title="Qanday ma’lumot saqlanadi">
            <p>
              <strong>Futbolchilar haqida:</strong> ism va familiya, jamoasi, o‘yindagi raqami, pozitsiyasi, tug‘ilgan yili (kiritilgan bo‘lsa) va o‘yin statistikasi — gollar,
              assistlar, kartochkalar. Bu ma’lumotlarni futbolchi yoki jamoa vakili tashkilotchiga beradi.
            </p>
            <p>
              <strong>Futbolchi rasmi</strong> (masalan, ramziy jamoada) faqat futbolchining roziligi bilan, 18 yoshga to‘lmagan futbolchi uchun esa ota-onasining roziligi
              bilan joylanadi.
            </p>
            <p>
              <strong>Tashkilotchilar haqida:</strong> boshqaruv paneliga kirish uchun login, ism va parol. Parol shifrlangan ko‘rinishda saqlanadi — uni hech kim, hatto
              sayt xizmatchisi ham o‘qiy olmaydi. Telegram bot ulangan bo‘lsa, Telegram hisobining raqami saqlanadi. Panelda kim qanday o‘zgartirish kiritgani yozib
              boriladi.
            </p>
            <p>
              Muxlislardan ism, telefon raqami yoki boshqa shaxsiy ma’lumot so‘ralmaydi — saytni ko‘rish uchun ro‘yxatdan o‘tish shart emas.
            </p>
          </Section>

          <Section id="privacy-why" icon={Target} title="Nima uchun">
            <p>
              Ma’lumotlar faqat musobaqani o‘tkazish va uning natijalarini e’lon qilish uchun ishlatiladi: o‘yinlar taqvimi, turnir jadvali, to‘purarlar va mavsumlar tarixi.
              Ular reklama uchun ishlatilmaydi, sotilmaydi va boshqa tashkilotlarga berilmaydi.
            </p>
          </Section>

          <Section id="privacy-visits" icon={ChartLine} title="Tashrif statistikasi">
            <p>
              Saytga kuniga necha kishi kirganini bilish uchun brauzeringizda tasodifiy raqam saqlanadi. Serverga shu raqamning shifrlangan ko‘rinishi, ochilgan sahifa
              manzili, qurilma turi (telefon yoki kompyuter) va saytga qayerdan kelganingiz (masalan, Telegram yoki Google) yuboriladi. Ism, telefon raqami yoki IP manzil
              yozilmaydi, shuning uchun bu ma’lumotdan sizni aniqlab bo‘lmaydi.
            </p>
            <p>
              Brauzeringizda «Kuzatmang» (Do Not Track yoki Global Privacy Control) sozlamasi yoqilgan bo‘lsa, sayt hech narsa yubormaydi. Google Analytics kabi tashqi
              kuzatuv xizmatlari ishlatilmaydi.
            </p>
          </Section>

          <Section id="privacy-browser" icon={Cookie} title="Brauzeringizda nima saqlanadi">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>tanlangan mavsum, «Mening jamoam», tungi rejim va lotin yoki kirill yozuvi — keyingi safar sayt shunday ochilishi uchun;</li>
              <li>tashrif statistikasi uchun tasodifiy raqam;</li>
              <li>
                xavfsizlik uchun bitta texnik cookie (XSRF-TOKEN) — u soxta so‘rovlardan himoya qiladi va sizni kuzatmaydi. Tashkilotchilar uchun panelga kirgandan keyin
                sessiya cookie’si qo‘shiladi.
              </li>
            </ul>
            <p>Reklama cookie’lari yo‘q. Bularning hammasini brauzer sozlamalarida «Sayt ma’lumotlarini tozalash» orqali o‘chirishingiz mumkin.</p>
          </Section>

          <Section id="privacy-where" icon={Server} title="Qayerda va qancha saqlanadi">
            <p>
              Ma’lumotlar O‘zbekiston hududidagi serverda saqlanadi va internet orqali faqat himoyalangan ulanish (HTTPS) bilan uzatiladi. Har kuni zaxira nusxa olinadi.
            </p>
            <p>
              Musobaqa natijalari va mavsumlar tarixi liga arxivi sifatida muddatsiz saqlanadi. Tashrif statistikasida faqat shifrlangan raqam va sahifalar bo‘yicha umumiy
              sonlar saqlanadi.
            </p>
          </Section>

          <Section id="privacy-rights" icon={UserCheck} title="Sizning huquqingiz">
            <p>
              Futbolchi yoki uning vakili saytdagi ma’lumoti noto‘g‘ri bo‘lsa, tuzatishni so‘rashi mumkin. Rasmni olib tashlash yoki ma’lumotni o‘chirishni ham so‘rash
              mumkin — tashkilotchi so‘rovni ko‘rib chiqadi va javob beradi. Buning uchun tashkilotchiga quyidagi aloqa orqali murojaat qiling.
            </p>
          </Section>
        </div>
        <aside className="panel h-fit p-4 md:p-6 lg:col-span-4" aria-labelledby="privacy-contact">
          <h2 id="privacy-contact" className="section-title mb-3">
            Murojaat uchun
          </h2>
          {settings.contactPhone || settings.telegram ? (
            <LeagueContacts settings={settings} />
          ) : (
            <p className="text-sm text-muted-foreground">Aloqa ma’lumotlari tez orada qo‘shiladi.</p>
          )}
          <p className="mt-4 text-sm text-muted-foreground">
            Liga haqida batafsil:{" "}
            <Link to="/liga-haqida" className="font-semibold text-foreground underline-offset-4 hover:underline">
              Liga haqida
            </Link>
          </p>
        </aside>
      </div>
    </div>
  )
}
