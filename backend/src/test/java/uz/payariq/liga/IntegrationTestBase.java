package uz.payariq.liga;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import uz.payariq.liga.domain.Role;
import uz.payariq.liga.model.AppUser;
import uz.payariq.liga.repo.AppUserRepository;

/**
 * Integratsion testlar alohida payariq_test bazasida ishlaydi. Har bir testdan oldin
 * barcha jadvallar tozalanadi va sinov admini yaratiladi.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public abstract class IntegrationTestBase {

    protected static final String ADMIN = "sinov-admin";
    protected static final String ADMIN_PASSWORD = "sinov-parol-12345";

    @Autowired
    protected MockMvc mvc;
    @Autowired
    protected ObjectMapper json;
    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private AppUserRepository users;
    @Autowired
    protected PasswordEncoder encoder;
    private String passwordHash;

    @BeforeEach
    void cleanDatabase() {
        jdbc.execute("""
                truncate table tiebreak_lots, outbox_events, audit_logs, sponsors, news, season_awards, point_adjustments, match_appearances,
                match_events, matches, venues, group_teams, league_groups, season_rosters, season_teams, players, teams,
                seasons, app_users, visit_days, visit_pages restart identity cascade""");
        AppUser admin = new AppUser();
        admin.username = ADMIN;
        passwordHash = encoder.encode(ADMIN_PASSWORD);
        admin.passwordHash = passwordHash;
        admin.displayName = "Sinov tashkilotchisi";
        admin.role = Role.SUPER_ADMIN;
        users.save(admin);
    }

    protected RequestPostProcessor asAdmin() {
        return user(ADMIN).roles("SUPER_ADMIN");
    }

    /** Shu roldagi haqiqiy foydalanuvchi nomidan (sessiya filtri bazadagi rolni tekshiradi) */
    protected RequestPostProcessor as(Role role) {
        if (role == Role.SUPER_ADMIN) return asAdmin();
        String username = "yordamchi-" + role.name().toLowerCase().replace('_', '-');
        if (users.findByUsernameIgnoreCase(username).isEmpty()) {
            AppUser helper = new AppUser();
            helper.username = username;
            helper.passwordHash = passwordHash;
            helper.displayName = "Sinov yordamchisi";
            helper.role = role;
            users.save(helper);
        }
        return user(username).roles(role.name());
    }

    protected ResultActions perform(MockHttpServletRequestBuilder req, Object body, RequestPostProcessor who) throws Exception {
        if (body != null) req.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        if (who != null) req.with(who);
        return mvc.perform(req.with(csrf()));
    }

    protected JsonNode read(ResultActions actions) throws Exception {
        String content = actions.andReturn().getResponse().getContentAsString();
        return content.isBlank() ? json.nullNode() : json.readTree(content);
    }

    protected JsonNode getJson(String url) throws Exception {
        return read(perform(get(url), null, asAdmin()));
    }

    protected JsonNode postJson(String url, Object body) throws Exception {
        return read(perform(post(url), body, asAdmin()));
    }

    protected JsonNode putJson(String url, Object body) throws Exception {
        return read(perform(put(url), body, asAdmin()));
    }

    protected ResultActions doDelete(String url) throws Exception {
        return perform(delete(url), null, asAdmin());
    }

    /** Tashkilotchi kabi: sanasi belgilanmagan har bir o'yinga sana va vaqt qo'yadi (kuniga 4 ta o'yin) */
    protected int scheduleUndated(JsonNode bundle, java.time.LocalDate start) throws Exception {
        int i = 0;
        for (JsonNode m : bundle.get("matches")) {
            if (m.get("timeConfirmed").asBoolean()) continue;
            String kickoff = start.plusDays(i / 4).atTime(10 + (i % 4) * 2, 0).atOffset(java.time.ZoneOffset.ofHours(5)).toString();
            putJson("/api/admin/matches/" + m.get("id").asText() + "/schedule", java.util.Map.of("kickoff", kickoff));
            i++;
        }
        return i;
    }
}
