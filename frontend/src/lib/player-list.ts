import type { PlayerRowInput } from "@/api/types"
import type { Position } from "@/domain/types"

/** Tahrirlanayotgan qator (formada) */
export interface PlayerDraft {
  key: string
  number: string
  firstName: string
  lastName: string
  position: Position | ""
}

let seq = 0
export const emptyDraft = (): PlayerDraft => ({ key: `p${seq++}`, number: "", firstName: "", lastName: "", position: "" })

const POSITION_WORDS: [RegExp, Position][] = [
  [/^(d|dv|darv|darvozabon|gk|goalkeeper|вратарь)\.?$/i, "GK"],
  [/^(h|him|himoyachi|df|def|защитник)\.?$/i, "DF"],
  [/^(y|yh|yarim|yarimhimoyachi|yarim-himoyachi|mf|mid|полузащитник)\.?$/i, "MF"],
  [/^(hu|huj|hujumchi|fw|forward|нападающий)\.?$/i, "FW"],
]

/** Ikki so'zli pozitsiyalar: «yarim himoyachi» */
const POSITION_PHRASES: [RegExp, Position][] = [[/^yarim\s+himoyachi$/i, "MF"]]

/** Familiya qo'shimchalari: «Aliyev», «Karimova», «Rahmonov», «Qodiriy» */
const SURNAME = /(ov|ev|yev|ova|eva|yeva|iy|boyev|xo‘jayev|ovich|evich)$/i

function capitalize(word: string) {
  return word ? word[0].toLocaleUpperCase("uz") + word.slice(1) : word
}

/**
 * Nusxalab qo'yilgan ro'yxatni ajratadi. Har qatorda bitta futbolchi:
 *   «10 Aliyev Vali», «10. Vali Aliyev», «1 Karimov Sardor darvozabon», «Rahimov Jasur».
 * Raqam va pozitsiya ixtiyoriy. Familiya qo'shimchasidan (-ov, -ev, -ova ...) qaysi so'z familiya ekani aniqlanadi.
 */
export function parsePlayerList(text: string): PlayerDraft[] {
  const rows: PlayerDraft[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/[|;,\t]+/g, " ").trim()
    if (!line) continue
    let tokens = line.split(/\s+/)
    let number = ""
    const first = tokens[0].replace(/[.)\-–#№]+$/g, "").replace(/^#|^№/, "")
    if (/^\d{1,2}$/.test(first)) {
      number = String(Number(first))
      tokens = tokens.slice(1)
    }
    let position: Position | "" = ""
    const phrase = tokens.length > 3 ? POSITION_PHRASES.find(([re]) => re.test(tokens.slice(-2).join(" "))) : undefined
    const last = tokens[tokens.length - 1]
    const pos = !phrase && last ? POSITION_WORDS.find(([re]) => re.test(last)) : undefined
    if (phrase) {
      position = phrase[1]
      tokens = tokens.slice(0, -2)
    } else if (pos && tokens.length > 2) {
      position = pos[1]
      tokens = tokens.slice(0, -1)
    }
    const words = tokens.map(capitalize)
    let firstName = ""
    let lastName = ""
    if (words.length === 1) {
      firstName = words[0]
    } else if (SURNAME.test(words[0]) && !SURNAME.test(words[words.length - 1])) {
      lastName = words[0]
      firstName = words.slice(1).join(" ")
    } else {
      firstName = words[0]
      lastName = words.slice(1).join(" ")
    }
    rows.push({ ...emptyDraft(), number, firstName, lastName, position })
  }
  return rows
}

export interface DraftCheck {
  /** Qator kaliti → xato matni */
  errors: Record<string, string>
  /** To'ldirilgan (bo'sh bo'lmagan) qatorlar */
  filled: PlayerDraft[]
}

/** Server bilan bir xil qoidalar: ism va familiya kamida 2 harf, raqam 1–99 va takrorlanmasin */
export function checkDrafts(rows: PlayerDraft[], takenNumbers: number[] = []): DraftCheck {
  const errors: Record<string, string> = {}
  const filled = rows.filter((r) => r.firstName.trim() || r.lastName.trim() || r.number.trim())
  const seen = new Map<string, string>()
  for (const r of filled) {
    if (r.firstName.trim().length < 2) errors[r.key] = "Ismini yozing"
    else if (r.lastName.trim().length < 2) errors[r.key] = "Familiyasini yozing"
    else if (r.number && !/^\d{1,2}$/.test(r.number)) errors[r.key] = "Raqam 1–99"
    else if (r.number && (Number(r.number) < 1 || Number(r.number) > 99)) errors[r.key] = "Raqam 1–99"
    else if (r.number && seen.has(r.number)) errors[r.key] = `${r.number}-raqam takrorlangan`
    else if (r.number && takenNumbers.includes(Number(r.number))) errors[r.key] = `${r.number}-raqam jamoada band`
    if (r.number) seen.set(r.number, r.key)
  }
  return { errors, filled }
}

export function toRowInputs(rows: PlayerDraft[]): PlayerRowInput[] {
  return rows.map((r) => ({
    firstName: r.firstName.trim(),
    lastName: r.lastName.trim(),
    number: r.number ? Number(r.number) : null,
    position: r.position || null,
  }))
}
