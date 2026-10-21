import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Eye, EyeOff, Info, LogIn } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { Link, useNavigate, useSearchParams } from "react-router"
import { z } from "zod"
import { api, IS_DEMO_MODE } from "@/api/client"
import { Field } from "@/components/admin/admin-ui"
import { PitchLines } from "@/components/league/icons"
import { LeagueMark } from "@/components/layout/brand"
import { useLeagueMeta } from "@/hooks/use-document-meta"
import { canOpen } from "@/lib/roles"
import { adminMeta } from "@/lib/seo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const schema = z.object({
  username: z.string().trim().min(1, "Loginni kiriting"),
  password: z.string().min(1, "Parolni kiriting"),
})
type Values = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const client = useQueryClient()
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { username: "", password: "" } })
  useLeagueMeta((league) => adminMeta("Kirish", league))

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      const user = await api.login(values.username, values.password)
      client.setQueryData(["me"], user)
      // Oldingi sahifaga qaytish — faqat panel ichida va shu rol ochadigan bo'lsa
      const next = params.get("keyin")
      const back = next && next.startsWith("/admin/") && !next.startsWith("/admin/kirish") && canOpen(user.role, next.split("?")[0])
      navigate(back ? next : "/admin", { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kirib bo‘lmadi. Qayta urinib ko‘ring.")
    }
  })

  const { errors, isSubmitting } = form.formState

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-band px-4 py-10">
      <PitchLines className="opacity-60" />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center text-band-foreground">
          <LeagueMark size="lg" className="size-28 drop-shadow-[0_0_24px_rgb(226_191_79/0.35)] md:size-32" />
          <h1 className="mt-3 font-display text-2xl text-gold-400">Boshqaruv paneliga kirish</h1>
          <p className="mt-1 text-sm text-band-muted">Payariq Oltin Ligasi tashkilotchilari uchun</p>
        </div>
        <form onSubmit={onSubmit} noValidate className="panel space-y-4 p-5 shadow-xl">
          {IS_DEMO_MODE && (
            <p className="flex gap-2 rounded-lg bg-gold-soft p-3 text-xs">
              <Info className="mt-0.5 size-4 shrink-0 text-gold-text" aria-hidden="true" />
              Namunaviy rejim: istalgan login va parol qabul qilinadi, ma’lumotlar faqat shu brauzerda saqlanadi.
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <Field label="Login" htmlFor="username" error={errors.username?.message}>
            <Input
              id="username"
              autoComplete="username"
              autoCapitalize="none"
              aria-invalid={Boolean(errors.username)}
              aria-describedby={errors.username ? "username-error" : undefined}
              {...form.register("username")}
            />
          </Field>
          <Field label="Parol" htmlFor="password" error={errors.password?.message}>
            <div className="relative">
              <Input
                id="password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                className="pr-12"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "password-error" : undefined}
                {...form.register("password")}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-1/2 right-1 -translate-y-1/2"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Parolni yashirish" : "Parolni ko‘rsatish"}
              >
                {show ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </Button>
            </div>
          </Field>
          <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
            <LogIn aria-hidden="true" />
            {isSubmitting ? "Tekshirilmoqda…" : "Kirish"}
          </Button>
        </form>
        <Link to="/" className="mt-5 flex min-h-10 items-center justify-center gap-1.5 text-sm text-band-muted hover:text-band-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Saytga qaytish
        </Link>
      </div>
    </div>
  )
}
