import { BookOpen, Archive,
  CalendarDays,
  ChartColumn,
  ChevronRight,
  Crown,
  Handshake,
  House,
  Info,
  ListOrdered,
  LogIn,
  Menu,
  MessageSquarePlus,
  Network,
  Newspaper,
  Shield,
  Shirt,
  Trophy,
  UserRound,
} from "lucide-react"
import { useState } from "react"
import { Link, NavLink, Outlet, useLocation } from "react-router"
import { useSettings, useSponsors } from "@/api/hooks"
import { IS_DEMO_MODE } from "@/api/client"
import { AboutCard } from "@/components/league/about-card"
import { SocialLinks } from "@/components/league/social-links"
import { EmptyState } from "@/components/league/states"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useLeagueMeta } from "@/hooks/use-document-meta"
import { useSeason } from "@/hooks/use-season"
import { useLiveUpdates } from "@/hooks/use-live-updates"
import { useVisitTracking } from "@/hooks/use-visit-tracking"
import { staticMeta } from "@/lib/seo"
import { cn } from "@/lib/utils"
import { LeagueMark, Logo, ScriptToggle, SeasonSelect, ThemeToggle } from "./brand"
import { ScrollToTop } from "./scroll-to-top"

const MAIN_NAV = [
  { to: "/", label: "Asosiy", icon: House, end: true },
  { to: "/oyinlar", label: "O‘yinlar", icon: CalendarDays },
  { to: "/jadval", label: "Jadval", icon: ListOrdered },
  { to: "/pley-off", label: "Pley-off", icon: Network },
  { to: "/jamoalar", label: "Jamoalar", icon: Shield },
  { to: "/statistika", label: "Statistika", icon: ChartColumn },
  { to: "/ramziy-jamoa", label: "Ramziy jamoa", icon: Shirt },
  { to: "/yangiliklar", label: "Yangiliklar", icon: Newspaper },
]

const MORE_NAV = [
  { to: "/futbolchilar", label: "Futbolchilar", icon: UserRound },
  { to: "/mavsumlar", label: "Mavsumlar arxivi", icon: Archive },
  { to: "/chempionlar", label: "Chempionlar tarixi", icon: Crown },
  { to: "/homiylar", label: "Homiylar", icon: Handshake },
  { to: "/nizom", label: "Musobaqa nizomi", icon: BookOpen },
  { to: "/liga-haqida", label: "Liga haqida", icon: Info },
  { to: "/murojaat", label: "Murojaat va arizalar", icon: MessageSquarePlus },
]

const BOTTOM_NAV = [
  { to: "/", label: "Asosiy", icon: House, end: true },
  { to: "/oyinlar", label: "O‘yinlar", icon: CalendarDays },
  { to: "/jadval", label: "Jadval", icon: ListOrdered },
  { to: "/statistika", label: "Statistika", icon: ChartColumn },
]

