import { useEffect, useRef, useState } from "react"

/** Qiymat o'zgarganda (masalan, gol urilib hisob o'zgarsa) qisqa vaqt true qaytaradi — birinchi ochilishda emas */
export function useFlash(value: string, ms = 4000) {
  const [flash, setFlash] = useState(false)
  const prev = useRef(value)
  useEffect(() => {
    if (prev.current === value) return
    prev.current = value
    setFlash(true)
    const id = window.setTimeout(() => setFlash(false), ms)
    return () => window.clearTimeout(id)
  }, [value, ms])
  return flash
}
