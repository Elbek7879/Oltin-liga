package uz.payariq.liga.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import uz.payariq.liga.domain.Role;
import uz.payariq.liga.model.AppUser;
import uz.payariq.liga.model.LeagueSettings;
import uz.payariq.liga.model.Venue;
import uz.payariq.liga.repo.AppUserRepository;
import uz.payariq.liga.repo.LeagueSettingsRepository;
import uz.payariq.liga.repo.VenueRepository;

/**
 * Birinchi ishga tushirishda liga sozlamalarini, asosiy stadionni va bosh tashkilotchi akkauntini yaratadi.
 * Login va parol kod ichida emas — muhit o'zgaruvchilaridan (ADMIN_USERNAME, ADMIN_PASSWORD) olinadi.
 */
@Component
@Order(1)
public class BootstrapRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(BootstrapRunner.class);

    /** Liga o'yinlari o'tadigan stadion. Nomini keyin Sozlamalar → Maydonlar bo'limida o'zgartirish mumkin. */
    public static final String MAIN_VENUE = "Mirzacho‘l Birlik Arena";

    private final AppUserRepository users;
    private final LeagueSettingsRepository settings;
    private final VenueRepository venues;
    private final PasswordEncoder encoder;
    private final String adminUsername;
    private final String adminPassword;
    private final String adminDisplayName;

    public BootstrapRunner(
            AppUserRepository users,
            LeagueSettingsRepository settings,
            VenueRepository venues,
            PasswordEncoder encoder,
            @Value("${liga.admin.username:}") String adminUsername,
            @Value("${liga.admin.password:}") String adminPassword,
            @Value("${liga.admin.display-name:Tashkilotchi}") String adminDisplayName) {
        this.users = users;
        this.settings = settings;
        this.venues = venues;
        this.encoder = encoder;
        this.adminUsername = adminUsername;
        this.adminPassword = adminPassword;
        this.adminDisplayName = adminDisplayName;
    }

    /** «Liga haqida» matni: ## — sarlavha, - — ro'yxat, **...** — qalin (saytda bo'limlar bilan ko'rsatiladi) */
    static final String DEFAULT_ABOUT = """
**Oltin Liga** — Samarqand viloyati Payariq tumanida tashkil topgan, qishloq va mahallalar o‘rtasidagi havaskorlar mini-futbol chempionati. Unda Payariq va boshqa tumanlardan kelgan qishloq va mahalla terma jamoalari ishtirok etadi. Maqsadimiz — yoshlarni sportga jalb qilish, qishloq va mahallalar o‘rtasida do‘stona raqobat va futbol bayramini yaratish.

## Qayerda va qachon o‘tadi?
- Barcha o‘yinlar **Mirzacho‘l Birlik Arena** stadionida o‘tadi.
- O‘yin kunlari odatda 4–5 ta o‘yin bo‘ladi, har bir o‘yin 2 × 20 daqiqa.
- O‘yinlarning kuni va vaqti saytdagi «O‘yinlar» bo‘limida e’lon qilinadi.

## Kimlar qatnashadi?
- Payariq va boshqa tumanlarning qishloq va mahalla terma jamoalari.
- Futbolchilar **16 yoshdan katta** bo‘lishi kerak.

## Qanday qatnashiladi?
1. Jamoa sardori tashkilotchilarga murojaat qilib, jamoa ro‘yxatini topshiradi: telefon +998 95 441 92 92 yoki Telegram @Sanjar12ab.
2. Mavsum boshida **qur’a** tashlanadi: jamoalar guruhlarga bo‘linadi. Har jamoa guruhdagi raqiblarining har biri bilan bir martadan o‘ynaydi.
3. G‘alaba uchun **3 ochko**, durang uchun **1 ochko** beriladi.
4. Har guruhdan eng yaxshi ikki jamoa (5–6 jamoali guruhlardan uchta) **pley-off**ga chiqadi.
5. Pley-offda yutqazgan jamoa musobaqadan chiqadi. **Final** g‘olibi — mavsum chempioni.

## Adolatli va shaffof: hammasini sayt o‘zi hisoblaydi
- **Qur’ani sayt tashlaydi** — jamoalar guruhlarga kompyuter tomonidan tasodifiy taqsimlanadi.
- **Juftliklar** — kim kim bilan o‘ynashi — qur’adan keyin avtomatik tuziladi.
- **Turnir jadvali, ochkolar, o‘rinlar va to‘purarlar ro‘yxati** har bir natijadan keyin avtomatik hisoblanadi.
- **Ochko teng bo‘lsa**, o‘rinlar nizomdagi mezonlar bo‘yicha avtomatik aniqlanadi: avval o‘zaro o‘yin, keyin to‘plar farqi va gollar. Hammasi teng bo‘lsa, qur’ani ham sayt tashlaydi.
- **Pley-off setkasi** guruh bosqichi tugashi bilan o‘zi tuziladi — kim kim bilan o‘ynashini jadval hal qiladi.
- **Tashkilotchilar faqat** o‘yin sanasi va vaqtini hamda natijani (hisob va gol mualliflari) kiritadi. Saytdagi har bir o‘zgarish tizimda qayd etib boriladi.

## Muxlislar uchun
- Natijalar, jadval, to‘purarlar va pley-off setkasi saytda darhol yangilanadi. O‘yin paytida gollar jonli ko‘rinadi.
- **«Mening jamoam»** orqali o‘z jamoangizni tanlab, uning o‘yinlarini kuzatib borasiz.
- Sayt kirill yozuvida ham ishlaydi — tepadagi «Кирилл» tugmasini bosing.
""".strip();

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (settings.count() == 0) {
            LeagueSettings s = new LeagueSettings();
            s.name = "Payariq Oltin Ligasi";
            s.shortName = "Oltin Liga";
            s.region = "Payariq tumani, Samarqand viloyati";
            // Tashkilotchilar tasdiqlagan matn va aloqa (keyin «Sozlamalar → Liga ma'lumotlari»da o'zgartiriladi)
            s.about = DEFAULT_ABOUT;
            s.contactPhone = "+998 95 441 92 92";
            s.telegram = "@Sanjar12ab";
            s.telegramChannel = "https://t.me/Oltinliga12";
            s.instagram = "https://www.instagram.com/oltin.liga12/";
            s.youtube = "https://www.youtube.com/@Sanjar192";
            settings.save(s);
            // Faqat birinchi o'rnatishda: keyin tashkilotchi maydonni o'chirsa, qayta yaratilmaydi
            if (venues.count() == 0) {
                Venue v = new Venue();
                v.name = MAIN_VENUE;
                venues.save(v);
            }
        }
        if (users.count() > 0) return;
        if (adminUsername.isBlank() || adminPassword.length() < 10) {
            log.warn("Admin foydalanuvchi yo'q. ADMIN_USERNAME va kamida 10 belgili ADMIN_PASSWORD ni sozlang.");
            return;
        }
        AppUser admin = new AppUser();
        admin.username = adminUsername.trim();
        admin.passwordHash = encoder.encode(adminPassword);
        admin.displayName = adminDisplayName;
        admin.role = Role.SUPER_ADMIN;
        users.save(admin);
        log.info("Bosh tashkilotchi akkaunti yaratildi: {}", admin.username);
    }
}
