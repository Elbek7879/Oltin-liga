import { useSyncExternalStore } from "react"

/**
 * Admin ishlayotgan paytda sessiya tugadi (vaqt o'tdi, server yangilandi yoki roli o'zgardi).
 * Sahifa yopilmaydi — ustida qayta kirish oynasi ochiladi, kiritilgan ma'lumot yo'qolmaydi.
 */
let expired = false
const listeners = new Set<() => void>()

export function setSessionExpired(value: boolean) {
  if (expired === value) return
  expired = value
  listeners.forEach((l) => l())
}

/** Qayta kirish oynasi ochiqmi (xato xabarini takrorlamaslik uchun) */
export function isSessionExpired() {
  return expired
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useSessionExpired() {
  return useSyncExternalStore(
    subscribe,
    () => expired,
    () => false,
  )
}
