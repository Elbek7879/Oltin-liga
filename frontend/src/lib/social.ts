/**
 * Ijtimoiy tarmoq havolalarini bir xil ko'rinishga keltiradi («@kanal», «t.me/kanal» yoki to'liq havola → https://...).
 * Backenddagi SocialLinks.java bilan bir xil qoida (demo rejim uchun). Boshqa saytga havola qabul qilinmaydi.
 */
const RULES = {
  telegramChannel: {
    re: /^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/([A-Za-z0-9_]{4,64})\/?$|^@?([A-Za-z0-9_]{4,64})$/,
    url: (n: string) => `https://t.me/${n}`,
    error: "Telegram kanal havolasini t.me/kanal_nomi ko‘rinishida kiriting.",
  },
  instagram: {
    re: /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9_.]{1,40})\/?(?:\?.*)?$|^@?([A-Za-z0-9_.]{1,40})$/,
    url: (n: string) => `https://www.instagram.com/${n}/`,
    error: "Instagram havolasini instagram.com/sahifa_nomi ko‘rinishida kiriting.",
  },
  youtube: {
    re: /^(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/(@[A-Za-z0-9_.-]{3,40}|channel\/[A-Za-z0-9_-]{10,40}|c\/[A-Za-z0-9_.-]{1,60})\/?(?:\?.*)?$|^(@[A-Za-z0-9_.-]{3,40})$/,
    url: (p: string) => `https://www.youtube.com/${p}`,
    error: "YouTube havolasini youtube.com/@kanal_nomi ko‘rinishida kiriting.",
  },
} as const

export type SocialField = keyof typeof RULES

/** To'g'ri bo'lsa — to'liq havola (bo'sh bo'lsa ""), noto'g'ri bo'lsa — xato matni bilan Error */
export function normalizeSocial(field: SocialField, raw: string | null | undefined): string {
  const value = raw?.trim() ?? ""
  if (!value) return ""
  const rule = RULES[field]
  const m = rule.re.exec(value)
  if (!m) throw new Error(rule.error)
  return rule.url(m[1] ?? m[2])
}
