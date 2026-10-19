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

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (settings.count() == 0) {
            LeagueSettings s = new LeagueSettings();
            s.name = "Payariq Oltin Ligasi";
            s.shortName = "Oltin Liga";
            s.region = "Payariq tumani, Samarqand viloyati";
            s.about = "Payariq Oltin Ligasi — tuman qishloqlari jamoalari ishtirokidagi havaskorlar futbol musobaqasi. "
                    + "Barcha o‘yinlar " + MAIN_VENUE + " stadionida o‘tadi.";
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
