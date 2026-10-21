# Saytni internetga chiqarish, zaxira va yangilash

Bu hujjat saytni serverga o‘rnatish, kundalik zaxira nusxa olish, nusxadan tiklash va yangi versiyani o‘rnatish tartibini tushuntiradi. Buyruqlar Ubuntu 24.04 server uchun yozilgan.

## 1. Tuzilma

```
Internet ──HTTPS──> Caddy (80/443, sertifikat avtomatik) ──> Spring Boot jar (127.0.0.1:8080) ──> PostgreSQL
                                                              └─ sayt (React) ham shu jar ichida
```

Bitta server yetadi: sayt, API va baza bitta mashinada. Ilova tashqariga to‘g‘ridan-to‘g‘ri ochilmaydi, faqat Caddy orqali.

## 2. Hosting va domen bo‘yicha tavsiyalar

**Server:** 1–2 vCPU, 2 GB RAM, 20 GB SSD, Ubuntu 24.04 LTS. Liga hajmi uchun bu yetarli; o‘yin kunlari ham zaxira bilan ishlaydi.

**Joylashuv: O‘zbekistondagi data-markazni tavsiya qilaman.** Ikki sabab:

1. Muxlislar telefondan kiradi: mahalliy serverda kechikish kam, sahifalar tezroq ochiladi.
2. Saytda futbolchilarning shaxsga doir ma’lumotlari bor (ism-familiya, tug‘ilgan yil, telefon raqami admin uchun). O‘zbekiston qonunchiligi fuqarolarning shaxsga doir ma’lumotlarini mamlakat hududidagi serverlarda saqlashni talab qiladi. Xorijiy hosting arzonroq bo‘lishi mumkin, lekin yakuniy tanlovdan oldin bu talabni huquqshunos bilan aniqlashtiring.

Tanlashda tekshiring: Ubuntu VPS berilishi, root/SSH kirish, kunlik snapshot imkoniyati, texnik yordam o‘zbek yoki rus tilida.

**Domen:** `.uz` domenlari cctld.uz saytida ro‘yxatdan o‘tgan akkreditatsiyalangan registratorlar orqali olinadi. Qisqa va eslab qolinadigan nom tanlang, avval bo‘shligini tekshiring. Domen olingach, DNS’da ikkita `A` yozuv qo‘shing: `sizning-domen.uz` va `www.sizning-domen.uz` → server IP manzili.

Hosting va domen pullik xizmatlar: xaridni o‘zingiz qilasiz, tanlashda yordam beraman.

## 3. Production versiyasini yig‘ish (o‘z kompyuteringizda)

PowerShell’da, loyiha papkasida:

```powershell
cd frontend
npm ci
$env:SITE_URL = "https://sizning-domen.uz"; npm run build
cd ..\backend
mvn -Pwith-frontend package
```

Natija: `backend\target\oltin-liga.jar` — sayt va server bitta faylda. `SITE_URL` havola Telegram’da ulashilganda rasm chiqishi uchun kerak.

## 4. Serverga o‘rnatish

```bash
# 1) Kerakli dasturlar (Caddy: https://caddyserver.com/docs/install bo'yicha o'rnating)
sudo apt update && sudo apt install -y openjdk-21-jre-headless postgresql

# 2) Baza: parolni dastur o'zi so'raydi, uni hech qayerga yozmang
sudo -u postgres createuser --pwprompt payariq
sudo -u postgres createdb --owner payariq payariq

# 3) Ilova uchun alohida tizim foydalanuvchisi va papkalar
sudo useradd --system --home /opt/oltin-liga --shell /usr/sbin/nologin liga
sudo mkdir -p /opt/oltin-liga/{media,logs,backups}
```

Kompyuterdan serverga fayllarni ko‘chiring (`scp` yoki WinSCP orqali): `oltin-liga.jar`, `scripts/backup.sh`, `deploy/oltin-liga.service`, `deploy/Caddyfile`, `deploy/env.production.example`.

```bash
cd /opt/oltin-liga
sudo mv ~/oltin-liga.jar ~/backup.sh .
sudo cp ~/env.production.example .env
sudo nano .env              # DB_PASSWORD, ADMIN_PASSWORD, TELEGRAM_BOT_TOKEN va TELEGRAM_BOT_USERNAME ni yozing
sudo chmod 600 .env && sudo chmod 750 backup.sh
sudo chown -R liga:liga /opt/oltin-liga

sudo cp ~/oltin-liga.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now oltin-liga
curl -s http://127.0.0.1:8080/actuator/health   # {"status":"UP"} chiqishi kerak

sudo nano ~/Caddyfile       # sizning-domen.uz o'rniga haqiqiy domen
sudo cp ~/Caddyfile /etc/caddy/Caddyfile && sudo systemctl reload caddy

sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw enable
```

