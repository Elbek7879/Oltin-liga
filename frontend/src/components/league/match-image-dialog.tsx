import { Copy, Download, ImageOff, Share2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import type { Match } from "@/domain/types"
import type { SeasonIndex } from "@/hooks/use-season-data"
import { matchCaption, matchImageData, matchImageFileName, renderMatchImage } from "@/lib/match-image"

/** Rasm fayli bilan ulashish (telefonda Telegram va boshqa ilovalar ro'yxati ochiladi) qo'llab-quvvatlanadimi */
function canShareFiles() {
  try {
    return typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [new File([""], "rasm.png", { type: "image/png" })] })
  } catch {
    return false
  }
}

export function matchImageTitle(match: Match) {
  if (match.status === "FINISHED") return "Natija rasmi"
  if (match.status === "LIVE") return "Hisob rasmi"
  return "Anons rasmi"
}

/**
 * O'yin rasmi oynasi: rasmni ko'rsatadi, yuklab olish, ulashish va post matnini nusxalash imkonini beradi.
 * Rasm faqat oyna ochilganda chiziladi.
 */
export function MatchImageDialog({ match, index, open, onOpenChange }: { match: Match; index: SeasonIndex; open: boolean; onOpenChange: (v: boolean) => void }) {
  const data = useMemo(() => matchImageData(match, index), [match, index])
  const [blob, setBlob] = useState<Blob | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const shareable = useMemo(canShareFiles, [])
  const fileName = matchImageFileName(match, data)
  const caption = matchCaption(data)
  // Ma'lumot o'zgarmagan bo'lsa (sahifa fonda yangilanganda) rasm qayta chizilmaydi
  const dataKey = JSON.stringify(data)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    let objectUrl: string | null = null
    setFailed(false)
    setBlob(null)
    setUrl(null)
    renderMatchImage(data)
      .then((b) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(b)
        setBlob(b)
        setUrl(objectUrl)
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dataKey])

  const download = () => {
    if (!url) return
    const a = document.createElement("a")
    a.href = url
    a.download = fileName
    document.body.append(a)
    a.click()
    a.remove()
    toast.success("Rasm yuklab olindi")
  }

  const share = async () => {
    if (!blob) return
    try {
      await navigator.share({ files: [new File([blob], fileName, { type: "image/png" })], text: caption })
    } catch (err) {
      if ((err as Error).name !== "AbortError") toast.error("Ulashib bo‘lmadi. Rasmni yuklab olib, Telegram’ga qo‘lda yuboring.")
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(caption)
      toast.success("Post matni nusxalandi")
    } catch {
      toast.error("Matnni nusxalab bo‘lmadi")
    }
  }

  const title = matchImageTitle(match)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{title}</DialogTitle>
          <DialogDescription>Telegram kanali va guruhlar uchun tayyor rasm. Yuklab oling yoki to‘g‘ridan-to‘g‘ri ulashing.</DialogDescription>
        </DialogHeader>
        <div className="overflow-hidden rounded-xl border border-border bg-pitch-900">
          {failed ? (
            <div className="grid aspect-[4/5] place-items-center p-6 text-center text-sm text-white/80">
              <span className="flex flex-col items-center gap-2">
                <ImageOff className="size-8" aria-hidden="true" />
                Rasmni tayyorlab bo‘lmadi. Sahifani yangilab, qaytadan urinib ko‘ring.
              </span>
            </div>
          ) : url ? (
            <img src={url} alt={`${title}: ${caption.split("\n").slice(0, 2).join(", ")}`} width={1080} height={1350} className="block h-auto w-full" />
          ) : (
            <Skeleton className="aspect-[4/5] w-full rounded-none bg-pitch-800" aria-label="Rasm tayyorlanmoqda" />
          )}
        </div>
        <details className="rounded-lg border border-border px-3 py-2 text-sm">
          <summary className="cursor-pointer py-1 font-semibold">Post matni</summary>
          <pre className="mt-1 font-sans text-xs whitespace-pre-wrap text-muted-foreground">{caption}</pre>
        </details>
        <DialogFooter className="gap-2 sm:flex-row sm:justify-stretch">
          <Button variant="outline" onClick={copy} className="sm:flex-1">
            <Copy aria-hidden="true" />
            Matnni nusxalash
          </Button>
          {shareable && (
            <Button variant="outline" onClick={share} disabled={!blob} className="sm:flex-1">
              <Share2 aria-hidden="true" />
              Ulashish
            </Button>
          )}
          <Button onClick={download} disabled={!url} className="sm:flex-1">
            <Download aria-hidden="true" />
            Yuklab olish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
