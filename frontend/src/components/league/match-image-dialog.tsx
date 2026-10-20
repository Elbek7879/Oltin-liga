import { useMemo } from "react"
import type { Match } from "@/domain/types"
import type { SeasonIndex } from "@/hooks/use-season-data"
import { useScript } from "@/hooks/use-script"
import { matchCaption, matchImageData, matchImageFileName, matchImageInCyrillic, renderMatchImage } from "@/lib/match-image"
import { ImageShareDialog } from "./image-share-dialog"

export function matchImageTitle(match: Match) {
  if (match.status === "FINISHED") return "Natija rasmi"
  if (match.status === "LIVE") return "Hisob rasmi"
  return "Anons rasmi"
}

/** O'yin rasmi oynasi: natija, jonli hisob yoki anons */
export function MatchImageDialog({ match, index, open, onOpenChange }: { match: Match; index: SeasonIndex; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { script } = useScript()
  const source = useMemo(() => matchImageData(match, index), [match, index])
  // Sayt kirill yozuvida bo'lsa — rasm va post matni ham kirillcha (fayl nomi lotincha qoladi)
  const data = useMemo(() => (script === "cyrl" ? matchImageInCyrillic(source) : source), [source, script])
  const caption = matchCaption(data)
  const title = matchImageTitle(match)
  return (
    <ImageShareDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="Telegram kanali va guruhlar uchun tayyor rasm. Yuklab oling yoki to‘g‘ridan-to‘g‘ri ulashing."
      render={() => renderMatchImage(data)}
      renderKey={JSON.stringify(data)}
      fileName={matchImageFileName(match, source)}
      caption={caption}
      alt={`${title}: ${caption.split("\n").slice(0, 2).join(", ")}`}
    />
  )
}
