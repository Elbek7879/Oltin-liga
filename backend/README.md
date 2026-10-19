# Payariq Oltin Ligasi — backend

Spring Boot 4.1 (Java 17), PostgreSQL, Flyway, Spring Security 7.

## Ishga tushirish

1. PostgreSQL ishlab turgan bo'lishi kerak. Loyiha foydalanuvchisi va bazalar `.local/create-database.sql` skripti bilan yaratiladi (postgres paroli so'raladi):

   ```powershell
   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -d postgres -f .local\create-database.sql
   ```

2. `.env` faylida baza va birinchi admin ma'lumotlari bo'lishi kerak (namuna: `.env.example`). Bu fayl git'ga tushmaydi.
3. Serverni ishga tushiring:

   ```bash
   mvn spring-boot:run
   ```

   API: http://localhost:8080. Birinchi ishga tushirishda Flyway jadvallarni yaratadi, `.env` dagi `ADMIN_USERNAME` / `ADMIN_PASSWORD` bilan bosh tashkilotchi akkaunti ochiladi. `DEMO_DATA=true` bo'lsa, bo'sh bazaga namunaviy ma'lumotlar yuklanadi.

## Testlar

```bash
mvn test
```

Unit testlar bazasiz ishlaydi. Integratsion testlar alohida `payariq_test` bazasidan foydalanadi va har bir testdan oldin uni tozalaydi.

## Tuzilma

```
src/main/java/uz/payariq/liga/
  domain/     Liga qoidalari (sof funksiyalar): jadval, validatsiya, taqvim, qur'a, pley-off, statistika
  model/      JPA entity'lar
  repo/       Spring Data repository'lar
  service/    Biznes jarayonlari (tranzaksiyalar, audit, outbox)
  web/        REST controller'lar, DTO va so'rov modellari
  security/   Spring Security: sessiya, CSRF, rollar, login urinishlarini cheklash
  config/     Birinchi ishga tushirish (admin, sozlamalar)
  demo/       Namunaviy ma'lumotlar generatori
src/main/resources/db/migration/   Flyway migratsiyalari
```

## Asosiy qoidalar

- **Yagona ishonchli manba:** `matches` (holat va hisob) va `match_events` (gollar, kartochkalar). Turnir jadvali, ochkolar va statistika saqlanmaydi — har so'rovda shulardan hisoblanadi. Natija tahrirlansa, hodisalar to'liq almashtiriladi, shuning uchun o'yin ikki marta hisobga olinmaydi.
- **Yakunlangan mavsum** arxivga qulflanadi: unga tegishli har qanday o'zgartirish `409` qaytaradi.
- **Maxfiy ma'lumot:** futbolchi telefoni faqat admin API'da qaytariladi.
- **Rollar:** `SUPER_ADMIN` (hammasi), `ADMIN` (musobaqa va kontent), `RESULT_ENTRY` (faqat natija), `EDITOR` (yangilik va homiylar).

## API

| Yo'l | Tavsif |
|---|---|
| `GET /api/public/seasons` | Mavsumlar |
| `GET /api/public/seasons/{id}/bundle` | Mavsumning barcha ommaviy ma'lumotlari (jadval va statistika bilan) |
| `GET /api/public/archive` | Mavsumlar arxivi va chempionlar |
| `GET /api/public/teams/{teamId}/profile` | Jamoa tarixi |
| `GET /api/public/players/{playerId}/profile` | Futbolchi statistikasi (barcha mavsumlar) |
| `GET /api/public/head-to-head?teamA=&teamB=` | O'zaro o'yinlar |
| `GET /api/public/news`, `/news/{slug}`, `/sponsors`, `/settings` | Kontent |
| `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` | Kirish/chiqish |
| `PUT /api/auth/password` | O'z parolini almashtirish (joriy parol bilan) |
| `GET/POST /api/admin/users`, `PUT /api/admin/users/{id}`, `PUT /api/admin/users/{id}/password` | Yordamchilar: qo'shish, rol, o'chirish, yangi parol (faqat bosh tashkilotchi) |
| `/api/admin/seasons/**` | Mavsum yaratish, nizom, boshlash, yakunlash, hisobot, boshqaruv paneli |
| `/api/admin/teams/**`, `/api/admin/seasons/{id}/teams/**` | Jamoalar va mavsumga qo'shish |
| `/api/admin/seasons/{id}/players`, `/api/admin/players/{id}` | Futbolchilar |
| `PUT /api/admin/seasons/{id}/groups` | Qur'ani tasdiqlash |
| `/api/admin/seasons/{id}/matches`, `/api/admin/matches/{id}` | O'yinlar |
| `POST /api/admin/seasons/{id}/schedule` | Taqvimni avtomatik tuzish |
| `PUT /api/admin/matches/{id}/result` | Natija kiritish |
| `POST/DELETE /api/admin/seasons/{id}/playoff` | Pley-off sxemasi |
| `/api/admin/news`, `/sponsors`, `/venues`, `/adjustments`, `/settings`, `/audit`, `/media` | Kontent va tizim |

O'zgartiruvchi so'rovlar `XSRF-TOKEN` cookie qiymatini `X-XSRF-TOKEN` sarlavhasida yuborishi kerak.
