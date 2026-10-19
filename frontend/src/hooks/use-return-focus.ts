import { useRef } from "react"

type FocusHandlers = {
  onOpenAutoFocus?: (event: Event) => void
  onCloseAutoFocus?: (event: Event) => void
}

/**
 * Dialog holat (state) orqali ochilganda Radix fokusni qaytaradigan trigger'ni bilmaydi.
 * Ochilish paytidagi fokusli elementni eslab qoladi va yopilganda fokusni unga qaytaradi —
 * klaviatura foydalanuvchisi sahifa boshiga «tushib qolmaydi».
 */
export function useReturnFocus({ onOpenAutoFocus, onCloseAutoFocus }: FocusHandlers) {
  const origin = useRef<HTMLElement | null>(null)
  return {
    onOpenAutoFocus: (event: Event) => {
      origin.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null
      onOpenAutoFocus?.(event)
    },
    onCloseAutoFocus: (event: Event) => {
      onCloseAutoFocus?.(event)
      const target = origin.current
      origin.current = null
      if (!event.defaultPrevented && target?.isConnected) {
        event.preventDefault()
        target.focus()
      }
    },
  }
}
