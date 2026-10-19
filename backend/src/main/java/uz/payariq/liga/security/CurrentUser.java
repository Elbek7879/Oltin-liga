package uz.payariq.liga.security;

import java.util.Optional;
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
}