function DesktopNav() {
  return (
    <nav aria-label="Asosiy menyu" className="hidden lg:block">
      <ul className="flex items-center gap-0.5">
        {[...MAIN_NAV, { to: "/mavsumlar", label: "Arxiv", icon: Archive }].map((item) => (
          // 1280px dan tor ekranda «Asosiy» o'rniga logotip bosh sahifaga olib boradi.
          // Kirill matni kengroq: 1536px gacha «Asosiy» yashiriladi va oraliqlar ixchamlashadi — o'ngdagi tugmalar sig'adi
          <li key={item.to} className={cn(item.to === "/" && "lg:max-xl:hidden xl:max-2xl:cyrl:hidden")}>
            <NavLink
              to={item.to}
              end={"end" in item ? item.end : false}
              className={({ isActive }) =>
                cn(
                  "relative block rounded-md px-2 py-2 text-sm font-semibold whitespace-nowrap text-band-muted transition-colors hover:text-band-foreground xl:px-3 xl:max-2xl:cyrl:px-2",
                  isActive &&
                    "text-band-foreground after:absolute after:inset-x-2 after:-bottom-[13px] xl:after:inset-x-3 xl:max-2xl:cyrl:after:inset-x-2 after:h-[3px] after:rounded-full after:bg-gold-400",
                )
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function MoreSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const items = [...MAIN_NAV.filter((i) => !BOTTOM_NAV.some((b) => b.to === i.to)), ...MORE_NAV]
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl pb-safe">
        <SheetHeader className="pb-1 text-left">
          <SheetTitle className="font-display text-xl">Bo‘limlar</SheetTitle>
          <SheetDescription>Liga sahifalari va mavsumlar tarixi</SheetDescription>
        </SheetHeader>
        <nav aria-label="Qo‘shimcha bo‘limlar" className="px-2 pb-4">
          <ul className="grid grid-cols-1 gap-0.5 min-[420px]:grid-cols-2">
            {items.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={() => onOpenChange(false)}
                  className="flex min-h-12 items-center gap-3 rounded-lg px-3 font-medium hover:bg-muted"
                >
                  <item.icon className="size-5 text-muted-foreground" aria-hidden="true" />
                  {item.label}
                  <ChevronRight className="ml-auto size-4 text-muted-foreground min-[420px]:hidden" aria-hidden="true" />
                </Link>
              </li>
            ))}
            <li>
              <Link
                to="/admin"
                onClick={() => onOpenChange(false)}
                className="flex min-h-12 items-center gap-3 rounded-lg px-3 font-medium text-muted-foreground hover:bg-muted"
              >
                <LogIn className="size-5" aria-hidden="true" />
                Tashkilotchilar uchun
              </Link>
            </li>
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  )
}

function BottomNav() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const moreActive = ![...BOTTOM_NAV].some((i) => (i.end ? location.pathname === i.to : location.pathname.startsWith(i.to)))
  return (
    <>
      <nav
        aria-label="Pastki menyu"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-safe backdrop-blur supports-[backdrop-filter]:bg-card/85 lg:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {BOTTOM_NAV.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex h-14 flex-col items-center justify-center gap-0.5 text-2xs font-medium text-muted-foreground transition-colors",
                    isActive && "font-bold text-primary dark:text-gold-400",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={cn("flex h-6 w-11 items-center justify-center rounded-full transition-colors", isActive && "bg-secondary")}>
                      <item.icon className="size-[19px]" aria-hidden="true" />
                    </span>
                    {item.label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-haspopup="dialog"
              className={cn(
                "flex h-14 w-full flex-col items-center justify-center gap-0.5 text-2xs font-medium text-muted-foreground",
                moreActive && "font-bold text-primary dark:text-gold-400",
              )}
            >
              <span className={cn("flex h-6 w-11 items-center justify-center rounded-full", moreActive && "bg-secondary")}>
                <Menu className="size-[19px]" aria-hidden="true" />
              </span>
              Ko‘proq
            </button>
          </li>
        </ul>
      </nav>
      <MoreSheet open={open} onOpenChange={setOpen} />
    </>
  )
}

function ArchiveBanner() {
  const { isArchive, season, current, setSeasonId } = useSeason()
  if (!isArchive || !season || !current) return null
  return (
    <div className="border-b border-gold/30 bg-gold-soft">
      <div className="container-page flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
        <Archive className="size-4 text-gold-text" aria-hidden="true" />
        <span>
          Siz <strong>{season.year}-yil</strong> mavsumi arxivini ko‘ryapsiz.
        </span>
        <button
          type="button"
          onClick={() => setSeasonId(current.id)}
          className="min-h-8 rounded-sm font-semibold text-gold-text underline underline-offset-4"
        >
          Joriy mavsumga qaytish
        </button>
      </div>
    </div>
  )
}

function Footer() {
  const { data: sponsors = [] } = useSponsors()
  const { data: settings } = useSettings()
  return (
    <footer className="mt-12 border-t border-border bg-card pb-20 lg:pb-0">
      {sponsors.length > 0 && (
        <div className="border-b border-border">
          <div className="container-page py-5">
            <p className="mb-3 text-xs text-muted-foreground">Liga homiylari</p>
            <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {sponsors.map((s) => (
                <li key={s.id}>
                  <Link
                    to="/homiylar"
                    className={cn(
                      "font-display text-muted-foreground transition-colors hover:text-foreground",
                      s.tier === "GENERAL" ? "text-lg text-foreground" : "text-md",
                    )}
                  >
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <div className="container-page flex flex-col gap-4 py-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <LeagueMark className="size-10" />
          <div>
          <p className="font-semibold text-foreground">Payariq Oltin Ligasi</p>
          <p>Qishloq va mahallalar o‘rtasida havaskor futbol musobaqasi</p>
          {IS_DEMO_MODE && <p className="mt-1 text-xs">Sayt hozir namunaviy ma’lumotlar bilan ishlamoqda.</p>}
          <SocialLinks settings={settings} className="mt-3" />
          </div>
        </div>
        <nav aria-label="Pastki havolalar">
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            <li><Link className="hover:text-foreground" to="/ramziy-jamoa">Ramziy jamoa</Link></li>
            <li><Link className="hover:text-foreground" to="/nizom">Musobaqa nizomi</Link></li>
            <li><Link className="hover:text-foreground" to="/liga-haqida">Liga haqida</Link></li>
            <li><Link className="hover:text-foreground" to="/murojaat">Murojaat va arizalar</Link></li>
            <li><Link className="hover:text-foreground" to="/homiylar">Homiy bo‘lish</Link></li>
            <li><Link className="hover:text-foreground" to="/mavsumlar">Arxiv</Link></li>
            <li><Link className="hover:text-foreground" to="/maxfiylik">Maxfiylik siyosati</Link></li>
            <li><Link className="hover:text-foreground" to="/admin">Tashkilotchilar uchun</Link></li>
          </ul>
        </nav>
      </div>
    </footer>
  )
}

/** Liga hali birorta mavsum ochmagan bo'lsa (yangi o'rnatilgan sayt) */
function NoSeasonYet() {
  return (
    <div className="container-page py-10">
      <EmptyState
        pageTitle
        icon={Trophy}
        title="Birinchi mavsum tez orada boshlanadi"
        description="Tashkilotchilar mavsumni ochgach, o‘yinlar taqvimi, turnir jadvali va natijalar shu yerda paydo bo‘ladi."
      />
      <AboutCard className="mx-auto max-w-2xl" />
    </div>
  )
}

export function PublicLayout() {
  useLiveUpdates({ toasts: true })
  const { seasons, isLoading } = useSeason()
  const location = useLocation()
  // Doimiy bo'limlar nomi; jamoa, futbolchi, o'yin va yangilik sahifalari nomini o'zi qo'yadi
  useLeagueMeta((league) => staticMeta(location.pathname, league))
  useVisitTracking()
  // Mavsum hali ochilmagan bo'lsa ham ishlaydigan sahifalar (masalan, birinchi mavsumga ariza yuborish)
  const seasonPages = !["/yangiliklar", "/homiylar", "/liga-haqida", "/maxfiylik", "/murojaat"].some((p) => location.pathname.startsWith(p))
  const noSeasons = !isLoading && seasons.length === 0 && seasonPages
  return (
    <div className="flex min-h-dvh flex-col">
      <ScrollToTop />
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-card px-4 py-2 font-semibold focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Asosiy mazmunga o‘tish
      </a>
      <header className="sticky top-0 z-40 bg-band text-band-foreground shadow-[0_1px_0_var(--band-line)]">
        <div className="container-page flex h-14 items-center gap-3 md:h-16">
          <Logo compact />
          <div className="ml-auto flex items-center gap-1.5 lg:ml-6 lg:flex-1 lg:justify-between">
            <DesktopNav />
            <div className="flex items-center gap-1.5">
              <SeasonSelect compact />
              <ScriptToggle />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>
      <ArchiveBanner />
      {/* Kamida bir ekran balandlik: ma'lumot yuklanguncha footer ko'rinib, keyin pastga «sakramaydi» (CLS) */}
      <main id="main" className="min-h-[calc(100svh-3.5rem)] flex-1 pb-6 md:min-h-[calc(100svh-4rem)] md:pb-10">
        {noSeasons ? <NoSeasonYet /> : <Outlet />}
      </main>
      <Footer />
      <BottomNav />
    </div>
  )
}
