import { zodResolver } from "@hookform/resolvers/zod"
import {
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  ImageUp,
  Lightbulb,
  LoaderCircle,
  MessageCircle,
  MessageSquareText,
  Send,
  ShieldAlert,
  TriangleAlert,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react"
import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import { Controller, useForm, useWatch, type UseFormRegisterReturn } from "react-hook-form"
import { Link, useSearchParams } from "react-router"
import { z } from "zod"
import { api } from "@/api/client"
import type { FeedbackKind } from "@/api/types"
import { Field } from "@/components/admin/admin-ui"
import { PageHeader } from "@/components/league/states"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { Position } from "@/domain/types"
import { BIRTH_YEAR_MAX, BIRTH_YEAR_MIN, FEEDBACK_KIND_LABEL, PHONE_PATTERN, TEAM_SIZE } from "@/lib/applications"
import { POSITION_LABEL } from "@/lib/format"
import { prepareImage } from "@/lib/image"
import { nameKey } from "@/lib/team-names"
import { cn } from "@/lib/utils"

type Kind = "jamoa" | "taklif"

const POSITIONS: Position[] = ["GK", "DF", "MF", "FW"]
const DRAFT_KEY = "pol-team-application-draft"

/** Botlar uchun tuzoq: odam ko'rmaydi va to'ldirmaydi, bot to'ldirsa — server murojaatni jimgina tashlaydi */
function Honeypot({ field }: { field: UseFormRegisterReturn }) {
  return (
    <div aria-hidden="true" className="absolute -left-[10000px] size-px overflow-hidden">
      <label htmlFor="appeal-website">Veb-sayt</label>
      <input id="appeal-website" tabIndex={-1} autoComplete="off" {...field} />
    </div>
  )
}

function ServerError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  )
}

// ---------- Jamoa arizasi ----------

const playerSchema = z.object({
  firstName: z.string().trim().min(2, "Ismini kiriting").max(40, "40 ta belgidan oshmasin"),
  lastName: z.string().trim().min(2, "Familiyasini kiriting").max(40, "40 ta belgidan oshmasin"),
  position: z.string().refine((v) => POSITIONS.includes(v as Position), "Pozitsiyasini tanlang"),
  birthYear: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d{4}$/.test(v) && Number(v) >= BIRTH_YEAR_MIN && Number(v) <= BIRTH_YEAR_MAX), `${BIRTH_YEAR_MIN}–${BIRTH_YEAR_MAX} yoki bo‘sh`),
})

const teamSchema = z
  .object({
    teamName: z.string().trim().min(2, "Jamoa nomini kiriting (kamida 2 ta belgi)").max(40, "Jamoa nomi 40 ta belgidan oshmasin"),
    village: z.string().trim().max(60, "60 ta belgidan oshmasin"),
    contactPhone: z.string().trim().refine((v) => v === "" || PHONE_PATTERN.test(v), "Telefon raqamini +998 90 123 45 67 ko‘rinishida kiriting"),
    players: z.array(playerSchema).length(TEAM_SIZE),
    agree: z.boolean().refine((v) => v, "Shartlar bilan tanishganingizni belgilang"),
    website: z.string(),
  })
  .superRefine((v, ctx) => {
    const seen = new Map<string, number>()
    v.players.forEach((p, i) => {
      if (p.firstName.trim().length < 2 || p.lastName.trim().length < 2) return
      const key = nameKey(`${p.firstName} ${p.lastName}`)
      const first = seen.get(key)
      if (first != null) ctx.addIssue({ code: "custom", path: ["players", i, "lastName"], message: `${first + 1}-futbolchi bilan bir xil` })
      else seen.set(key, i)
    })
    if (v.players.every((p) => p.position) && !v.players.some((p) => p.position === "GK")) {
      ctx.addIssue({ code: "custom", path: ["players", 0, "position"], message: "Kamida bitta darvozabon bo‘lsin" })
    }
  })