Birinchi ishga tushishda baza jadvallari avtomatik yaratiladi. Production rejimida namunaviy ma’lumotlar yuklanmaydi.

**Telegram bot.** Bot server ichida ishlaydi va Telegram'ga o‘zi ulanadi — alohida server, domen yoki ochiq port kerak emas. `.env` da `TELEGRAM_BOT_TOKEN` bo‘lsa, ilova ishga tushishi bilan bot ham ishlaydi (jurnalda «Telegram bot ishga tushdi»). Bitta token bilan bir vaqtda faqat bitta server ishlashi kerak: serverga ko‘chirgach, kompyuterdagi nusxani o‘chiring yoki undagi tokenni olib tashlang.

**Jonli yangilanishlar.** Gollar saytda darhol ko‘rinishi uchun `/api/public/live` oqimi ishlatiladi; `deploy/Caddyfile` da u siqishsiz uzatiladigan qilib sozlangan — shu faylni o‘zgartirmasdan ishlating.

## 5. Birinchi kirish

1. `https://sizning-domen.uz/admin` ni oching va `.env` dagi login bilan kiring.
2. **Hisobim** sahifasida parolni almashtiring.
3. Serverda `.env` faylidan `ADMIN_PASSWORD` qatorini o‘chiring: akkaunt allaqachon bazada, bu qator endi kerak emas.
4. **Sozlamalar → Liga ma’lumotlari** va **Foydalanuvchilar** bo‘limlarini to‘ldiring.

## 6. Zaxira nusxa

**Serverda, har kuni avtomatik:**

```bash
sudo -u liga crontab -e
# quyidagi qatorni qo'shing: har kuni soat 03:00 da
0 3 * * * ENV_FILE=/opt/oltin-liga/.env TARGET=/opt/oltin-liga/backups /opt/oltin-liga/backup.sh >> /opt/oltin-liga/logs/backup.log 2>&1
```

Skript bazani (`payariq-YYYY-MM-DD_HHMM.dump`) va logotiplarni (`payariq-media-….tar.gz`) saqlaydi, oxirgi 30 kunlikni qoldiradi.

**Muhim:** haftada bir marta eng oxirgi nusxani serverdan tashqariga ham ko‘chiring (kompyuteringizga yoki bulutli diskka). Server butunlay ishdan chiqsa, faqat tashqaridagi nusxa yordam beradi.

**Windows kompyuterda** (sayt lokal ishlayotgan bo‘lsa):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\backup.ps1
```

Har kuni avtomatik bo‘lishi uchun «Vazifalar rejalashtiruvchisi»ga qo‘shing (yo‘lni o‘zingiznikiga moslang):

```powershell
schtasks /Create /SC DAILY /ST 21:00 /TN "Oltin Liga zaxira" /TR "powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\ATB\Desktop\Payariq-Oltin-Ligasi\scripts\backup.ps1"
```

## 7. Nusxadan tiklash

Tiklash bazadagi joriy ma’lumotlarni nusxadagisi bilan **almashtiradi**. Avval hozirgi holatdan ham nusxa oling.

```bash
sudo systemctl stop oltin-liga
/opt/oltin-liga/backup.sh                      # hozirgi holat ham saqlanib qolsin
pg_restore --host localhost --username payariq --dbname payariq --clean --if-exists --no-owner \
  /opt/oltin-liga/backups/payariq-2026-10-15_0300.dump    # parolni so'raydi
sudo tar -xzf /opt/oltin-liga/backups/payariq-media-2026-10-15_0300.tar.gz -C /opt/oltin-liga/media
sudo chown -R liga:liga /opt/oltin-liga/media
sudo systemctl start oltin-liga
```

Windows’da xuddi shu buyruq PostgreSQL papkasidagi `pg_restore.exe` bilan ishlaydi. Bu tartib sinovdan o‘tgan: nusxa sinov bazasiga tiklanganda barcha jamoalar, futbolchilar va o‘yinlar to‘liq qaytdi.

## 8. Yangi versiyani o‘rnatish

1. Serverda zaxira oling: `/opt/oltin-liga/backup.sh`.
2. Kompyuterda yangi `oltin-liga.jar` yig‘ing (3-bo‘lim).
3. Serverga ko‘chiring va almashtiring:

```bash
sudo systemctl stop oltin-liga
sudo mv ~/oltin-liga.jar /opt/oltin-liga/oltin-liga.jar && sudo chown liga:liga /opt/oltin-liga/oltin-liga.jar
sudo systemctl start oltin-liga
```

Baza tuzilmasi o‘zgargan bo‘lsa, ilova uni ishga tushishda o‘zi yangilaydi (Flyway). Muammo chiqsa: eski jar va 7-bo‘limdagi nusxa bilan qaytish mumkin.

## 9. Kuzatish

| Nima | Buyruq |
|---|---|
| Ilova ishlayaptimi | `systemctl status oltin-liga` |
| Holat tekshiruvi | `curl http://127.0.0.1:8080/actuator/health` |
| Jurnal (xatolar) | `tail -f /opt/oltin-liga/logs/oltin-liga.log` |
| Zaxira jurnali | `tail /opt/oltin-liga/logs/backup.log` |

