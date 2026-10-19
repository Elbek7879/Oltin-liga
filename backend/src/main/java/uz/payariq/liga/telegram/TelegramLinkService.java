package uz.payariq.liga.telegram;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.EnumSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.payariq.liga.common.ApiException;
import uz.payariq.liga.domain.Role;
import uz.payariq.liga.model.AppUser;
import uz.payariq.liga.model.TelegramLink;
import uz.payariq.liga.repo.AppUserRepository;
import uz.payariq.liga.repo.TelegramLinkRepository;
import uz.payariq.liga.service.AuditService;

/**
 * Admin akkauntini Telegram bilan bog'lash. Sayt bir martalik kod beradi (10 daqiqa amal qiladi),
 * admin uni bot havolasi orqali ochadi — shundan keyin bot faqat shu chatga xizmat qiladi.
 */
@Service
public class TelegramLinkService {

    /** Botdan foydalanishi mumkin bo'lgan rollar (natija kiritish huquqi borlar) */
    public static final Set<Role> BOT_ROLES = EnumSet.of(Role.SUPER_ADMIN, Role.ADMIN, Role.RESULT_ENTRY);
    private static final Duration CODE_TTL = Duration.ofMinutes(10);
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

    private final TelegramLinkRepository links;
    private final AppUserRepository users;
    private final TelegramSettings settings;
    private final AuditService audit;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();
    private final Map<String, Pending> codes = new ConcurrentHashMap<>();

    private record Pending(UUID userId, Instant expiresAt) {
    }

    public record Status(boolean botEnabled, String botUsername, boolean allowed, boolean linked, String telegramUsername) {
    }

    public record LinkCode(String url, Instant expiresAt) {
    }

    public TelegramLinkService(TelegramLinkRepository links, AppUserRepository users, TelegramSettings settings, AuditService audit, Clock clock) {
        this.links = links;
        this.users = users;
        this.settings = settings;
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Status status(AppUser u) {
        Optional<TelegramLink> link = links.findByUserId(u.getId());
        return new Status(settings.active() && !settings.username().isEmpty(), settings.username(), BOT_ROLES.contains(u.role),
                link.isPresent(), link.map(l -> l.telegramUsername).orElse(null));
    }

    public LinkCode createCode(AppUser u) {
        if (!settings.active() || settings.username().isEmpty()) {
            throw ApiException.conflict("Telegram bot hali sozlanmagan: backend/.env faylida TELEGRAM_BOT_TOKEN va TELEGRAM_BOT_USERNAME kiritilishi kerak.");
        }
        if (!BOT_ROLES.contains(u.role)) throw ApiException.badRequest("Bot natija kiritish huquqi bor adminlar uchun. Sizning rolingiz uchun kerak emas.");
        Instant now = clock.instant();
        codes.entrySet().removeIf(e -> e.getValue().expiresAt().isBefore(now) || e.getValue().userId().equals(u.getId()));
        StringBuilder code = new StringBuilder();
        for (int i = 0; i < 16; i++) code.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
        Instant expires = now.plus(CODE_TTL);
        codes.put(code.toString(), new Pending(u.getId(), expires));
        return new LinkCode("https://t.me/" + settings.username() + "?start=" + code, expires);
    }

    /** /start <kod> — kod to'g'ri va muddati o'tmagan bo'lsa, chat adminga bog'lanadi */
    @Transactional
    public Optional<AppUser> link(String code, long chatId, String telegramUsername) {
        Pending p = codes.remove(code);
        if (p == null || p.expiresAt().isBefore(clock.instant())) return Optional.empty();
        Optional<AppUser> user = users.findById(p.userId()).filter(u -> u.enabled && BOT_ROLES.contains(u.role));
        if (user.isEmpty()) return Optional.empty();
        // Bitta admin — bitta chat, bitta chat — bitta admin
        links.findByChatId(chatId).ifPresent(links::delete);
        links.findByUserId(p.userId()).ifPresent(links::delete);
        links.flush();
        TelegramLink l = new TelegramLink();
        l.userId = p.userId();
        l.chatId = chatId;
        l.telegramUsername = telegramUsername;
        links.save(l);
        audit.record("Telegram", user.get().displayName + " Telegram botga ulandi" + (telegramUsername == null ? "" : " (@" + telegramUsername + ")"), "USER", p.userId());
        return user;
    }

    @Transactional
    public void unlink(AppUser u) {
        links.findByUserId(u.getId()).ifPresent(l -> {
            links.delete(l);
            audit.record("Telegram", u.displayName + " Telegram botdan uzildi", "USER", u.getId());
        });
    }

    /** Chatga bog'langan faol admin (o'chirilgan yoki roli o'zgargan bo'lsa — yo'q) */
    @Transactional(readOnly = true)
    public Optional<AppUser> userForChat(long chatId) {
        return links.findByChatId(chatId)
                .flatMap(l -> users.findById(l.userId))
                .filter(u -> u.enabled && BOT_ROLES.contains(u.role));
    }
}
