import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

export type ThemeChoice = "light" | "dark" | "system"

interface ThemeState {
  theme: ThemeChoice
  resolved: "light" | "dark"
  setTheme: (t: ThemeChoice) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeState | null>(null)
const KEY = "pol-theme"

function systemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>(() => {
    try {
      const saved = localStorage.getItem(KEY)
      return saved === "light" || saved === "dark" ? saved : "system"
    } catch {
      return "system"
    }
  })
  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => setSystemDark(mq.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  const resolved = theme === "system" ? (systemDark ? "dark" : "light") : theme

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark")
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolved === "dark" ? "#0b2e22" : "#0f3d2e")
  }, [resolved])

  const setTheme = useCallback((t: ThemeChoice) => {
    setThemeState(t)
    try {
      if (t === "system") localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, t)
    } catch {
      // Brauzer xotirasi yopiq bo'lsa, tanlov faqat shu sahifada saqlanadi
    }
  }, [])

  const value = useMemo<ThemeState>(
    () => ({ theme, resolved, setTheme, toggle: () => setTheme(resolved === "dark" ? "light" : "dark") }),
    [theme, resolved, setTheme],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme ThemeProvider ichida ishlatilishi kerak")
  return ctx
}
