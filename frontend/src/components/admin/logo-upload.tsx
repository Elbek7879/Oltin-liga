import { ImageUp, LoaderCircle, X } from "lucide-react"
import { useId, useRef, useState, type ReactNode } from "react"
import { api } from "@/api/client"
import { Button } from "@/components/ui/button"
import { prepareImage } from "@/lib/image"

/**
 * Logotip yuklash: rasm brauzerda kichraytirilib WebP ga o'tkaziladi, keyin serverga yuklanadi.
 * Natijada olingan manzil formaga qaytariladi.
 */
export function LogoUpload({
  value,
  onChange,
  preview,
  label = "Logotip",
}: {
  value: string | null | undefined
  onChange: (url: string | null) => void
  preview: ReactNode
  label?: string
}) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      const { blob, name } = await prepareImage(file)
      const { url } = await api.uploadMedia(blob, name)
      onChange(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rasmni yuklab bo‘lmadi.")
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold">{label}</p>
      <div className="flex items-center gap-3">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">{preview}</span>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(e) => onFile(e.target.files?.[0])}
            disabled={busy}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy} aria-controls={inputId}>
            {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <ImageUp aria-hidden="true" />}
            {busy ? "Yuklanmoqda…" : value ? "Boshqa rasm" : "Rasm yuklash"}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)} disabled={busy}>
              <X aria-hidden="true" />
              Olib tashlash
            </Button>
          )}
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">PNG, JPG yoki WebP. Rasm avtomatik kichraytiriladi.</p>
      )}
    </div>
  )
}
