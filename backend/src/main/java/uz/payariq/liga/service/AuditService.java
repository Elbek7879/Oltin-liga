package uz.payariq.liga.service;

import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import uz.payariq.liga.model.AppUser;
import uz.payariq.liga.model.AuditLog;
import uz.payariq.liga.repo.AuditLogRepository;
import uz.payariq.liga.security.CurrentUser;
import uz.payariq.liga.telegram.BotContext;

/** Muhim o'zgarishlar tarixi: kim, qachon, nima qildi */
@Service
public class AuditService {

    private final AuditLogRepository repo;
    private final CurrentUser currentUser;
    private final BundleCache bundles;

    public AuditService(AuditLogRepository repo, CurrentUser currentUser, BundleCache bundles) {
        this.repo = repo;
        this.currentUser = currentUser;
        this.bundles = bundles;
    }

    public void record(String action, String summary, String entityType, UUID entityId) {
        AuditLog log = new AuditLog();
        AppUser user = currentUser.get().orElse(null);
        log.username = user == null ? null : user.username;
        log.displayName = user == null ? "Tizim" : user.displayName;
        log.action = action;
        // Telegram bot orqali bajarilgan amal tarixda alohida belgilanadi
        String text = BotContext.active() ? summary + " (Telegram)" : summary;
        log.summary = text.length() > 500 ? text.substring(0, 497) + "..." : text;
        log.entityType = entityType;
        log.entityId = entityId;
        log.ipAddress = clientIp();
        repo.save(log);
        // Har bir saqlangan o'zgarishdan keyin muxlislar keshi tozalanadi — saytda eskirgan ma'lumot qolmaydi
        bundles.evictAllAfterCommit();
    }

    private static String clientIp() {
        if (!(RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs)) return null;
        HttpServletRequest req = attrs.getRequest();
        return req.getRemoteAddr();
    }
}
