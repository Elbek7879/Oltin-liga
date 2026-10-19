import { defineConfig, devices } from "@playwright/test"

/*
 * Brauzer testlari haqiqiy backend bilan ishlaydi. Backend "e2e" profilida alohida portda
 * va alohida test bazasida (payariq_test) ishga tushadi: har ishga tushishda baza tozalanadi
 * va namunaviy ma'lumotlar yuklanadi. Asosiy bazaga hech qanday ta'sir yo'q.
 */
const BACKEND_PORT = 18081
const FRONTEND_PORT = 5174

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    locale: "uz-UZ",
    timezoneId: "Asia/Tashkent",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "mvn -q -f ../backend/pom.xml spring-boot:run -Dspring-boot.run.profiles=e2e",
      url: `http://localhost:${BACKEND_PORT}/actuator/health`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: { E2E_PORT: String(BACKEND_PORT), E2E_DEMO_DATA: "true" },
    },
    {
      command: "npm run dev",
      url: `http://localhost:${FRONTEND_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
      // Alohida Vite keshi: ochiq dev server (5173) keshni qayta yozsa, test sahifasi qayta yuklanib ketmasin
      env: { PORT: String(FRONTEND_PORT), API_TARGET: `http://localhost:${BACKEND_PORT}`, VITE_CACHE_DIR: "node_modules/.vite-e2e" },
    },
  ],
})
