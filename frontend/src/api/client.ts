import { httpApi } from "./http/httpApi"
import { mockApi } from "./mock/mockApi"
import type { LeagueApi } from "./types"

/**
 * Ilova ishlatadigan API. Odatda haqiqiy backend (HTTP). VITE_API_MODE=mock bilan
 * backendsiz, brauzer xotirasidagi namunaviy ma'lumotlar bilan ishlatish mumkin
 * (faqat dizayn ustida ishlash uchun).
 */
export const IS_DEMO_MODE = import.meta.env.VITE_API_MODE === "mock"

export const api: LeagueApi = IS_DEMO_MODE ? mockApi : httpApi
