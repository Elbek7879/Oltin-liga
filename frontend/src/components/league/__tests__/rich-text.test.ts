import { describe, expect, it } from "vitest"
import { toCyrillic } from "@/lib/translit"
import { introOf, parseRichText } from "../rich-text"

describe("«Liga haqida» matni: oddiy belgilash", () => {
  const text = `**Oltin Liga** — havaskorlar chempionati.
Ikkinchi qator ham shu xatboshida.

## Kimlar qatnashadi?
- Qishloq jamoalari
- 16 yoshdan katta

## Qanday qatnashiladi?
1. Murojaat qiling
2. Qur’a tashlanadi`

  it("sarlavha, ro‘yxat va xatboshilar to‘g‘ri ajraladi", () => {
    expect(parseRichText(text)).toEqual([
      { kind: "p", text: "**Oltin Liga** — havaskorlar chempionati. Ikkinchi qator ham shu xatboshida." },
      { kind: "h", text: "Kimlar qatnashadi?" },
      { kind: "ul", items: ["Qishloq jamoalari", "16 yoshdan katta"] },
      { kind: "h", text: "Qanday qatnashiladi?" },
      { kind: "ol", items: ["Murojaat qiling", "Qur’a tashlanadi"] },
    ])
  })

  it("bosh sahifa uchun birinchi xatboshi belgilarsiz olinadi; oddiy matn ham ishlaydi", () => {
    expect(introOf(text)).toBe("Oltin Liga — havaskorlar chempionati. Ikkinchi qator ham shu xatboshida.")
    expect(introOf("## Faqat sarlavha")).toBe("")
    expect(introOf("Oddiy bitta xatboshi")).toBe("Oddiy bitta xatboshi")
  })

  it("Telegram nomi kirill rejimida o‘girilmaydi", () => {
    expect(toCyrillic("Telegram @Sanjar12ab orqali yozing")).toBe("Телеграм @Sanjar12ab орқали ёзинг")
  })
})
