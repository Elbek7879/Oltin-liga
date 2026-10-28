package uz.payariq.liga;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.head;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import uz.payariq.liga.config.SpaConfig;
import uz.payariq.liga.domain.Role;

class SecurityIntegrationTest extends IntegrationTestBase {

    private static final Map<String, Object> TEAM = Map.of("name", "Navbahor", "shortName", "NAV", "village", "Payariq",
            "primaryColor", "#145A3A", "secondaryColor", "#E2BF4F");

    @Test
    @DisplayName("ommaviy API loginsiz ochiq, admin API esa yopiq")
    void publicVsAdmin() throws Exception {
        mvc.perform(get("/api/public/seasons")).andExpect(status().isOk());
        mvc.perform(get("/api/admin/audit"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Bu amal uchun tizimga kiring."));
    }

    @Test
    @DisplayName("CSRF tokensiz o'zgartirish so'rovi rad etiladi")
    void csrfRequired() throws Exception {
        mvc.perform(post("/api/admin/teams").with(asAdmin()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(TEAM)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("natija kirituvchi jamoa qo'sha olmaydi")
    void roles() throws Exception {
        perform(post("/api/admin/teams"), TEAM, as(Role.RESULT_ENTRY))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Bu amal uchun sizda ruxsat yo‘q."));
        perform(post("/api/admin/teams"), TEAM, as(Role.ADMIN)).andExpect(status().isOk());
    }

    @Test
    @DisplayName("to'g'ri parol bilan kirish sessiya ochadi, noto'g'ri parol rad etiladi")
    void login() throws Exception {
        mvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("username", ADMIN, "password", "notogri"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Login yoki parol noto‘g‘ri."));

        MockHttpSession session = (MockHttpSession) mvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("username", ADMIN, "password", ADMIN_PASSWORD))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("SUPER_ADMIN"))
                .andReturn().getRequest().getSession(false);

        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk()).andExpect(jsonPath("$.displayName").value("Sinov tashkilotchisi"));
        mvc.perform(get("/api/admin/audit").session(session)).andExpect(status().isOk());
    }

    @Test
    @DisplayName("ko'p marta noto'g'ri parol kiritilsa vaqtincha bloklanadi")
    void bruteForce() throws Exception {
        String body = json.writeValueAsString(Map.of("username", "boshqa-admin", "password", "xato"));
        for (int i = 0; i < 5; i++) {
            mvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isUnauthorized());
        }
        mvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    @DisplayName("IP manzilini almashtirib parol taxmin qilish ham bloklanadi (bitta login uchun 10 ta xato)")
    void bruteForceFromManyAddresses() throws Exception {
        String body = json.writeValueAsString(Map.of("username", "tarqoq-hujum", "password", "xato"));
        for (int i = 0; i < 10; i++) {
            String ip = "198.51.100." + i;
            mvc.perform(post("/api/auth/login").with(csrf()).with(r -> { r.setRemoteAddr(ip); return r; })
                    .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isUnauthorized());
        }
        mvc.perform(post("/api/auth/login").with(csrf()).with(r -> { r.setRemoteAddr("203.0.113.77"); return r; })
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    @DisplayName("HEAD so'rovlari (monitoring xizmatlari) GET kabi ochiq")
    void headRequests() throws Exception {
        mvc.perform(head("/api/public/seasons")).andExpect(status().isOk());
        mvc.perform(head("/")).andExpect(status().isOk());
    }

    @Test
    @DisplayName("noto'g'ri so'rov 500 emas, tushunarli 400/415 qaytaradi")
    void clientErrors() throws Exception {
        mvc.perform(get("/api/public/head-to-head").param("teamA", "00000000-0000-0000-0000-000000000000"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("So‘rovda kerakli ma’lumot yetishmayapti."));
        mvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.TEXT_PLAIN).content("x"))
                .andExpect(status().isUnsupportedMediaType());
    }

    @Test
    @DisplayName("forma xatolari o'zbek tilida qaytariladi")
    void validationMessages() throws Exception {
        perform(post("/api/admin/teams"), Map.of("name", "", "shortName", "N", "village", "", "primaryColor", "#145A3A", "secondaryColor", "#E2BF4F"), asAdmin())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.shortName").value("Qisqa nom 2–4 ta harfdan iborat bo‘lsin, masalan NAV"));
    }

    @Test
    @DisplayName("xavfsizlik sarlavhalari: CSP, ramkaga qo'yish taqiqi, Permissions-Policy")
    void securityHeaders() throws Exception {
        mvc.perform(get("/api/public/seasons"))
                .andExpect(header().string("Content-Security-Policy", org.hamcrest.Matchers.containsString("default-src 'self'")))
                .andExpect(header().string("Content-Security-Policy", org.hamcrest.Matchers.containsString("frame-ancestors 'none'")))
                .andExpect(header().string("X-Frame-Options", "DENY"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().exists("Permissions-Policy"));
    }

    @Test
    @DisplayName("sayt sahifalari loginsiz ochiq, noma'lum API yo'li esa yopiq")
    void siteRoutesVsUnknownApi() throws Exception {
        // Ruxsat bor: frontend yig'ilgan bo'lsa index.html (200), yig'ilmagan bo'lsa 404 — lekin hech qachon 401 emas
        mvc.perform(get("/jadval")).andExpect(result -> assertThat(result.getResponse().getStatus()).isIn(200, 404));
        mvc.perform(get("/api/yashirin")).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("SPA: faqat sayt sahifalari index.html ga yo'naltiriladi")
    void spaRoutes() {
        assertThat(SpaConfig.SpaFallbackResolver.isAppRoute("jadval")).isTrue();
        assertThat(SpaConfig.SpaFallbackResolver.isAppRoute("admin/natijalar/123")).isTrue();
        assertThat(SpaConfig.SpaFallbackResolver.isAppRoute("api/public/x")).isFalse();
        assertThat(SpaConfig.SpaFallbackResolver.isAppRoute("media/a.png")).isFalse();
        assertThat(SpaConfig.SpaFallbackResolver.isAppRoute("assets/yoq.js")).isFalse();
    }
}
