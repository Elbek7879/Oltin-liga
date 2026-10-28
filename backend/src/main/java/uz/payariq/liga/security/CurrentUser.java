package uz.payariq.liga.security;

import java.util.Optional;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import uz.payariq.liga.model.AppUser;
import uz.payariq.liga.repo.AppUserRepository;

/** Joriy so'rovni yuborgan admin foydalanuvchi */
@Component
public class CurrentUser {

    private final AppUserRepository users;

    public CurrentUser(AppUserRepository users) {
        this.users = users;
    }

    public Optional<AppUser> get() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) return Optional.empty();
        return users.findByUsernameIgnoreCase(auth.getName());
    }

    public String displayName() {
        return get().map(u -> u.displayName).orElse("Tizim");
    }

    /** So'rov tizimga kirmagan foydalanuvchidan (muxlisdan) keldi — bazaga murojaat qilmaydi */
    public static boolean anonymous() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken;
    }
}
