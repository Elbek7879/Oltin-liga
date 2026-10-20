import { useSyncExternalStore } from "react"
import { disableCyrillic, enableCyrillic } from "@/lib/translit-dom"

/**
 * Sayt yozuvi: lotin (standart) yoki kirill. Tanlov shu brauzerda saqlanadi.
 * Kirill rejimida butun sahifa ekranda o'giriladi — ma'lumotlar bazada lotinchada qoladi.
 */
export type Script = "latn" | "cyrl"
const KEY = "pol-script"
const listeners = new Set<() => void>()

function read(): Script {
  try {
    return localStorage.getItem(KEY) === "cyrl" ? "cyrl" : "latn"
  } catch {
    return "latn"
  }
}

let current: Script = typeof window === "undefined" ? "latn" : read()

function apply(script: Script) {
  if (script === "cyrl") enableCyrillic()
  else disableCyrillic()
}

/** Ilova ishga tushishida: kirill tanlangan bo'lsa, birinchi chizishdan oldin yoqiladi */
export function initScript() {
  apply(current)
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return
    current = read()
    apply(current)
    listeners.forEach((l) => l())
  })
}

export function setScript(script: Script) {
  current = script
  try {
    if (script === "cyrl") localStorage.setItem(KEY, script)
    else localStorage.removeItem(KEY)
  } catch {
    // Brauzer xotirasi yopiq — tanlov faqat shu sahifada amal qiladi
  }
  apply(script)
  listeners.forEach((l) => l())
}

/** Hozirgi yozuv (komponentlar uchun) */
export function getScript() {
  return current
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useScript() {
  const script = useSyncExternalStore(subscribe, getScript, () => "latn" as Script)
  return { script, toggle: () => setScript(script === "cyrl" ? "latn" : "cyrl") }
}
