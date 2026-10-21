import {
  CalendarDays,
  CircleUserRound,
  ChartColumn,
  ChartLine,
  ClipboardList,
  ExternalLink,
  FlaskConical,
  Handshake,
  LayoutDashboard,
  Layers,
  Lock,
  LogOut,
  Menu,
  Network,
  Newspaper,
  Settings,
  Shield,
  Shirt,
  Trophy,
  UserRound,
} from "lucide-react"
import { useState } from "react"
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router"
import { useQueryClient } from "@tanstack/react-query"
import { api, IS_DEMO_MODE } from "@/api/client"
import { useMe } from "@/api/hooks"
import type { AdminRole } from "@/api/types"
import { EmptyState, PageSkeleton } from "@/components/league/states"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useLeagueMeta } from "@/hooks/use-document-meta"
import { SeasonProvider, useSeason } from "@/hooks/use-season"
import { useLiveUpdates } from "@/hooks/use-live-updates"
import { canManageCompetition, canOpen, ROLE_LABELS } from "@/lib/roles"
import { adminMeta } from "@/lib/seo"
import { cn } from "@/lib/utils"
import { LeagueMark, ScriptToggle, SeasonSelect, ThemeToggle } from "./brand"
import { ScrollToTop } from "./scroll-to-top"

const NAV_GROUPS = [
  {
    title: "Asosiy",
    items: [{ to: "/admin", label: "Boshqaruv paneli", icon: LayoutDashboard, end: true }],
  },
  {
    title: "Musobaqa",
    items: [
      { to: "/admin/natijalar", label: "Natijalar", icon: ClipboardList },
      { to: "/admin/oyinlar", label: "O‘yinlar", icon: CalendarDays },
      { to: "/admin/guruhlar", label: "Guruhlar", icon: Layers },
      { to: "/admin/jamoalar", label: "Jamoalar", icon: Shield },
      { to: "/admin/futbolchilar", label: "Futbolchilar", icon: UserRound },
      { to: "/admin/pley-off", label: "Pley-off", icon: Network },
      { to: "/admin/ramziy-jamoa", label: "Ramziy jamoa", icon: Shirt },
      { to: "/admin/mavsumlar", label: "Mavsumlar", icon: Trophy },
    ],
  },
  {
    title: "Sayt",
    items: [
      { to: "/admin/yangiliklar", label: "Yangiliklar", icon: Newspaper },
      { to: "/admin/homiylar", label: "Homiylar", icon: Handshake },
    ],
  },
  {
    title: "Tizim",
    items: [
      { to: "/admin/hisobotlar", label: "Hisobotlar", icon: ChartColumn },
      { to: "/admin/tashriflar", label: "Tashriflar", icon: ChartLine },
      { to: "/admin/sozlamalar", label: "Sozlamalar", icon: Settings },
    ],
  },
]

const BOTTOM = [
  { to: "/admin", label: "Panel", icon: LayoutDashboard, end: true },
  { to: "/admin/natijalar", label: "Natijalar", icon: ClipboardList },
  { to: "/admin/oyinlar", label: "O‘yinlar", icon: CalendarDays },
  { to: "/admin/jamoalar", label: "Jamoalar", icon: Shield },
]

/** Brauzer yorlig'idagi bo'lim nomi: «/admin/natijalar/…» → «Natijalar»; bosh panelda — undefined */
function sectionLabel(pathname: string) {
  if (pathname.startsWith("/admin/hisobim")) return "Hisobim"
  return NAV_GROUPS.flatMap((g) => g.items).find((i) => i.to !== "/admin" && (pathname === i.to || pathname.startsWith(`${i.to}/`)))?.label
}

/** Rol ochmaydigan bo'limlar menyuda ko'rsatilmaydi */
function navFor(role: AdminRole) {
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => canOpen(role, i.to)) })).filter((g) => g.items.length > 0)
}

