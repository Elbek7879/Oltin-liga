# Payariq Oltin Ligasi

Payariq Oltin Ligasi — qishloq va mahallalar o‘rtasidagi havaskor futbol musobaqasi uchun veb-platforma:
- **ommaviy sayt** — muxlislar uchun, loginsiz;
- **admin paneli** — tashkilotchilar uchun.

## Hozirgi holat

| Bosqich | Holat |
|---|---|
| 1. Tahlil va dizayn | Tasdiqlangan — «Oltin Maydon» konsepsiyasi |
| 2. Frontend | Tasdiqlangan ([hisobot](docs/02-bosqich-hisobot.md)) |
| 3. Backend (Spring Boot + PostgreSQL) | Tasdiqlangan ([hisobot](docs/03-bosqich-hisobot.md)) |
| 4. Integratsiya | Tasdiqlangan ([hisobot](docs/04-bosqich-hisobot.md)) |
| 5. Yakuniy tekshiruv va production | Tayyor, tasdiq kutilmoqda ([hisobot](docs/05-bosqich-hisobot.md)) |

## Qo‘llanmalar

- [Administrator qo‘llanmasi](docs/qollanma-administrator.md) — mavsum, natija kiritish, yordamchilar, parol.
- [Internetga chiqarish, zaxira va yangilash](docs/ishga-tushirish.md) — server, domen, HTTPS, backup va tiklash.

## Lokal ishga tushirish

Talab: Node.js 20+, Java 17+, Maven, PostgreSQL.

1. **Baza va backend.** Batafsil: [backend/README.md](backend/README.md).

   ```bash
   cd backend
   mvn spring-boot:run
   ```

2. **Frontend** (yangi terminalda):

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Ochish:**
   - sayt: http://localhost:5173;
   - admin paneli: http://localhost:5173/admin. Login va parol `backend/.env` faylida.

   Frontend `/api` so'rovlarini backendga (8080-port) yo'naltiradi.

**Backendsiz ishlash.** Faqat dizayn ustida ishlash uchun `npm run dev:mock`. Bu rejimda ma'lumotlar brauzer xotirasida saqlanadi.

## Testlar

| Buyruq | Nima tekshiriladi |
|---|---|
| `cd backend && mvn test` | Liga qoidalari, API, xavfsizlik (`payariq_test` bazasida) |
| `cd frontend && npm test` | Frontenddagi liga qoidalari |
| `cd frontend && npm run e2e` | Brauzer testlari va skrinshotlar — haqiqiy backend bilan |
| `cd frontend && npm run e2e:flow` | Bo'sh bazadan chempiongacha bo'lgan to'liq jarayon |
| `cd frontend && npx playwright test e2e/a11y.spec.ts` | Accessibility (WCAG 2.2 AA, axe-core) va klaviatura bilan boshqarish |
| `node frontend/scripts/web-vitals.mjs <manzil> [slow4g\|4g]` | Core Web Vitals (LCP, CLS, INP) telefon sharoitida |

Brauzer testlari backendni alohida portda (18081/18082) va alohida test bazasida ishga tushiradi. Asosiy baza ularga tegmaydi.

Birinchi marta: `npx playwright install chromium`.

## Production

```powershell
cd frontend; npm run build
cd ..\backend; mvn -Pwith-frontend package
java -jar target\oltin-liga.jar --spring.profiles.active=prod
```

Sayt va API bitta jar’da. Batafsil: [docs/ishga-tushirish.md](docs/ishga-tushirish.md). Zaxira: `scripts/backup.ps1` (Windows), `scripts/backup.sh` (Linux).

## Tuzilma

```
backend/            Spring Boot 4.1: REST API, PostgreSQL (Flyway), Spring Security
frontend/
  src/domain/       Liga qoidalari (backenddagi bilan bir xil)
  src/api/          API interfeysi: http/ (haqiqiy) va mock/ (namunaviy)
  src/components/   UI komponentlari
  src/pages/        Ommaviy sayt va admin sahifalari
  e2e/              Playwright testlari
docs/               Tahlil, bosqich hisobotlari, qo‘llanmalar, skrinshotlar
deploy/             Server namunalari: systemd, Caddy (HTTPS), .env
scripts/            Zaxira nusxa skriptlari
```