type TeamValues = z.infer<typeof teamSchema>

const emptyPlayer = () => ({ firstName: "", lastName: "", position: "", birthYear: "" })
const emptyTeam = (): TeamValues => ({
  teamName: "",
  village: "",
  contactPhone: "",
  players: Array.from({ length: TEAM_SIZE }, emptyPlayer),
  agree: false,
  website: "",
})

/** Yozilgan ma'lumot telefonda yo'qolmasin (sahifa yopilsa yoki internet uzilsa): qoralama shu brauzerda saqlanadi */
function readDraft(): TeamValues | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const d = JSON.parse(raw) as Partial<TeamValues>
    if (!Array.isArray(d.players) || d.players.length !== TEAM_SIZE) return null
    const text = (v: unknown) => (typeof v === "string" ? v : "")
    const draft: TeamValues = {
      teamName: text(d.teamName),
      village: text(d.village),
      contactPhone: text(d.contactPhone),
      players: d.players.map((p) => ({ firstName: text(p?.firstName), lastName: text(p?.lastName), position: text(p?.position), birthYear: text(p?.birthYear) })),
      agree: false,
      website: "",
    }
    // Hech narsa yozilmagan bo'lsa, tiklanadigan narsa yo'q
    const filled = [draft.teamName, draft.village, draft.contactPhone, ...draft.players.flatMap((p) => Object.values(p))].some((v) => v.trim())
    return filled ? draft : null
  } catch {
    return null
  }
}

const clearDraft = () => {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    // Saqlash taqiqlangan brauzer
  }
}

