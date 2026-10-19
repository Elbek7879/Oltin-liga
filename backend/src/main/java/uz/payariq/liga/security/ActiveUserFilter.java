package uz.payariq.liga.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;
import uz.payariq.liga.model.AppUser;
import uz.payariq.liga.repo.AppUserRepository;

/**
 * Admin so'rovlarida foydalanuvchi hali ham faol ekanini va roli o'zgarmaganini tekshiradi:
 * bosh tashkilotchi yordamchini o'chirsa yoki rolini almashtirsa, uning ochiq sessiyasi darhol yopiladi.
 */
public class ActiveUserFilter extends OncePerRequestFilter {

    private final AppUserRepository users;

    public ActiveUserFilter(AppUserRepository users) {
        this.users = users;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        return !uri.startsWith("/api/admin/") && !uri.equals("/api/auth/password");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            AppUser user = users.findByUsernameIgnoreCase(auth.getName()).orElse(null);
            String message = null;
            if (user == null) message = "Akkaunt topilmadi. Qaytadan kiring.";
            else if (!user.enabled) message = "Akkauntingiz o‘chirilgan. Bosh tashkilotchiga murojaat qiling.";
            else if (!hasRole(auth, "ROLE_" + user.role.name())) message = "Rolingiz o‘zgartirildi. Qaytadan kiring.";
            if (message != null) {
                HttpSession session = request.getSession(false);
                if (session != null) session.invalidate();
                SecurityContextHolder.clearContext();
                SecurityConfig.writeError(response, HttpServletResponse.SC_UNAUTHORIZED, message);
                return;
            }
        }
        chain.doFilter(request, response);
    }

    private static boolean hasRole(Authentication auth, String authority) {
        return auth.getAuthorities().stream().anyMatch(a -> authority.equals(a.getAuthority()));
    }
}
