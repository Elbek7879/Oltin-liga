import { defineConfig, devices } from "@playwright/test"

/*
 * To'liq jarayon testi: BO'SH bazadan boshlanadi (namunaviy ma'lumotlarsiz) —
 * mavsum ochish, jamoalar, qur'a, taqvim, natijalar, pley-off, final va chempion.
 */
const BACKEND_PORT = 18082
const FRONTEND_PORT = 5175

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.flow.ts",
  timeout: 300_000,
  expect: { timeout: 10_000 },
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
      env: { E2E_PORT: String(BACKEND_PORT), E2E_DEMO_DATA: "false" },
    },
    {
      command: "npm run dev",
      url: `http://localhost:${FRONTEND_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { PORT: String(FRONTEND_PORT), API_TARGET: `http://localhost:${BACKEND_PORT}`, VITE_CACHE_DIR: "node_modules/.vite-flow" },
    },
  ],
})
