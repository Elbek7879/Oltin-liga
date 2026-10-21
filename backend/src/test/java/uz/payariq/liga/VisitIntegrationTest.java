package uz.payariq.liga;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import uz.payariq.liga.domain.Role;
import uz.payariq.liga.domain.Schedule;

class VisitIntegrationTest extends IntegrationTestBase {

    private static final String PHONE = "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";
    private static final String DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";
    private static final String GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

    @Autowired
    private JdbcTemplate jdbc;

    /** Brauzer kabi: CSRF tokensiz (sendBeacon sarlavha qo'ya olmaydi) */
    private MockHttpServletRequestBuilder visit(String path, String referrer, String visitor, String userAgent) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("path", path);
        body.put("referrer", referrer);
        body.put("visitor", visitor);
        MockHttpServletRequestBuilder req = post("/api/public/visit").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        if (userAgent != null) req.header(HttpHeaders.USER_AGENT, userAgent);
        return req;
    }

    private void send(String path, String referrer, String visitor, String userAgent) throws Exception {
        mvc.perform(visit(path, referrer, visitor, userAgent)).andExpect(status().isNoContent());
    }

    private JsonNode stats() throws Exception {
        return getJson("/api/admin/visits");
    }

    private static LocalDate today() {
        return LocalDate.now(Schedule.ZONE);
    }

    @Test
    @DisplayName("bir odam kuniga necha marta kirsa ham bir kishi; sahifalar, manba va qurilma sanaladi")
    void countsVisitorsAndViews() throws Exception {
        String sardor = UUID.randomUUID().toString();
        String aziz = UUID.randomUUID().toString();
        send("/jadval", "https://t.me/oltinliga12", sardor, PHONE);
        send("/oyinlar?tab=natijalar", null, sardor, PHONE);
        send("/jadval/", null, sardor, PHONE);
        send("/", "", aziz, DESKTOP);

        JsonNode s = stats();
        assertThat(s.at("/today/visitors").asLong()).isEqualTo(2);
        assertThat(s.at("/today/views").asLong()).isEqualTo(4);
        assertThat(s.at("/week/visitors").asLong()).isEqualTo(2);
        assertThat(s.at("/total/visitors").asLong()).isEqualTo(2);
        assertThat(s.get("since").asText()).isEqualTo(today().toString());
        assertThat(s.at("/pages/0/path").asText()).isEqualTo("/jadval");
        assertThat(s.at("/pages/0/label").asText()).isEqualTo("Turnir jadvali");
        assertThat(s.at("/pages/0/views").asLong()).isEqualTo(2);
        assertThat(s.get("pages").findValuesAsString("label")).contains("Bosh sahifa", "O‘yinlar");
        assertThat(s.get("sources").toString()).contains("{\"key\":\"telegram\",\"visits\":1}").contains("{\"key\":\"direct\",\"visits\":1}");
        assertThat(s.get("devices").toString()).contains("{\"key\":\"phone\",\"visits\":1}").contains("{\"key\":\"desktop\",\"visits\":1}");
        // Brauzerdagi raqamning o'zi bazada yo'q
        assertThat(jdbc.queryForObject("select count(*) from visit_days where visitor = ?", Long.class, sardor)).isZero();
    }

    @Test
    @DisplayName("robotlar, admin panel, mavjud bo'lmagan sahifa, noto'g'ri raqam va tizimga kirgan tashkilotchi sanalmaydi")
    void ignoresBotsAdminsAndJunk() throws Exception {
        String visitor = UUID.randomUUID().toString();
        send("/jadval", null, visitor, GOOGLEBOT);
        send("/jadval", null, visitor, null);
        send("/admin/natijalar", null, visitor, PHONE);
        send("/bunday-sahifa-yoq", null, visitor, PHONE);
        send("/jamoalar/00000000-0000-0000-0000-000000000000", null, visitor, PHONE);
        send("/jadval", null, "salom", PHONE);
        send("/" + "a".repeat(300), null, visitor, PHONE);
        mvc.perform(visit("/jadval", null, visitor, PHONE).with(asAdmin())).andExpect(status().isNoContent());
        mvc.perform(post("/api/public/visit").contentType(MediaType.APPLICATION_JSON).content("{}").header(HttpHeaders.USER_AGENT, PHONE))
                .andExpect(status().isNoContent());

        JsonNode s = stats();
        assertThat(s.at("/total/visitors").asLong()).isZero();
        assertThat(s.at("/total/views").asLong()).isZero();
        assertThat(s.get("since").isNull()).isTrue();
        assertThat(s.get("pages")).isEmpty();
    }

    @Test
    @DisplayName("bugun, 7 kun, 30 kun va jami to'g'ri chegaralanadi; grafikda 30 kun, bo'sh kunlar nol")
    void periods() throws Exception {
        LocalDate today = today();
        insert(today.minusDays(10), "a", 5, "/jadval");
        insert(today.minusDays(40), "b", 3, "/nizom");
        insert(today.minusDays(40), "a", 1, "/nizom");
        send("/statistika", null, UUID.randomUUID().toString(), DESKTOP);

        JsonNode s = stats();
        assertThat(s.at("/today/visitors").asLong()).isEqualTo(1);
        assertThat(s.at("/week/visitors").asLong()).isEqualTo(1);
        assertThat(s.at("/month/visitors").asLong()).isEqualTo(2);
        assertThat(s.at("/month/views").asLong()).isEqualTo(6);
        // «a» ikki xil kunda kelgan — jami hisobda bir kishi
        assertThat(s.at("/total/visitors").asLong()).isEqualTo(3);
        assertThat(s.at("/total/views").asLong()).isEqualTo(10);
        assertThat(s.get("since").asText()).isEqualTo(today.minusDays(40).toString());
        JsonNode daily = s.get("daily");
        assertThat(daily).hasSize(30);
        assertThat(daily.get(0).get("day").asText()).isEqualTo(today.minusDays(29).toString());
        assertThat(daily.get(29).get("day").asText()).isEqualTo(today.toString());
        assertThat(daily.get(19).get("visitors").asLong()).isEqualTo(1);
        assertThat(daily.get(19).get("views").asLong()).isEqualTo(5);
        assertThat(daily.get(18).get("views").asLong()).isZero();
    }

    @Test
    @DisplayName("bir odam kuniga 300 dan ortiq sahifa ochsa, ortig'i sanalmaydi")
    void capsViewsPerVisitor() throws Exception {
        String visitor = UUID.randomUUID().toString();
        send("/jadval", null, visitor, PHONE);
        jdbc.update("update visit_days set views = 300");
        send("/jadval", null, visitor, PHONE);
        assertThat(stats().at("/today/views").asLong()).isEqualTo(1);
    }

    @Test
    @DisplayName("statistikani bosh tashkilotchi va administrator ko'radi, boshqalar — yo'q")
    void access() throws Exception {
        mvc.perform(get("/api/admin/visits")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/visits").with(as(Role.RESULT_ENTRY))).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/visits").with(as(Role.EDITOR))).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/visits").with(as(Role.ADMIN))).andExpect(status().isOk());
    }

    private void insert(LocalDate day, String visitor, int views, String path) {
        jdbc.update("insert into visit_days (day, visitor, source, device, views) values (?, ?, 'direct', 'desktop', ?)", day, visitor, views);
        jdbc.update("""
                insert into visit_pages (day, path, views) values (?, ?, ?)
                on conflict (day, path) do update set views = visit_pages.views + excluded.views""", day, path, views);
    }
}
