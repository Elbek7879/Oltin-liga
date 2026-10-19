import { isRouteErrorResponse, Link, useRouteError } from "react-router"
import { Button } from "@/components/ui/button"

export function RouteError() {
  const error = useRouteError()
  const notFound = isRouteErrorResponse(error) && error.status === 404
  return (
    <div className="container-page flex min-h-[60dvh] flex-col items-center justify-center py-16 text-center">
      <p className="font-score text-5xl text-gold-text">{notFound ? "404" : "Xato"}</p>
      <h1 className="mt-3 font-display text-2xl">{notFound ? "Sahifa topilmadi" : "Sahifani ochishda xato yuz berdi"}</h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        {notFound
          ? "Havola eskirgan yoki noto‘g‘ri kiritilgan bo‘lishi mumkin."
          : "Sahifani yangilab ko‘ring. Xato takrorlansa, tashkilotchilarga xabar bering."}
      </p>
      <div className="mt-6 flex gap-2">
        <Button asChild>
          <Link to="/">Bosh sahifaga</Link>
        </Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Yangilash
        </Button>
      </div>
    </div>
  )
}