## 10. Xavfsizlik ro‘yxati

- [ ] Sayt faqat HTTPS orqali ochiladi (Caddy). Ilova o‘zi HSTS, CSP va xavfsiz cookie’larni qo‘yadi.
- [ ] Serverga SSH faqat kalit bilan, parol bilan kirish o‘chirilgan.
- [ ] Tizim yangilanishlari avtomatik: `sudo apt install unattended-upgrades`.
- [ ] `.env` fayli faqat `liga` foydalanuvchisiga ochiq (`chmod 600`).
- [ ] Bosh tashkilotchi paroli almashtirilgan, `ADMIN_PASSWORD` `.env` dan olib tashlangan.
- [ ] PostgreSQL superuser (`postgres`) paroli kuchli va hech kimga aytilmagan. Agar u biror joyda (masalan, chatda) yozilgan bo‘lsa, almashtiring.
- [ ] Zaxira har kuni olinmoqda va haftada bir server tashqarisiga ko‘chirilmoqda.
- [ ] Saytdagi **Maxfiylik siyosati** (`/maxfiylik`) matnini yurist ko‘rib chiqqan; unda yozilganidek server O‘zbekiston hududida va zaxira har kuni olinadi.

## 11. Google va Yandex’da chiqish

Sayt qidiruv tizimlari uchun tayyor — buni alohida sozlash shart emas:

- Har bir sahifaning o‘z nomi va qisqa tavsifi bor (masalan, «Turnir jadvali — Payariq Oltin Ligasi», jamoa sahifasida jamoa nomi, o‘yin sahifasida «Lochin 2:1 Chinor»). Server sahifani shu nom bilan beradi, shuning uchun Google ham, Telegram’dagi havola kartochkasi ham to‘g‘ri nomni ko‘rsatadi. Liga nomi **Sozlamalar → Liga ma’lumotlari** dan olinadi.
- `https://sizning-domen.uz/sitemap.xml` — barcha sahifalar ro‘yxati (bo‘limlar, jamoalar, futbolchilar, o‘yinlar, e’lon qilingan yangiliklar). Yangi jamoa yoki yangilik qo‘shilsa, ro‘yxatga o‘zi kiradi.
- `https://sizning-domen.uz/robots.txt` — admin panel va API qidiruvga yopiq. Admin panel, kirish sahifasi va mavjud bo‘lmagan sahifalar Google’da ko‘rsatilmaydi; mavjud bo‘lmagan manzil 404 qaytaradi.
- Sinov mavsumi, qoralama yangiliklar va bekor qilingan o‘yinlar ro‘yxatga kirmaydi.
- `www.sizning-domen.uz` asosiy manzilga yo‘naltiriladi (`deploy/Caddyfile`), Google saytni bitta manzilda ko‘radi.

**Saytni Google’ga tanitish** (sayt HTTPS bilan ochilgandan keyin, bir marta):

1. [Google Search Console](https://search.google.com/search-console) ga Google akkaunti bilan kiring → **Mulk qo‘shish** → **Domen** → `sizning-domen.uz`.
2. Google bergan `google-site-verification=…` yozuvini nusxalang.
3. Domen sotib olingan saytda (masalan, sayt.uz) domen boshqaruvi → **DNS** → yangi **TXT** yozuv: nomi `@`, qiymati — nusxalangan matn. Saqlang.
4. Search Console’da **Tasdiqlash** ni bosing (DNS yangilanishi bir necha daqiqadan bir necha soatgacha olishi mumkin).
5. **Sitemaps** bo‘limida `sitemap.xml` ni yozib, **Yuborish** ni bosing.

**Yandex** uchun ham xuddi shunday: [Yandex Webmaster](https://webmaster.yandex.ru) → sayt qo‘shish → DNS orqali tasdiqlash → **Indekslash → Sitemap fayllari** ga `https://sizning-domen.uz/sitemap.xml`.

Yangi sayt qidiruvda odatda bir necha kundan 2–3 haftagacha paydo bo‘ladi. Avval liga nomi bo‘yicha qidirganda chiqadi; Search Console’dagi **Sahifalar** hisobotida qaysi sahifalar qo‘shilganini ko‘rish mumkin. Tezlashtirish uchun sayt havolasini Telegram kanali va Instagram profiliga qo‘ying.
