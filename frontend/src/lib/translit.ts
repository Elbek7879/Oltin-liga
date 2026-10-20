/**
 * O'zbek lotin ↔ kirill yozuvi (rasmiy imlo qoidalari bo'yicha).
 * Bazada hamma narsa lotinchada saqlanadi; kirillcha faqat ko'rsatishda (sayt, rasm, post matni).
 */

const APOS = "‘’ʻʼ'`"
const isApos = (c: string | undefined) => Boolean(c) && APOS.includes(c!)
const VOWELS = "aeiouAEIOU"
const isVowel = (c: string | undefined) => Boolean(c) && VOWELS.includes(c!)

const SINGLE: Record<string, string> = {
  a: "а", b: "б", c: "с", d: "д", e: "е", f: "ф", g: "г", h: "ҳ", i: "и", j: "ж", k: "к", l: "л", m: "м",
  n: "н", o: "о", p: "п", q: "қ", r: "р", s: "с", t: "т", u: "у", v: "в", w: "в", x: "х", y: "й", z: "з",
}

/** Imlo qoidasidan tashqari so'zlar (so'z boshi): «Payariq» — «Пайариқ», «Паяриқ» emas */
const EXCEPTIONS: [string, string][] = [["payariq", "пайариқ"]]

/** O'girilmaydigan bo'laklar: havola, e-pochta, domen va fayl turlari kabi lotincha qisqartmalar */
const KEEP = /(https?:\/\/\S+|www\.\S+|@[A-Za-z0-9_]{3,}|[\w.+-]+@[\w-]+\.[\w.-]+|\b[\w-]+\.(?:uz|com|ru|org|net|me)\b|\b(?:PNG|JPG|JPEG|WebP|PDF|QR|SMS|URL|FIFA|UEFA|PWA|YouTube|API|TAS-IX|CSV|Excel|Wi-Fi)\b)/g

function upper(s: string, like: string) {
  return like !== like.toLowerCase() ? s.toUpperCase() : s
}

function wordToCyrillic(word: string): string {
  const lower = word.toLowerCase()
  for (const [key, value] of EXCEPTIONS) {
    if (lower.startsWith(key)) {
      const head = word === word.toUpperCase() ? value.toUpperCase() : word[0] !== word[0].toLowerCase() ? value[0].toUpperCase() + value.slice(1) : value
      return head + wordToCyrillic(word.slice(key.length)).replace(/^э/, "е").replace(/^Э/, "Е")
    }
  }
  let out = ""
  for (let i = 0; i < word.length; ) {
    const ch = word[i]
    const lc = ch.toLowerCase()
    const next = word[i + 1]
    const nl = next?.toLowerCase()
    if (isApos(ch)) {
      // Tutuq belgisi: unlidan keyin yoki undosh+unli orasida — «ъ» (ma’lumot, san’at); undoshlar orasida (Telegram’ga) — tushib qoladi
      const prev = word[i - 1]
      if (prev && (isVowel(prev) || isVowel(next))) out += "ъ"
      i += 1
      continue
    }
    if (lc === "o" && isApos(next)) {
      out += upper("ў", ch)
      i += 2
      continue
    }
    if (lc === "g" && isApos(next)) {
      out += upper("ғ", ch)
      i += 2
      continue
    }
    if (lc === "s" && nl === "h") {
      out += upper("ш", ch)
      i += 2
      continue
    }
    if (lc === "c" && nl === "h") {
      out += upper("ч", ch)
      i += 2
      continue
    }
    if (lc === "y") {
      if (nl === "o" && !isApos(word[i + 2])) {
        out += upper("ё", ch)
        i += 2
        continue
      }
      const pair = nl === "u" ? "ю" : nl === "a" ? "я" : nl === "e" ? "е" : null
      if (pair) {
        out += upper(pair, ch)
        i += 2
        continue
      }
      out += upper("й", ch)
      i += 1
      continue
    }
    if (lc === "e") {
      // So'z boshida — «э» (eng → энг), boshqa joyda — «е»
      out += upper(i === 0 ? "э" : "е", ch)
      i += 1
      continue
    }
    const mapped = SINGLE[lc]
    out += mapped ? upper(mapped, ch) : ch
    i += 1
  }
  return out
}

function segmentToCyrillic(text: string) {
  return text.replace(/[A-Za-z][A-Za-z‘’ʻʼ'`]*/g, (w) => {
    // So'z oxiridagi qo'shtirnoq/apostrof (masalan, ’) so'zga kirmaydi
    const tail = w.match(/[‘’ʻʼ'`]+$/)?.[0] ?? ""
    const core = tail ? w.slice(0, -tail.length) : w
    return wordToCyrillic(core) + tail
  })
}

/** Lotincha matnni kirillchaga o'giradi; havola, domen va qisqartmalar o'zgarmaydi */
export function toCyrillic(text: string): string {
  if (!/[A-Za-z]/.test(text)) return text
  let out = ""
  let last = 0
  for (const m of text.matchAll(KEEP)) {
    out += segmentToCyrillic(text.slice(last, m.index)) + m[0]
    last = m.index! + m[0].length
  }
  return out + segmentToCyrillic(text.slice(last))
}

const BACK: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", ғ: "g‘", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y", к: "k", қ: "q",
  л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ў: "o‘", ф: "f", х: "x", ҳ: "h", ц: "ts",
  ч: "ch", ш: "sh", ъ: "’", ь: "", э: "e", ю: "yu", я: "ya", щ: "sh", ы: "i",
}

/** Kirillcha matnni lotinchaga o'giradi (qidiruv uchun: «Лочин» → «Lochin») */
export function toLatin(text: string): string {
  return text.replace(/[Ѐ-ӿ]/g, (ch) => {
    const lc = ch.toLowerCase()
    const mapped = BACK[lc]
    if (mapped === undefined) return ch
    return ch !== lc && mapped ? mapped[0].toUpperCase() + mapped.slice(1) : mapped
  })
}

/** Qidiruv kaliti: ikkala yozuvda ham bir xil — kichik harf, lotincha, apostroflarsiz */
export function searchKey(text: string) {
  return toLatin(text).toLowerCase().replace(/[‘’ʻʼ'`]/g, "").trim()
}
