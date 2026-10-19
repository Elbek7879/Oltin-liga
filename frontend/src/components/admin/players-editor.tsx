import { ClipboardPaste, Plus, Trash } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { Position } from "@/domain/types"
import { POSITION_LABEL } from "@/lib/format"
import { emptyDraft, parsePlayerList, type PlayerDraft } from "@/lib/player-list"
import { cn } from "@/lib/utils"

const NO_POSITION = "none"
const POSITIONS = Object.keys(POSITION_LABEL) as Position[]

/**
 * Jamoa tarkibini kiritish: qatorma-qator yoki ro'yxatni nusxalab qo'yish orqali.
 * Hamma maydon ixtiyoriy emas: ism va familiya kerak, raqam va pozitsiya — ixtiyoriy.
 */
export function PlayersEditor({
  rows,
  onChange,
  errors,
  idPrefix = "pl",
}: {
  rows: PlayerDraft[]
  onChange: (rows: PlayerDraft[]) => void
  errors: Record<string, string>
  idPrefix?: string
}) {
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState("")
  const patch = (key: string, p: Partial<PlayerDraft>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...p } : r)))

  const applyPaste = () => {
    const parsed = parsePlayerList(pasteText)
    if (parsed.length === 0) return
    // Bo'sh qatorlar o'rniga ro'yxat qo'yiladi
    const kept = rows.filter((r) => r.firstName.trim() || r.lastName.trim() || r.number.trim())
    onChange([...kept, ...parsed])
    setPasteText("")
    setPasteOpen(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setPasteOpen((v) => !v)} aria-expanded={pasteOpen}>
          <ClipboardPaste aria-hidden="true" />
          Ro‘yxatni qo‘yish
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...rows, emptyDraft()])}>
          <Plus aria-hidden="true" />
          Qator qo‘shish
        </Button>
      </div>

      {pasteOpen && (
        <div className="rounded-xl border border-dashed border-border p-3">
          <label htmlFor={`${idPrefix}-paste`} className="text-sm font-semibold">
            Har qatorda bitta futbolchi
          </label>
          <p className="mb-2 text-xs text-muted-foreground">
            Masalan: «10 Aliyev Vali» yoki «1 Karimov Sardor darvozabon». Raqam va pozitsiya ixtiyoriy. Telegram, Excel yoki daftardan nusxalab qo‘yish mumkin.
          </p>
          <Textarea
            id={`${idPrefix}-paste`}
            rows={6}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={"1 Karimov Sardor darvozabon\n5 Toshmatov Anvar\n10 Aliyev Vali"}
          />
          <div className="mt-2 flex gap-2">
            <Button type="button" size="sm" onClick={applyPaste} disabled={!pasteText.trim()}>
              Qatorlarga ajratish
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setPasteOpen(false)}>
              Yopish
            </Button>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <ol className="space-y-2">
          {rows.map((r, i) => (
            <li key={r.key} className={cn("rounded-lg border p-2", errors[r.key] ? "border-destructive/60" : "border-border")}>
              <div className="grid grid-cols-[3.5rem_1fr_auto] gap-2 sm:grid-cols-[3.5rem_1fr_1fr_9rem_auto]">
                <Input
                  aria-label={`${i + 1}-qator: raqam`}
                  inputMode="numeric"
                  placeholder="№"
                  value={r.number}
                  onChange={(e) => patch(r.key, { number: e.target.value.replace(/\D/g, "").slice(0, 2) })}
                  className="text-center"
                />
                <Input aria-label={`${i + 1}-qator: ism`} placeholder="Ism" value={r.firstName} onChange={(e) => patch(r.key, { firstName: e.target.value })} />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="text-destructive hover:text-destructive sm:order-last"
                  aria-label={`${i + 1}-qatorni o‘chirish`}
                  onClick={() => onChange(rows.filter((x) => x.key !== r.key))}
                >
                  <Trash aria-hidden="true" />
                </Button>
                <Input
                  aria-label={`${i + 1}-qator: familiya`}
                  placeholder="Familiya"
                  value={r.lastName}
                  onChange={(e) => patch(r.key, { lastName: e.target.value })}
                  className="col-span-2 sm:col-span-1"
                />
                <Select value={r.position || NO_POSITION} onValueChange={(v) => patch(r.key, { position: v === NO_POSITION ? "" : (v as Position) })}>
                  <SelectTrigger aria-label={`${i + 1}-qator: pozitsiya`} className="col-span-3 w-full sm:col-span-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_POSITION}>Pozitsiya —</SelectItem>
                    {POSITIONS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {POSITION_LABEL[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {errors[r.key] && (
                <p role="alert" className="mt-1 text-xs text-destructive">
                  {i + 1}-qator: {errors[r.key]}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
