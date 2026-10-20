import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Admin yozgan matnni bo'limlar bilan ko'rsatadi (oddiy belgilash, HTML ishlatilmaydi — xavfsiz):
 *   ## Sarlavha        — bo'lim sarlavhasi
 *   - band             — ro'yxat
 *   1. band            — raqamli ro'yxat
 *   **so'z**           — qalin
 *   bo'sh qator        — yangi xatboshi
 */
type Block = { kind: "h"; text: string } | { kind: "p"; text: string } | { kind: "ul" | "ol"; items: string[] }

export function parseRichText(text: string): Block[] {
  const blocks: Block[] = []
  let para: string[] = []
  const flush = () => {
    if (para.length) blocks.push({ kind: "p", text: para.join(" ") })
    para = []
  }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    const bullet = /^[-•]\s+(.*)$/.exec(line)
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line)
    if (!line) {
      flush()
    } else if (line.startsWith("## ")) {
      flush()
      blocks.push({ kind: "h", text: line.slice(3).trim() })
    } else if (bullet || numbered) {
      flush()
      const kind = bullet ? "ul" : "ol"
      const item = (bullet ?? numbered)![1]
      const last = blocks[blocks.length - 1]
      if (last && last.kind === kind) last.items.push(item)
      else blocks.push({ kind, items: [item] })
    } else {
      para.push(line)
    }
  }
  flush()
  return blocks
}

/** **qalin** bo'laklari */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  )
}

/** Birinchi xatboshi — belgilarsiz (bosh sahifadagi qisqa tanishtiruv uchun) */
export function introOf(text: string) {
  const first = parseRichText(text).find((b) => b.kind === "p")
  return first && first.kind === "p" ? first.text.replace(/\*\*/g, "") : ""
}

export function RichText({ text, className, headingLevel = 2 }: { text: string; className?: string; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3"
  return (
    <div className={cn("space-y-3 text-base leading-7", className)}>
      {parseRichText(text).map((b, i) => {
        if (b.kind === "h")
          return (
            <Heading key={i} className="pt-2 font-display text-lg leading-snug md:text-xl">
              {b.text}
            </Heading>
          )
        if (b.kind === "p") return <p key={i}>{inline(b.text)}</p>
        const List = b.kind === "ul" ? "ul" : "ol"
        return (
          <List key={i} className={cn("space-y-1.5 pl-5", b.kind === "ul" ? "list-disc" : "list-decimal")}>
            {b.items.map((item, j) => (
              <li key={j} className="pl-1">
                {inline(item)}
              </li>
            ))}
          </List>
        )
      })}
    </div>
  )
}
