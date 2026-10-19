import { Eye, EyeOff, Wand } from "lucide-react"
import { useState, type ComponentProps } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/** Chalkash belgilarsiz (0/O, 1/l/I) — telefon orqali aytib berish oson */
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"

/** Kriptografik tasodifiy parol: masalan «kT7m-Qx2p-Hw9r» */
export function generatePassword() {
  const bytes = new Uint32Array(12)
  crypto.getRandomValues(bytes)
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length])
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8, 12)].map((g) => g.join("")).join("-")
}

/** Parolni ko'rsatish/yashirish tugmasi bilan; `onGenerate` berilsa — parol yaratish tugmasi ham chiqadi */
export function PasswordInput({
  className,
  onGenerate,
  ...props
}: Omit<ComponentProps<typeof Input>, "type"> & { onGenerate?: (password: string) => void }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="flex gap-2">
      <div className="relative min-w-0 flex-1">
        <Input
          type={visible ? "text" : "password"}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className={cn("pr-11 font-mono", className)}
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-1/2 right-0.5 -translate-y-1/2 text-muted-foreground"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Parolni yashirish" : "Parolni ko‘rsatish"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </Button>
      </div>
      {onGenerate && (
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          onClick={() => {
            onGenerate(generatePassword())
            setVisible(true)
          }}
        >
          <Wand aria-hidden="true" />
          Yaratish
        </Button>
      )}
    </div>
  )
}
