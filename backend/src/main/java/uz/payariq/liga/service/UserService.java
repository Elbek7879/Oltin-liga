package uz.payariq.liga.service;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.payariq.liga.common.ApiException;
import uz.payariq.liga.domain.Role;
import uz.payariq.liga.model.AppUser;
import uz.payariq.liga.repo.AppUserRepository;
import uz.payariq.liga.security.CurrentUser;
import uz.payariq.liga.web.Dto.UserDto;
import uz.payariq.liga.web.Requests;

/**
 * Tashkilotchi va yordamchilar akkauntlari. Tizim o'zini o'zi qulflab qo'ymasligi uchun:
 * o'z akkauntini o'chirish yoki rolini pasaytirish mumkin emas, kamida bitta faol bosh tashkilotchi qoladi.
 */
@Service
@Transactional
public class UserService {

    private final AppUserRepository users;
    private final PasswordEncoder encoder;
    private final CurrentUser currentUser;
    private final AuditService audit;

    public UserService(AppUserRepository users, PasswordEncoder encoder, CurrentUser currentUser, AuditService audit) {
        this.users = users;
        this.encoder = encoder;
        this.currentUser = currentUser;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<UserDto> list() {
        return users.findAll().stream()
                .sorted(Comparator.comparing((AppUser u) -> u.role.ordinal()).thenComparing(u -> u.displayName))
                .map(UserDto::of)
                .toList();
    }

    public UserDto create(Requests.UserCreate in) {
        String username = in.username().trim();
        if (users.findByUsernameIgnoreCase(username).isPresent()) throw ApiException.conflict("«" + username + "» logini band. Boshqa login tanlang.");
        checkPassword(in.password(), username);
        AppUser u = new AppUser();
        u.username = username;
        u.displayName = in.displayName().trim();
        u.role = in.role();
        u.passwordHash = encoder.encode(in.password());
        u.enabled = true;
        users.save(u);
        audit.record("Foydalanuvchi", u.displayName + " (" + u.username + ") qo‘shildi, roli: " + roleLabel(u.role), "USER", u.getId());
        return UserDto.of(u);
    }

    public UserDto update(UUID id, Requests.UserUpdate in) {
        AppUser u = user(id);
        boolean self = isSelf(u);
        if (self && (!in.enabled() || in.role() != u.role)) {
            throw ApiException.conflict("O‘z akkauntingizni o‘chirib yoki rolini o‘zgartirib bo‘lmaydi. Buni boshqa bosh tashkilotchi bajarishi mumkin.");
        }
        boolean losesSuperAdmin = u.role == Role.SUPER_ADMIN && u.enabled && (in.role() != Role.SUPER_ADMIN || !in.enabled());
        if (losesSuperAdmin && activeSuperAdmins() <= 1) {
            throw ApiException.conflict("Tizimda kamida bitta faol bosh tashkilotchi qolishi kerak.");
        }
        u.displayName = in.displayName().trim();
        u.role = in.role();
        u.enabled = in.enabled();
        audit.record("Foydalanuvchi", u.displayName + " ma’lumotlari o‘zgartirildi (" + roleLabel(u.role) + (u.enabled ? "" : ", o‘chirilgan") + ")", "USER", u.getId());
        return UserDto.of(u);
    }

    public void resetPassword(UUID id, Requests.PasswordReset in) {
        AppUser u = user(id);
        checkPassword(in.password(), u.username);
        u.passwordHash = encoder.encode(in.password());
        audit.record("Foydalanuvchi", u.displayName + " uchun yangi parol o‘rnatildi", "USER", u.getId());
    }

    /** Har bir admin o'z parolini almashtiradi: joriy parol tekshiriladi */
    public void changeOwnPassword(Requests.PasswordChange in) {
        AppUser u = currentUser.get().orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Bu amal uchun tizimga kiring."));
        if (!encoder.matches(in.currentPassword(), u.passwordHash)) throw ApiException.badRequest("Joriy parol noto‘g‘ri.");
        if (in.currentPassword().equals(in.newPassword())) throw ApiException.badRequest("Yangi parol joriy paroldan farq qilishi kerak.");
        checkPassword(in.newPassword(), u.username);
        u.passwordHash = encoder.encode(in.newPassword());
        audit.record("Foydalanuvchi", u.displayName + " o‘z parolini almashtirdi", "USER", u.getId());
    }

    private static void checkPassword(String password, String username) {
        if (password == null || password.length() < 10) throw ApiException.badRequest("Parol kamida 10 ta belgidan iborat bo‘lsin.");
        if (password.length() > 128) throw ApiException.badRequest("Parol juda uzun.");
        if (password.toLowerCase().contains(username.toLowerCase())) throw ApiException.badRequest("Parol ichida login bo‘lmasin.");
        if (password.chars().distinct().count() < 5) throw ApiException.badRequest("Parol juda oddiy. Har xil harf va raqamlardan foydalaning.");
    }

    private long activeSuperAdmins() {
        return users.findAll().stream().filter(x -> x.enabled && x.role == Role.SUPER_ADMIN).count();
    }

    private boolean isSelf(AppUser u) {
        return currentUser.get().map(c -> c.getId().equals(u.getId())).orElse(false);
    }

    private AppUser user(UUID id) {
        return users.findById(id).orElseThrow(() -> ApiException.notFound("Foydalanuvchi topilmadi."));
    }

    static String roleLabel(Role role) {
        return switch (role) {
            case SUPER_ADMIN -> "Bosh tashkilotchi";
            case ADMIN -> "Administrator";
            case RESULT_ENTRY -> "Natija kirituvchi";
            case EDITOR -> "Muharrir";
        };
    }
}
