import { LogIn, LogOut } from "lucide-react"
import { useState, type FormEvent } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { api } from "@/api/client"
import { qk } from "@/api/hooks"
import type { AdminUser } from "@/api/types"
import { PasswordInput } from "@/components/admin/password-input"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { setSessionExpired } from "@/lib/session-expired"

/**
 * Ish paytida sessiya tugasa, sahifa yopilmaydi: shu oynada qayta kiriladi va
 * yozilgan natija yoki yangilik joyida qoladi — «Saqlash»ni qayta bosish kifoya.
 */
export function ReloginDialog({ me, onLogout }: { me: AdminUser; onLogout: () => void }) {
  const client = useQueryClient()
  const [username, setUsername] = useState(me.username)
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) {
      setError("Login va parolni kiriting.")
      return
    }
    setPending(true)
    setError(null)
    try {
      const user = await api.login(username.trim(), password)
      client.setQueryData(qk.me, user)
      setSessionExpired(false)
      void client.invalidateQueries({ queryKey: ["admin"] })
      toast.success("Qayta kirdingiz. Kiritgan ma’lumotlaringiz joyida — amalni yana bir bor bajaring.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kirib bo‘lmadi. Qayta urinib ko‘ring.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Qayta kiring</DialogTitle>
          <DialogDescription>
            Sessiya tugadi (uzoq vaqt kirilmadi yoki sayt yangilandi). Kiritgan ma’lumotlaringiz shu sahifada saqlanib turibdi — kirgach, amalni takrorlang.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="relogin-username">Login</Label>
            <Input id="relogin-username" autoComplete="username" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="relogin-password">Parol</Label>
            <PasswordInput id="relogin-password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onLogout}>
              <LogOut aria-hidden="true" />
              Chiqish
            </Button>
            <Button type="submit" disabled={pending}>
              <LogIn aria-hidden="true" />
              {pending ? "Tekshirilmoqda…" : "Kirish"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