/** Pastki menyu: to'liq huquqli rollarga asosiy 4 bo'lim, yordamchilarga o'z bo'limlari */
function bottomFor(role: AdminRole) {
  if (canManageCompetition(role)) return BOTTOM
  const own = navFor(role)
    .flatMap((g) => g.items)
    .filter((i) => i.to !== "/admin")
    .map((i) => ({ to: i.to, label: i.label, icon: i.icon, end: false }))
  return [BOTTOM[0], ...own].slice(0, 4)
}

function NavList({ onNavigate, tone, role }: { onNavigate?: () => void; tone: "band" | "plain"; role: AdminRole }) {
  return (
    <nav aria-label="Boshqaruv menyusi" className="space-y-5">
      {navFor(role).map((g) => (
        <div key={g.title}>
          <p className={cn("mb-1 px-3 text-xs", tone === "band" ? "text-band-muted" : "text-muted-foreground")}>{g.title}</p>
          <ul className="space-y-0.5">
            {g.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === "/admin"}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors md:min-h-10",
                      tone === "band"
                        ? isActive
                          ? "bg-white/10 text-gold-400"
                          : "text-band-foreground/85 hover:bg-white/5 hover:text-band-foreground"
                        : isActive
                          ? "bg-secondary text-primary dark:text-gold-400"
                          : "hover:bg-muted",
                    )
                  }
                >
                  <item.icon className="size-[18px] shrink-0" aria-hidden="true" />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

/** Rol bu bo'limni ochmaydi (masalan, havola orqali kirilganda) */
function NoAccess({ role }: { role: AdminRole }) {
  return (
    <div className="mx-auto max-w-xl">
      <EmptyState
        pageTitle
        icon={Lock}
        title="Bu bo‘lim sizning rolingiz uchun yopiq"
        description={`Siz «${ROLE_LABELS[role]}» rolidasiz. Boshqa bo‘limlar kerak bo‘lsa, bosh tashkilotchiga murojaat qiling.`}
        action={
          <Button asChild>
            <Link to="/admin">Boshqaruv paneliga qaytish</Link>
          </Button>
        }
      />
    </div>
  )
}

/** Hali mavsum yo'q: tashkilotchini birinchi mavsumni yaratishga yo'naltiradi */
function FirstSeasonPrompt({ role }: { role: AdminRole }) {
  if (!canManageCompetition(role)) {
    return (
      <div className="mx-auto max-w-xl">
        <EmptyState pageTitle icon={Trophy} title="Mavsum hali ochilmagan" description="Bosh tashkilotchi mavsumni ochgach, bu bo‘limda ishlay olasiz." />
      </div>
    )
  }
  return (
    <div className="mx-auto max-w-xl">
      <EmptyState
        pageTitle
        icon={Trophy}
        title="Birinchi mavsumni yarating"
        description="Jamoalar, qur’a, o‘yinlar va natijalar mavsumga bog‘lanadi. Avval mavsum oching — keyin jamoalarni qo‘shasiz. Tizimni avval sinab ko‘rmoqchi bo‘lsangiz, «Sinov mavsumi» belgisini qo‘ying: u saytda ko‘rinmaydi va keyin butunlay o‘chiriladi."
        action={
          <Button asChild>
            <Link to="/admin/mavsumlar?yangi=1">Mavsum ochish</Link>
          </Button>
        }
      />
    </div>
  )
}

const WITHOUT_SEASON = ["/admin/mavsumlar", "/admin/sozlamalar", "/admin/yangiliklar", "/admin/homiylar", "/admin/hisobim", "/admin/tashriflar"]

/** Sidebar pastidagi akkaunt havolasi: ism, rol va «Hisobim» sahifasi */
function AccountLink({ name, role, tone, onNavigate }: { name: string; role: AdminRole; tone: "band" | "plain"; onNavigate?: () => void }) {
  return (
    <NavLink
      to="/admin/hisobim"
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "flex min-h-11 items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors",
          tone === "band" ? (isActive ? "bg-white/10" : "hover:bg-white/5") : isActive ? "bg-secondary" : "hover:bg-muted",
        )
      }
    >
      <CircleUserRound className={cn("size-[18px] shrink-0", tone === "band" && "text-gold-400")} aria-hidden="true" />
      <span className="min-w-0 leading-tight">
        <span className="block truncate font-semibold">{name}</span>
        <span className={cn("block truncate text-xs", tone === "band" ? "text-band-muted" : "text-muted-foreground")}>{ROLE_LABELS[role]}, hisobim</span>
      </span>
    </NavLink>
  )
}

function useLogout() {
  const navigate = useNavigate()
  const client = useQueryClient()
  return async () => {
    await api.logout()
    // Avval kirish sahifasiga o'tiladi (aks holda panel «keyin» bilan yo'naltiradi), so'ng oldingi foydalanuvchi ma'lumotlari tozalanadi
    navigate("/admin/kirish", { replace: true })
    client.removeQueries({ queryKey: ["admin"] })
    client.setQueryData(["me"], null)
  }
}

/** Sinov mavsumi tanlanganda: muxlislar uni ko'rmaydi, sinab bo'lgach o'chiriladi */
function TestSeasonBanner({ name }: { name: string }) {
  return (
    <p role="note" className="mb-4 flex items-start gap-2 rounded-xl border border-dashed border-gold bg-gold-soft px-4 py-3 text-sm text-foreground">
      <FlaskConical className="mt-0.5 size-4 shrink-0 text-gold-text" aria-hidden="true" />
      <span>
        <strong>«{name}» — sinov mavsumi.</strong> Saytda muxlislarga ko‘rinmaydi. Sinab bo‘lgach, uni{" "}
        <Link to="/admin/mavsumlar" className="font-semibold underline underline-offset-2">
          Mavsumlar
        </Link>{" "}
        bo‘limida butunlay o‘chiring — keyin haqiqiy mavsumni boshlaysiz.
      </span>
    </p>
  )
}

/** Admin panelida mavsumlar ro'yxati sinov mavsumlari bilan (kirilgandan keyin so'raladi) */
export function AdminLayout() {
  const { data: me } = useMe()
  return (
    <SeasonProvider admin enabled={Boolean(me)}>
      <AdminLayoutInner />
    </SeasonProvider>
  )
}

function AdminLayoutInner() {
  const { data: me, isLoading } = useMe()
  // Boshqa admin yoki Telegram bot kiritgan natijalar ham darhol ko'rinadi
  useLiveUpdates({ toasts: false })
  const { seasons, season, isLoading: seasonsLoading } = useSeason()
  const location = useLocation()
  const needsSeason = !seasonsLoading && seasons.length === 0 && !WITHOUT_SEASON.some((p) => location.pathname.startsWith(p))
  const [menuOpen, setMenuOpen] = useState(false)
  const logout = useLogout()
  useLeagueMeta((league) => adminMeta(sectionLabel(location.pathname), league))

  if (isLoading) return <PageSkeleton />
  if (!me) return <Navigate to={`/admin/kirish?keyin=${encodeURIComponent(location.pathname)}`} replace />
  const allowed = canOpen(me.role, location.pathname)
  const bottom = bottomFor(me.role)

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:bg-band">
      <ScrollToTop />
      <a href="#admin-main" className="sr-only z-50 rounded-md bg-card px-4 py-2 font-semibold focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Asosiy mazmunga o‘tish
      </a>

      <aside className="no-print sticky top-0 hidden h-dvh flex-col overflow-y-auto bg-band px-3 py-4 text-band-foreground lg:flex">
        <Link to="/admin" className="mb-6 flex items-center gap-2.5 px-2">
          <LeagueMark className="size-11" />
          <span className="leading-tight">
            <span className="block font-display text-lg text-gold-400">Oltin Liga</span>
            <span className="block text-xs text-band-muted">Boshqaruv paneli</span>
          </span>
        </Link>
        <NavList tone="band" role={me.role} />
        <div className="mt-auto space-y-1 border-t border-white/10 pt-4">
          <AccountLink name={me.displayName} role={me.role} tone="band" />
          <button
            type="button"
            onClick={logout}
            className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold text-band-foreground/85 hover:bg-white/5"
          >
            <LogOut className="size-[18px]" aria-hidden="true" />
            Chiqish
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col bg-background">
        <header className="no-print sticky top-0 z-30 border-b border-border bg-band text-band-foreground lg:bg-card lg:text-foreground">
          <div className="flex h-14 items-center gap-2 px-4 md:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="-ml-2 text-band-foreground hover:bg-white/10 hover:text-band-foreground lg:hidden"
              onClick={() => setMenuOpen(true)}
              aria-label="Menyuni ochish"
            >
              <Menu aria-hidden="true" />
            </Button>
            <Link to="/admin" className="flex items-center gap-2 lg:hidden">
              <LeagueMark className="size-8" />
              <span className="font-display text-lg text-gold-400">Boshqaruv</span>
            </Link>
            <div className="ml-auto flex items-center gap-1.5">
              <SeasonSelect tone="band" className="lg:hidden" />
              <SeasonSelect tone="plain" className="hidden lg:flex" />
              <Button asChild variant="ghost" size="sm" className="hidden lg:inline-flex">
                <Link to="/" target="_blank">
                  <ExternalLink aria-hidden="true" />
                  Saytni ko‘rish
                </Link>
              </Button>
              <ScriptToggle className="lg:text-foreground lg:hover:bg-muted lg:hover:text-foreground" />
              <ThemeToggle className="lg:text-foreground lg:hover:bg-muted lg:hover:text-foreground" />
            </div>
          </div>
          {IS_DEMO_MODE && (
            <p className="border-t border-white/10 bg-gold-soft px-4 py-1.5 text-xs text-foreground md:px-6 lg:border-border">
              Namunaviy rejim: o‘zgarishlar faqat shu brauzerda saqlanadi, server bazasiga yozilmaydi.
            </p>
          )}
        </header>

        <main id="admin-main" className="flex-1 px-4 pt-5 pb-24 md:px-6 md:pt-6 lg:pb-10">
          {allowed && !needsSeason && season?.test && <TestSeasonBanner name={season.name} />}
          {!allowed ? <NoAccess role={me.role} /> : needsSeason ? <FirstSeasonPrompt role={me.role} /> : <Outlet />}
        </main>
      </div>

      <nav aria-label="Pastki menyu" className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-safe lg:hidden">
        <ul className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${bottom.length + 1}, minmax(0, 1fr))` }}>
          {bottom.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex h-14 flex-col items-center justify-center gap-0.5 text-2xs font-medium text-muted-foreground",
                    isActive && "font-bold text-primary dark:text-gold-400",
                  )
                }
              >
                <item.icon className="size-5" aria-hidden="true" />
                {item.label}
              </NavLink>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-haspopup="dialog"
              className="flex h-14 w-full flex-col items-center justify-center gap-0.5 text-2xs font-medium text-muted-foreground"
            >
              <Menu className="size-5" aria-hidden="true" />
              Menyu
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-[18rem] overflow-y-auto p-0">
          <SheetHeader className="border-b border-border">
            <SheetTitle className="font-display text-xl">Boshqaruv paneli</SheetTitle>
            <SheetDescription>
              {me.displayName}, {ROLE_LABELS[me.role].toLowerCase()}
            </SheetDescription>
          </SheetHeader>
          <div className="p-3">
            <NavList tone="plain" role={me.role} onNavigate={() => setMenuOpen(false)} />
            <div className="mt-5 space-y-1 border-t border-border pt-4">
              <AccountLink name={me.displayName} role={me.role} tone="plain" onNavigate={() => setMenuOpen(false)} />
              <Link to="/" className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold hover:bg-muted">
                <ExternalLink className="size-[18px]" aria-hidden="true" />
                Saytni ko‘rish
              </Link>
              <button type="button" onClick={logout} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold hover:bg-muted">
                <LogOut className="size-[18px]" aria-hidden="true" />
                Chiqish
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
