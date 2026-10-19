import { Link } from "react-router"
import { Button } from "@/components/ui/button"

export default function NotFoundPage() {
  return (
    <div className="container-page flex min-h-[55dvh] flex-col items-center justify-center py-16 text-center">
      <p className="font-score text-5xl text-gold-text">404</p>
      <h1 className="mt-3 font-display text-2xl">Sahifa topilmadi</h1>
      <p className="mt-2 max-w-md text-muted-foreground">Havola eskirgan yoki noto‘g‘ri kiritilgan bo‘lishi mumkin.</p>
      <Button asChild className="mt-6">
        <Link to="/">Bosh sahifaga qaytish</Link>
      </Button>
    </div>
  )
}
