import { createBrowserRouter, type RouteObject } from "react-router"
import { PublicLayout } from "@/components/layout/public-layout"
import { RouteError } from "./route-error"

/** Sahifa kodi yuklanguncha ko'rsatiladigan oddiy ekran */
function AppLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background" role="status" aria-label="Yuklanmoqda">
      <span className="size-8 animate-spin rounded-full border-2 border-pitch-200 border-t-gold motion-reduce:animate-none" />
    </div>
  )
}

type PageModule = { default: React.ComponentType }
const page = (load: () => Promise<PageModule>): Pick<RouteObject, "lazy"> => ({
  lazy: async () => ({ Component: (await load()).default }),
})

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    errorElement: <RouteError />,
    HydrateFallback: AppLoading,
    children: [
      { index: true, ...page(() => import("@/pages/public/home-page")) },
      { path: "oyinlar", ...page(() => import("@/pages/public/matches-page")) },
      { path: "oyinlar/:matchId", ...page(() => import("@/pages/public/match-page")) },
      { path: "jadval", ...page(() => import("@/pages/public/standings-page")) },
      { path: "pley-off", ...page(() => import("@/pages/public/playoff-page")) },
      { path: "jamoalar", ...page(() => import("@/pages/public/teams-page")) },
      { path: "jamoalar/:teamId", ...page(() => import("@/pages/public/team-page")) },
      { path: "futbolchilar", ...page(() => import("@/pages/public/players-page")) },
      { path: "futbolchilar/:playerId", ...page(() => import("@/pages/public/player-page")) },
      { path: "statistika", ...page(() => import("@/pages/public/stats-page")) },
      { path: "ramziy-jamoa", ...page(() => import("@/pages/public/round-team-page")) },
      { path: "yangiliklar", ...page(() => import("@/pages/public/news-page")) },
      { path: "yangiliklar/:slug", ...page(() => import("@/pages/public/news-item-page")) },
      { path: "mavsumlar", ...page(() => import("@/pages/public/seasons-page")) },
      { path: "chempionlar", ...page(() => import("@/pages/public/champions-page")) },
      { path: "homiylar", ...page(() => import("@/pages/public/sponsors-page")) },
      { path: "liga-haqida", ...page(() => import("@/pages/public/about-page")) },
      { path: "nizom", ...page(() => import("@/pages/public/rules-page")) },
      { path: "maxfiylik", ...page(() => import("@/pages/public/privacy-page")) },
      { path: "*", ...page(() => import("@/pages/public/not-found-page")) },
    ],
  },
  {
    path: "admin/kirish",
    errorElement: <RouteError />,
    HydrateFallback: AppLoading,
    ...page(() => import("@/pages/admin/login-page")),
  },
  {
    path: "admin",
    errorElement: <RouteError />,
    HydrateFallback: AppLoading,
    lazy: async () => ({ Component: (await import("@/components/layout/admin-layout")).AdminLayout }),
    children: [
      { index: true, ...page(() => import("@/pages/admin/dashboard-page")) },
      { path: "mavsumlar", ...page(() => import("@/pages/admin/seasons-page")) },
      { path: "jamoalar", ...page(() => import("@/pages/admin/teams-page")) },
      { path: "futbolchilar", ...page(() => import("@/pages/admin/players-page")) },
      { path: "guruhlar", ...page(() => import("@/pages/admin/groups-page")) },
      { path: "oyinlar", ...page(() => import("@/pages/admin/matches-page")) },
      { path: "natijalar", ...page(() => import("@/pages/admin/results-page")) },
      { path: "natijalar/:matchId", ...page(() => import("@/pages/admin/result-entry-page")) },
      { path: "natijalar/:matchId/bayonnoma", ...page(() => import("@/pages/admin/match-sheet-page")) },
      { path: "pley-off", ...page(() => import("@/pages/admin/playoff-page")) },
      { path: "ramziy-jamoa", ...page(() => import("@/pages/admin/round-team-page")) },
      { path: "yangiliklar", ...page(() => import("@/pages/admin/news-page")) },
      { path: "homiylar", ...page(() => import("@/pages/admin/sponsors-page")) },
      { path: "hisobotlar", ...page(() => import("@/pages/admin/reports-page")) },
      { path: "tashriflar", ...page(() => import("@/pages/admin/visits-page")) },
      { path: "sozlamalar", ...page(() => import("@/pages/admin/settings-page")) },
      { path: "hisobim", ...page(() => import("@/pages/admin/account-page")) },
    ],
  },
])
