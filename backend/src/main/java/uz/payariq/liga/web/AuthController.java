package uz.payariq.liga.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import java.time.Clock;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import uz.payariq.liga.model.AppUser;
import uz.payariq.liga.repo.AppUserRepository;
import uz.payariq.liga.security.CurrentUser;
import uz.payariq.liga.security.LoginAttemptService;
import uz.payariq.liga.service.AuditService;
import uz.payariq.liga.service.UserService;
import uz.payariq.liga.web.Dto.AdminUser;

/** Tashkilotchilar uchun kirish va chiqish. Sessiya httpOnly cookie'da saqlanadi. */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final SecurityContextRepository contextRepository;
    private final SecurityContextHolderStrategy holder = SecurityContextHolder.getContextHolderStrategy();
    private final LoginAttemptService attempts;
    private final AppUserRepository users;
    private final CurrentUser currentUser;
    private final AuditService audit;
    private final UserService userService;
    private final PasswordEncoder encoder;
    private final Clock clock;

    public AuthController(AuthenticationManager authenticationManager, SecurityContextRepository contextRepository, LoginAttemptService attempts,
                          AppUserRepository users, CurrentUser currentUser, AuditService audit, UserService userService, PasswordEncoder encoder, Clock clock) {
        this.authenticationManager = authenticationManager;
        this.contextRepository = contextRepository;
        this.attempts = attempts;
        this.users = users;
        this.currentUser = currentUser;
        this.audit = audit;
        this.userService = userService;
        this.encoder = encoder;
        this.clock = clock;
    }

    @PostMapping("/login")
    @Transactional
    public AdminUser login(@Valid @RequestBody Requests.Login in, HttpServletRequest request, HttpServletResponse response) {
        String username = in.username().trim();
        String ip = request.getRemoteAddr();
        attempts.checkAllowed(username, ip);
        Authentication auth;
        try {
            auth = authenticationManager.authenticate(UsernamePasswordAuthenticationToken.unauthenticated(username, in.password()));
        } catch (DisabledException ex) {
            attempts.recordFailure(username, ip);
            // Spring holatni paroldan oldin tekshiradi; "o'chirilgan" xabari faqat to'g'ri parolda ko'rsatiladi
            boolean passwordOk = users.findByUsernameIgnoreCase(in.username().trim()).map(u -> encoder.matches(in.password(), u.passwordHash)).orElse(false);
            if (passwordOk) throw ex;
            throw new BadCredentialsException("Login yoki parol noto‘g‘ri");
        } catch (AuthenticationException ex) {
            attempts.recordFailure(username, ip);
            // Foydalanuvchi bor-yo'qligini oshkor qilmaslik uchun xabar bir xil
            throw new BadCredentialsException("Login yoki parol noto‘g‘ri");
        }
        attempts.recordSuccess(username, ip);
        // Sessiya fiksatsiyasidan himoya: kirishdan keyin sessiya identifikatori yangilanadi
        HttpSession existing = request.getSession(false);
        if (existing != null) request.changeSessionId();
        SecurityContext context = holder.createEmptyContext();
        context.setAuthentication(auth);
        holder.setContext(context);
        contextRepository.saveContext(context, request, response);
        AppUser user = users.findByUsernameIgnoreCase(auth.getName()).orElseThrow();
        user.lastLoginAt = clock.instant();
        audit.record("Kirish", user.displayName + " tizimga kirdi", "USER", user.getId());
        return new AdminUser(user.username, user.displayName, user.role);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) session.invalidate();
        holder.clearContext();
        return ResponseEntity.noContent().build();
    }

    /** Joriy foydalanuvchi; kirmagan bo'lsa bo'sh javob. Shu so'rov CSRF tokenini ham beradi. */
    @GetMapping("/me")
    public ResponseEntity<AdminUser> me() {
        return currentUser.get()
                .filter(u -> u.enabled)
                .map(u -> ResponseEntity.ok(new AdminUser(u.username, u.displayName, u.role)))
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    /** Har bir tashkilotchi o'z parolini almashtiradi */
    @PutMapping("/password")
    public ResponseEntity<Void> changePassword(@Valid @RequestBody Requests.PasswordChange in) {
        userService.changeOwnPassword(in);
        return ResponseEntity.noContent().build();
    }
}