function LogoPicker({ logo, onChange, error }: { logo: { blob: Blob; name: string; preview: string } | null; onChange: (file: File | null) => void; error: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  return (
    <div className="space-y-1.5">
      <p id={`${inputId}-label`} className="text-sm font-semibold">
        Jamoa logotipi<span className="text-destructive" aria-hidden="true"> *</span>
      </p>
      <div className="flex items-center gap-3">
        <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
          {logo ? <img src={logo.preview} alt="Tanlangan logotip" width={64} height={64} className="size-full object-contain" /> : <ImageUp className="size-6 text-muted-foreground" aria-hidden="true" />}
        </span>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            aria-labelledby={`${inputId}-label`}
            onChange={(e) => {
              onChange(e.target.files?.[0] ?? null)
              e.target.value = ""
            }}
          />
          <Button
            type="button"
            variant="outline"
            data-logo-button
            aria-describedby={error ? `${inputId}-error` : `${inputId}-hint`}
            aria-invalid={Boolean(error)}
            onClick={() => inputRef.current?.click()}
          >
            <ImageUp aria-hidden="true" />
            {logo ? "Boshqa rasm tanlash" : "Logotipni tanlash"}
          </Button>
          {logo && (
            <Button type="button" variant="ghost" onClick={() => onChange(null)}>
              <X aria-hidden="true" />
              Olib tashlash
            </Button>
          )}
        </div>
      </div>
      {error ? (
        <p id={`${inputId}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : (
        <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">
          PNG, JPG yoki WebP. Rasm avtomatik kichraytiriladi.
        </p>
      )}
    </div>
  )
}

function TeamApplicationForm({ onSent }: { onSent: (teamName: string) => void }) {
  const [restored] = useState(() => readDraft())
  const form = useForm<TeamValues>({ resolver: zodResolver(teamSchema), defaultValues: restored ?? emptyTeam(), mode: "onTouched" })
  const { errors } = form.formState
  const players = useWatch({ control: form.control, name: "players" })
  const done = players.filter((p) => p.firstName.trim().length >= 2 && p.lastName.trim().length >= 2 && p.position).length
  const [logo, setLogo] = useState<{ blob: Blob; name: string; preview: string } | null>(null)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showRestored, setShowRestored] = useState(Boolean(restored))

  useEffect(() => {
    const sub = form.watch((v) => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...v, agree: false, website: "" }))
      } catch {
        // Saqlash taqiqlangan brauzer — forma baribir ishlaydi
      }
    })
    return () => sub.unsubscribe()
  }, [form])
  useEffect(() => () => {
    if (logo) URL.revokeObjectURL(logo.preview)
  }, [logo])

  const pickLogo = async (file: File | null) => {
    setLogoError(null)
    if (!file) {
      setLogo(null)
      return
    }
    try {
      const { blob, name } = await prepareImage(file)
      setLogo({ blob, name, preview: URL.createObjectURL(blob) })
    } catch {
      setLogoError("Rasmni o‘qib bo‘lmadi. Boshqa rasm tanlang (PNG, JPG yoki WebP).")
    }
  }

  const focusLogo = () => document.querySelector<HTMLButtonElement>("[data-logo-button]")?.focus()

  const submit = form.handleSubmit(
    async (v) => {
      if (!logo) {
        setLogoError("Jamoa logotipini tanlang.")
        focusLogo()
        return
      }
      setServerError(null)
      setSubmitting(true)
      try {
        await api.submitTeamApplication(
          {
            teamName: v.teamName,
            village: v.village,
            contactPhone: v.contactPhone,
            website: v.website,
            players: v.players.map((p) => ({ firstName: p.firstName, lastName: p.lastName, position: p.position as Position, birthYear: p.birthYear ? Number(p.birthYear) : null })),
          },
          logo.blob,
          logo.name,
        )
        clearDraft()
        onSent(v.teamName.trim())
      } catch (err) {
        setServerError(err instanceof Error ? err.message : "Arizani yuborib bo‘lmadi. Qayta urinib ko‘ring.")
      } finally {
        setSubmitting(false)
      }
    },
    () => {
      if (!logo) setLogoError("Jamoa logotipini tanlang.")
    },
  )

  return (
    <form onSubmit={submit} noValidate className="relative space-y-5" aria-labelledby="team-form-title">
      <h2 id="team-form-title" className="sr-only">
        Yangi mavsumga qo‘shilish arizasi
      </h2>
      <div role="note" className="flex gap-3 rounded-xl border border-gold/50 bg-gold-soft p-4 text-sm leading-6">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-gold-text" aria-hidden="true" />
        <div>
          <p className="font-semibold">Yuborishdan oldin diqqat qiling</p>
          <p>Ariza qabul qilinsa, jamoangiz butun mavsum davomida:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            <li>
              <strong>shu nom</strong> bilan ishtirok etadi;
            </li>
            <li>
              yuborgan <strong>logotipingiz</strong> bilan chiqadi;
            </li>
            <li>
              faqat shu ro‘yxatdagi <strong>{TEAM_SIZE} ta futbolchi</strong> bilan o‘ynaydi.
            </li>
          </ul>
        </div>
      </div>

      {showRestored && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
          Oldin kiritilgan ma’lumotlar tiklandi (logotipni qayta tanlang).
          <button
            type="button"
            className="min-h-11 font-semibold text-gold-text underline underline-offset-4"
            onClick={() => {
              clearDraft()
              form.reset(emptyTeam())
              setShowRestored(false)
            }}
          >
            Tozalab, boshidan to‘ldirish
          </button>
        </p>
      )}

      <section aria-labelledby="team-section-title" className="panel space-y-4 p-4 md:p-5">
        <h3 id="team-section-title" className="font-display text-lg">
          Jamoa
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Jamoa nomi" htmlFor="ap-team" error={errors.teamName?.message} required hint="Saytda va jadvallarda aynan shunday yoziladi">
            <Input id="ap-team" autoComplete="organization" maxLength={40} aria-invalid={Boolean(errors.teamName)} {...form.register("teamName")} />
          </Field>
          <Field label="Qishloq yoki mahalla" htmlFor="ap-village" error={errors.village?.message} hint="Ixtiyoriy">
            <Input id="ap-village" maxLength={60} aria-invalid={Boolean(errors.village)} {...form.register("village")} />
          </Field>
          <LogoPicker logo={logo} onChange={pickLogo} error={logoError} />
          <Field label="Bog‘lanish uchun telefon" htmlFor="ap-phone" error={errors.contactPhone?.message} hint="Ixtiyoriy. Saytda ko‘rsatilmaydi">
            <Input id="ap-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+998 90 123 45 67" aria-invalid={Boolean(errors.contactPhone)} {...form.register("contactPhone")} />
          </Field>
        </div>
      </section>

      <section aria-labelledby="players-section-title" className="panel p-4 md:p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 id="players-section-title" className="font-display text-lg">
              Futbolchilar ({TEAM_SIZE} ta)
            </h3>
            <p className="text-sm text-muted-foreground">Ism, familiya va pozitsiya majburiy, tug‘ilgan yil ixtiyoriy. Kamida bitta darvozabon bo‘lsin.</p>
          </div>
          <p className="text-sm font-semibold tabular-nums">
            {done}/{TEAM_SIZE} to‘ldirildi
          </p>
        </div>
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className="h-full rounded-full bg-pitch-500 transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${(done / TEAM_SIZE) * 100}%` }} />
        </div>

        <div aria-hidden="true" className="hidden gap-2 px-0 pb-1 text-xs font-medium text-muted-foreground md:grid md:grid-cols-[2rem_1fr_1fr_12rem_7.5rem]">
          <span className="text-center">№</span>
          <span>Ism</span>
          <span>Familiya</span>
          <span>Pozitsiya</span>
          <span>Tug‘ilgan yil</span>
        </div>
        <ol className="space-y-3 md:space-y-2">
          {players.map((_, i) => {
            const e = errors.players?.[i]
            const id = (f: string) => `ap-p${i}-${f}`
            return (
              <li key={i}>
                <fieldset className="rounded-xl border border-border p-3 md:border-0 md:p-0">
                  <legend className="mb-2 text-sm font-semibold md:sr-only">{i + 1}-futbolchi</legend>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-3 md:grid-cols-[2rem_1fr_1fr_12rem_7.5rem] md:items-start md:gap-y-0">
                    <span className="hidden h-9 items-center justify-center font-score text-muted-foreground md:flex" aria-hidden="true">
                      {i + 1}
                    </span>
                    <div className="space-y-1">
                      <Label htmlFor={id("first")} className="text-xs md:sr-only">
                        Ism
                      </Label>
                      <Input id={id("first")} autoComplete="off" maxLength={40} aria-invalid={Boolean(e?.firstName)} aria-describedby={e?.firstName ? id("first-error") : undefined} {...form.register(`players.${i}.firstName`)} />
                      {e?.firstName && (
                        <p id={id("first-error")} className="text-xs text-destructive">
                          {e.firstName.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={id("last")} className="text-xs md:sr-only">
                        Familiya
                      </Label>
                      <Input id={id("last")} autoComplete="off" maxLength={40} aria-invalid={Boolean(e?.lastName)} aria-describedby={e?.lastName ? id("last-error") : undefined} {...form.register(`players.${i}.lastName`)} />
                      {e?.lastName && (
                        <p id={id("last-error")} className="text-xs text-destructive">
                          {e.lastName.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={id("pos")} className="text-xs md:sr-only">
                        Pozitsiya
                      </Label>
                      <Controller
                        control={form.control}
                        name={`players.${i}.position`}
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger
                              id={id("pos")}
                              ref={field.ref}
                              onBlur={field.onBlur}
                              className="w-full"
                              aria-invalid={Boolean(e?.position)}
                              aria-describedby={e?.position ? id("pos-error") : undefined}
                            >
                              <SelectValue placeholder="Tanlang" />
                            </SelectTrigger>
                            <SelectContent>
                              {POSITIONS.map((p) => (
                                <SelectItem key={p} value={p}>
                                  {POSITION_LABEL[p]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {e?.position && (
                        <p id={id("pos-error")} className="text-xs text-destructive">
                          {e.position.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={id("year")} className="text-xs md:sr-only">
                        Tug‘ilgan yil (ixtiyoriy)
                      </Label>
                      <Input
                        id={id("year")}
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={4}
                        placeholder="Masalan, 2001"
                        aria-invalid={Boolean(e?.birthYear)}
                        aria-describedby={e?.birthYear ? id("year-error") : undefined}
                        {...form.register(`players.${i}.birthYear`)}
                      />
                      {e?.birthYear && (
                        <p id={id("year-error")} className="text-xs text-destructive">
                          {e.birthYear.message}
                        </p>
                      )}
                    </div>
                  </div>
                </fieldset>
              </li>
            )
          })}
        </ol>
      </section>

      <div className="panel space-y-4 p-4 md:p-5">
        <Controller
          control={form.control}
          name="agree"
          render={({ field }) => (
            <div className="space-y-1">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="ap-agree"
                  ref={field.ref}
                  checked={field.value}
                  onCheckedChange={(v) => field.onChange(v === true)}
                  aria-invalid={Boolean(errors.agree)}
                  aria-describedby={errors.agree ? "ap-agree-error" : undefined}
                  className="mt-0.5 size-5"
                />
                {/* Oddiy label: matn va havola bitta xatboshi bo'lib oqadi */}
                <label htmlFor="ap-agree" className="cursor-pointer text-sm leading-6">
                  Ogohlantirish bilan tanishdim: jamoa shu nom, logotip va {TEAM_SIZE} ta futbolchi bilan ishtirok etadi. Ma’lumotlar faqat liga tashkilotchilariga yuboriladi (
                  <Link to="/maxfiylik" className="font-semibold underline underline-offset-4">
                    maxfiylik siyosati
                  </Link>
                  ).
                </label>
              </div>
              {errors.agree && (
                <p id="ap-agree-error" role="alert" className="text-sm text-destructive">
                  {errors.agree.message}
                </p>
              )}
            </div>
          )}
        />
        <Honeypot field={form.register("website")} />
        <ServerError message={serverError} />
        <Button type="submit" size="lg" disabled={submitting} className="w-full sm:w-auto">
          {submitting ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
          {submitting ? "Yuborilmoqda…" : "Arizani yuborish"}
        </Button>
      </div>
    </form>
  )
}

// ---------- Taklif, shikoyat va murojaat ----------

const KIND_ICON: Record<FeedbackKind, LucideIcon> = { SUGGESTION: Lightbulb, COMPLAINT: TriangleAlert, REQUEST: MessageCircle }
const KINDS: FeedbackKind[] = ["SUGGESTION", "COMPLAINT", "REQUEST"]

const feedbackSchema = z.object({
  kind: z.string().refine((v) => KINDS.includes(v as FeedbackKind), "Murojaat turini tanlang"),
  body: z.string().trim().min(10, "Matnni yozing (kamida 10 ta belgi)").max(2000, "Matn 2000 ta belgidan oshmasin"),
  authorName: z.string().trim().max(60, "60 ta belgidan oshmasin"),
  phone: z.string().trim().refine((v) => v === "" || PHONE_PATTERN.test(v), "Telefon raqamini +998 90 123 45 67 ko‘rinishida kiriting"),
  website: z.string(),
})
type FeedbackValues = z.infer<typeof feedbackSchema>

function FeedbackForm({ onSent }: { onSent: (withPhone: boolean) => void }) {
  const form = useForm<FeedbackValues>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: { kind: "", body: "", authorName: "", phone: "", website: "" },
    mode: "onTouched",
  })
  const { errors } = form.formState
  const body = useWatch({ control: form.control, name: "body" })
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = form.handleSubmit(async (v) => {
    setServerError(null)
    setSubmitting(true)
    try {
      await api.submitFeedback({ kind: v.kind as FeedbackKind, body: v.body, authorName: v.authorName, phone: v.phone, website: v.website })
      onSent(Boolean(v.phone.trim()))
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Murojaatni yuborib bo‘lmadi. Qayta urinib ko‘ring.")
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <form onSubmit={submit} noValidate className="panel relative space-y-5 p-4 md:p-6" aria-labelledby="feedback-form-title">
      <h2 id="feedback-form-title" className="sr-only">
        Taklif, shikoyat yoki murojaat
      </h2>
      <fieldset aria-describedby={errors.kind ? "fb-kind-error" : undefined}>
        <legend className="mb-2 text-sm font-semibold">
          Murojaat turi<span className="text-destructive" aria-hidden="true"> *</span>
        </legend>
        <div className="grid grid-cols-3 gap-2">
          {KINDS.map((k) => {
            const Icon = KIND_ICON[k]
            return (
              <label
                key={k}
                className={cn(
                  "flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-border px-2 text-sm font-semibold transition-colors duration-150 sm:min-h-12 sm:flex-row sm:gap-2 sm:text-base",
                  "hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-secondary has-[:checked]:text-primary dark:has-[:checked]:border-gold-400 dark:has-[:checked]:text-gold-400",
                  "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                )}
              >
                <input type="radio" value={k} className="sr-only" {...form.register("kind")} />
                <Icon className="size-[18px]" aria-hidden="true" />
                {FEEDBACK_KIND_LABEL[k]}
              </label>
            )
          })}
        </div>
        {errors.kind && (
          <p id="fb-kind-error" role="alert" className="mt-1.5 text-sm text-destructive">
            {errors.kind.message}
          </p>
        )}
      </fieldset>

      <Field label="Matn" htmlFor="fb-body" error={errors.body?.message} required hint={`${body.trim().length}/2000`}>
        <Textarea id="fb-body" rows={6} maxLength={2000} aria-invalid={Boolean(errors.body)} placeholder="Fikringizni batafsil yozing" {...form.register("body")} />
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Ismingiz" htmlFor="fb-name" error={errors.authorName?.message} hint="Ixtiyoriy">
          <Input id="fb-name" autoComplete="name" maxLength={60} {...form.register("authorName")} />
        </Field>
        <Field label="Telefon" htmlFor="fb-phone" error={errors.phone?.message} hint="Ixtiyoriy — javob olishni istasangiz. Saytda ko‘rsatilmaydi">
          <Input id="fb-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+998 90 123 45 67" aria-invalid={Boolean(errors.phone)} {...form.register("phone")} />
        </Field>
      </div>

      <Honeypot field={form.register("website")} />
      <ServerError message={serverError} />
      <Button type="submit" size="lg" disabled={submitting} className="w-full sm:w-auto">
        {submitting ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
        {submitting ? "Yuborilmoqda…" : "Yuborish"}
      </Button>
    </form>
  )
}

// ---------- Sahifa ----------

function Choice({ to, icon: Icon, title, text }: { to: string; icon: LucideIcon; title: string; text: string }) {
  return (
    <Link
      to={to}
      className="panel group flex h-full items-start gap-4 p-5 transition-colors duration-150 hover:border-pitch-300 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none md:p-6"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary dark:text-gold-400">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-xl">{title}</span>
        <span className="mt-1 block text-sm leading-6 text-muted-foreground md:text-base">{text}</span>
        <span className="mt-3 inline-flex items-center gap-1.5 font-semibold text-gold-text">
          Boshlash
          <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
        </span>
      </span>
    </Link>
  )
}

function Sent({ title, children, onAgain }: { title: string; children: ReactNode; onAgain: () => void }) {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => ref.current?.focus(), [])
  return (
    <div className="panel mx-auto max-w-xl p-6 text-center md:p-8">
      <CircleCheck className="mx-auto size-12 text-win" aria-hidden="true" />
      <h2 ref={ref} tabIndex={-1} className="mt-3 font-display text-2xl outline-none">
        {title}
      </h2>
      <div className="mt-2 text-sm leading-6 text-muted-foreground md:text-base">{children}</div>
      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
        <Button asChild>
          <Link to="/">Bosh sahifaga</Link>
        </Button>
        <Button variant="outline" onClick={onAgain}>
          Yana murojaat yuborish
        </Button>
      </div>
    </div>
  )
}

/**
 * Murojaat va arizalar: yangi mavsumga jamoa arizasi yoki taklif, shikoyat va murojaat.
 * Yuborilganlar admin panelidagi «Arizalar» bo'limiga tushadi.
 */
export default function AppealPage() {
  const [params, setParams] = useSearchParams()
  const tur = params.get("tur")
  const kind: Kind | null = tur === "jamoa" || tur === "taklif" ? tur : null
  const [sent, setSent] = useState<{ kind: Kind; teamName?: string; withPhone?: boolean } | null>(null)

  const go = (next: Kind | null) => {
    setSent(null)
    setParams(next ? { tur: next } : {})
    window.scrollTo({ top: 0 })
  }
  const done = (value: { kind: Kind; teamName?: string; withPhone?: boolean }) => {
    setSent(value)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="container-page pt-5 md:pt-8">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          title={kind === "jamoa" ? "Yangi mavsumga ariza" : kind === "taklif" ? "Taklif, shikoyat yoki murojaat" : "Murojaat va arizalar"}
          description={
            kind === "jamoa"
              ? "Jamoangizni keyingi mavsum ishtirokchilari qatoriga yozdiring. Tashkilotchilar arizani ko‘rib chiqib, qaror qiladi."
              : kind === "taklif"
                ? "Fikringiz liga tashkilotchilariga yetib boradi. Ism va telefon ixtiyoriy."
                : "Liga tashkilotchilariga yozing: jamoangizni yangi mavsumga yozdiring yoki taklif va shikoyatingizni yuboring."
          }
        />
        {kind && !sent && (
          <button
            type="button"
            onClick={() => go(null)}
            className="-mt-2 mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Murojaat turini o‘zgartirish
          </button>
        )}

        {sent ? (
          sent.kind === "jamoa" ? (
            <Sent title="Arizangiz yuborildi" onAgain={() => go(null)}>
              <p>
                Tashkilotchilar arizani ko‘rib chiqadi. Qabul qilinsa, «{sent.teamName}» jamoasi saytdagi{" "}
                <Link to="/jamoalar" className="font-semibold text-foreground underline underline-offset-4">
                  Jamoalar
                </Link>{" "}
                bo‘limida paydo bo‘ladi.
              </p>
            </Sent>
          ) : (
            <Sent title="Murojaatingiz yuborildi" onAgain={() => go(null)}>
              <p>Rahmat! Tashkilotchilar uni o‘qib chiqadi.{sent.withPhone ? " Kerak bo‘lsa, siz bilan telefon orqali bog‘lanishadi." : ""}</p>
            </Sent>
          )
        ) : kind === "jamoa" ? (
          <TeamApplicationForm onSent={(teamName) => done({ kind: "jamoa", teamName })} />
        ) : kind === "taklif" ? (
          <FeedbackForm onSent={(withPhone) => done({ kind: "taklif", withPhone })} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <Choice
              to="?tur=jamoa"
              icon={UsersRound}
              title="Yangi mavsumga ariza"
              text={`Jamoangizni keyingi mavsumga yozdiring: nomi, logotipi va ${TEAM_SIZE} ta futbolchisi bilan.`}
            />
            <Choice to="?tur=taklif" icon={MessageSquareText} title="Taklif, shikoyat yoki murojaat" text="Liga, o‘yinlar yoki sayt haqida fikringizni oddiy matn bilan yozing." />
          </div>
        )}
      </div>
    </div>
  )
}
