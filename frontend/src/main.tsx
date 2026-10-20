import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router/dom"
import { newsQuery } from "@/api/hooks"
import { onUnauthorized } from "@/api/http/httpApi"
import { isNotFound } from "@/api/types"
import { router } from "@/app/router"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { initScript } from "@/hooks/use-script"
import { SeasonProvider } from "@/hooks/use-season"
import { ThemeProvider } from "@/hooks/use-theme"
import "./styles/globals.css"

const queryClient = new QueryClient({
  defaultOptions: {
    // «Topilmadi» javobi qayta so'ralmaydi — eski havola darhol tushunarli xabar bilan ochiladi
    queries: { staleTime: 30_000, retry: (count, error) => !isNotFound(error) && count < 1, refetchOnWindowFocus: true },
  },
})

// Sessiya tugasa, admin paneli foydalanuvchini kirish sahifasiga qaytaradi
onUnauthorized(() => queryClient.setQueryData(["me"], null))

// Bosh sahifada eng katta element — yangiliklar: ular sahifa kodi bilan parallel so'raladi
if (window.location.pathname === "/") void queryClient.prefetchQuery(newsQuery())

// Kirill yozuvi tanlangan bo'lsa — birinchi chizishdan oldin yoqiladi (lotincha miltillab ko'rinmasin)
initScript()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SeasonProvider>
          <TooltipProvider delayDuration={300}>
            <RouterProvider router={router} />
            <Toaster position="top-center" richColors={false} closeButton />
          </TooltipProvider>
        </SeasonProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
