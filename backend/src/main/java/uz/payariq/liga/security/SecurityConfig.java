package uz.payariq.liga.security;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import uz.payariq.liga.repo.AppUserRepository;

/**
 * Xavfsizlik:
 * - ommaviy GET API hammaga ochiq, admin API faqat avtorizatsiyadan keyin va rolga qarab;
 * - sessiya httpOnly cookie'da, CSRF himoyasi SPA uchun cookie + header orqali;
 * - parollar BCrypt bilan saqlanadi.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private static final String[] ALL_ADMINS = {"SUPER_ADMIN", "ADMIN", "RESULT_ENTRY", "EDITOR"};

    /**
     * Sayt va API uchun yagona CSP: faqat o'z domenidan skript, rasm, shrift va so'rovlar.
     * Uslublarda 'unsafe-inline' kerak — React elementlarining style atributi (masalan, jamoa ranglari).
     */
    static final String CSP = String.join("; ",
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "font-src 'self'",
            "connect-src 'self'",
            "manifest-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'");

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, SecurityContextRepository contextRepository, AppUserRepository users) throws Exception {
        http
                .csrf(csrf -> csrf.spa())
                .addFilterAfter(new CsrfCookieFilter(), CsrfFilter.class)
                .addFilterBefore(new ActiveUserFilter(users), AuthorizationFilter.class)
                .securityContext(ctx -> ctx.securityContextRepository(contextRepository))
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .headers(h -> h
                        .contentSecurityPolicy(csp -> csp.policyDirectives(CSP))
                        .permissionsPolicyHeader(p -> p.policy("camera=(), microphone=(), geolocation=(), payment=(), usb=()"))
                        .referrerPolicy(r -> r.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.SAME_ORIGIN)))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.GET, "/api/public/**", "/media/**", "/actuator/health").permitAll()
                        .requestMatchers("/api/auth/password", "/api/auth/telegram", "/api/auth/telegram/**").authenticated()
                        .requestMatchers("/api/auth/**", "/error").permitAll()
                        // Faqat bosh tashkilotchi
                        .requestMatchers("/api/admin/seasons/*/finish", "/api/admin/seasons/*/delete", "/api/admin/settings", "/api/admin/users/**").hasRole("SUPER_ADMIN")
                        // Natija kirituvchi faqat natija kiritadi
                        .requestMatchers(HttpMethod.PUT, "/api/admin/matches/*/result").hasAnyRole("SUPER_ADMIN", "ADMIN", "RESULT_ENTRY")
                        // Muharrir: yangiliklar, homiylar va rasm yuklash
                        .requestMatchers("/api/admin/news/**", "/api/admin/sponsors/**", "/api/admin/media/**").hasAnyRole("SUPER_ADMIN", "ADMIN", "EDITOR")
                        // Boshqaruv panelini o'qish barcha adminlarga ruxsat
                        .requestMatchers(HttpMethod.GET, "/api/admin/**").hasAnyRole(ALL_ADMINS)
                        .requestMatchers("/api/admin/**").hasAnyRole("SUPER_ADMIN", "ADMIN")
                        // Sayt sahifalari va statik fayllar (production'da frontend shu serverdan tarqatiladi)
                        .requestMatchers(req -> HttpMethod.GET.matches(req.getMethod()) && !req.getRequestURI().startsWith("/api/")).permitAll()
                        .anyRequest().denyAll())
                .exceptionHandling(e -> e
                        .authenticationEntryPoint((req, res, ex) -> writeError(res, HttpServletResponse.SC_UNAUTHORIZED, "Bu amal uchun tizimga kiring."))
                        .accessDeniedHandler((req, res, ex) -> writeError(res, HttpServletResponse.SC_FORBIDDEN, "Bu amal uchun sizda ruxsat yo‘q.")));
        return http.build();
    }

    @Bean
    SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }

    @Bean
    AuthenticationManager authenticationManager(LeagueUserDetailsService userDetailsService, PasswordEncoder passwordEncoder) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder);
        return new ProviderManager(provider);
    }

    static void writeError(HttpServletResponse res, int status, String message) throws java.io.IOException {
        res.setStatus(status);
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        res.setCharacterEncoding("UTF-8");
        res.getWriter().write("{\"message\":\"" + message.replace("\"", "'") + "\"}");
    }
}
