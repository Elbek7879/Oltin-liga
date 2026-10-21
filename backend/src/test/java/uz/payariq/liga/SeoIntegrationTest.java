package uz.payariq.liga;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import javax.xml.parsers.DocumentBuilderFactory;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;

/** Google va Telegram uchun: har sahifaning o'z nomi, 404, admin noindex, sitemap.xml va robots.txt */
class SeoIntegrationTest extends IntegrationTestBase {

    private static final String LEAGUE = "Payariq Oltin Ligasi";

    private String html(String path, int expectedStatus) throws Exception {
        MvcResult r = mvc.perform(get(path)).andExpect(status().is(expectedStatus)).andReturn();
        return r.getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    private static String title(String html) {
        return html.substring(html.indexOf("<title>") + 7, html.indexOf("</title>"));
    }

    private Map<String, Object> rules() {
        return Map.of("pointsWin", 3, "pointsDraw", 1, "pointsLoss", 0, "tiebreakers", List.of("GOAL_DIFF"),
                "legs", 1, "qualifiersPerGroup", 2, "thirdPlaceMatch", false, "halfMinutes", 20);
    }

    private String season(String name, boolean test) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", name);
        body.put("year", 2026);
        body.put("startDate", "2026-05-01");
        body.put("endDate", "2026-08-31");
        body.put("rules", rules());
        body.put("test", test);
        return postJson("/api/admin/seasons", body).get("id").asText();
    }

    private void team(String seasonId, String name, String village) throws Exception {
        postJson("/api/admin/teams?addToSeasonId=" + seasonId, Map.of("name", name, "shortName", "JAM", "village", village,
                "primaryColor", "#145A3A", "secondaryColor", "#E2BF4F"));
    }

    private String teamId(String seasonId, String name) throws Exception {
        for (JsonNode row : getJson("/api/admin/seasons/" + seasonId + "/teams")) if (row.get("name").asText().equals(name)) return row.get("id").asText();
        throw new AssertionError("Jamoa topilmadi: " + name);
    }

    @Test
    @DisplayName("doimiy sahifalar: o'z nomi, tavsifi, asosiy manzili va Telegram teglari; bosh sahifada liga haqida tuzilgan ma'lumot")
    void staticPages() throws Exception {
        String home = html("/", 200);
        assertThat(title(home)).isEqualTo(LEAGUE + " — o‘yinlar, natijalar va turnir jadvali");
        assertThat(home).contains("<link rel=\"canonical\" href=\"http://localhost/\" />")
                .contains("<meta property=\"og:image\" content=\"http://localhost/og-image.jpg\" />")
                .contains("\"@type\":\"SportsOrganization\"")
                .doesNotContain("seo:start").doesNotContain("<meta name=\"robots\"");

        String table = html("/jadval", 200);
        assertThat(title(table)).isEqualTo("Turnir jadvali — " + LEAGUE);
        assertThat(table).contains("content=\"Guruhlar jadvali: ochkolar, to‘plar farqi va pley-offga chiqish zonasi.\"")
                .contains("<meta property=\"og:url\" content=\"http://localhost/jadval\" />")
                .doesNotContain("ld+json");
        // Oxiridagi «/» va so'rov parametrlari asosiy manzilga ta'sir qilmaydi
        assertThat(html("/jadval/", 200)).contains("<link rel=\"canonical\" href=\"http://localhost/jadval\" />");
        assertThat(html("/oyinlar?tab=natijalar", 200)).contains("<link rel=\"canonical\" href=\"http://localhost/oyinlar\" />");

        // Har bir doimiy sahifaning nomi boshqalarnikidan farq qiladi
        List<String> titles = new ArrayList<>();
        for (String p : List.of("/", "/oyinlar", "/jadval", "/pley-off", "/jamoalar", "/futbolchilar", "/statistika", "/ramziy-jamoa", "/yangiliklar",
                "/mavsumlar", "/chempionlar", "/homiylar", "/liga-haqida", "/nizom")) {
            titles.add(title(html(p, 200)));
        }
        assertThat(titles).doesNotHaveDuplicates();
    }

    @Test
    @DisplayName("mavjud bo'lmagan sahifa 404 va noindex; admin panel noindex; fayl va API manzillariga tegilmaydi")
    void notFoundAndAdmin() throws Exception {
        String missing = html("/bunday-sahifa-yoq", 404);
        assertThat(title(missing)).isEqualTo("Sahifa topilmadi — " + LEAGUE);
        assertThat(missing).contains("<meta name=\"robots\" content=\"noindex\" />").doesNotContain("canonical");
        mvc.perform(get("/bunday-sahifa-yoq")).andExpect(header().string("X-Robots-Tag", "noindex"));
        html("/jamoalar/bu-uuid-emas", 404);
        html("/jamoalar/00000000-0000-0000-0000-000000000000", 404);
        html("/yangiliklar/bunday-yangilik-yoq", 404);

        String admin = html("/admin/natijalar", 200);
        assertThat(title(admin)).isEqualTo("Boshqaruv paneli — " + LEAGUE);
        assertThat(admin).contains("<meta name=\"robots\" content=\"noindex\" />").doesNotContain("canonical");
        mvc.perform(get("/admin")).andExpect(status().isOk()).andExpect(header().string("X-Robots-Tag", "noindex"));
        // API, rasm va fayllar oldingidek
        mvc.perform(get("/api/public/seasons")).andExpect(status().isOk());
        mvc.perform(get("/rasm-yoq.png")).andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("jamoa, futbolchi, o'yin va yangilik sahifalari ma'lumotdan nomlanadi; sinov mavsumi va qoralama yangilik yashirin")
    void dynamicPagesAndSitemap() throws Exception {
        String seasonId = season("1-mavsum", false);
        postJson("/api/admin/seasons/" + seasonId + "/activate", null);
        team(seasonId, "Lochin", "Qizil Qishloq");
        team(seasonId, "Chinor & \"Do'stlik\"", "Bog‘ishamol");
        String lochin = teamId(seasonId, "Lochin");
        List<String> stIds = new ArrayList<>();
        for (JsonNode row : getJson("/api/admin/seasons/" + seasonId + "/teams")) if (row.get("inSeason").asBoolean()) stIds.add(row.get("seasonTeamId").asText());
        postJson("/api/admin/seasons/" + seasonId + "/players/bulk", Map.of("seasonTeamId", stIds.get(0), "players",
                List.of(Map.of("firstName", "Sardor", "lastName", "Karimov", "number", 9))));
        putJson("/api/admin/seasons/" + seasonId + "/groups", Map.of("groups", List.of(Map.of("name", "A", "teamIds", stIds))));
        JsonNode bundle = getJson("/api/public/seasons/" + seasonId + "/bundle");
        String player = bundle.get("rosters").get(0).get("playerId").asText();
        JsonNode match = bundle.get("matches").get(0);
        String matchId = match.get("id").asText();
        String homeName = null, awayName = null;
        for (JsonNode t : bundle.get("teams")) {
            if (t.get("id").asText().equals(match.get("homeId").asText())) homeName = t.get("name").asText();
            if (t.get("id").asText().equals(match.get("awayId").asText())) awayName = t.get("name").asText();
        }

        String teamPage = html("/jamoalar/" + lochin, 200);
        assertThat(title(teamPage)).isEqualTo("Lochin — " + LEAGUE);
        assertThat(teamPage).contains("content=\"Lochin (Qizil Qishloq): o‘yinlar, natijalar, tarkib va mavsumlar bo‘yicha statistika.\"");
        // Maxsus belgilar HTML ichida xavfsiz
        String other = html("/jamoalar/" + teamId(seasonId, "Chinor & \"Do'stlik\""), 200);
        assertThat(title(other)).isEqualTo("Chinor &amp; &quot;Do&#39;stlik&quot; — " + LEAGUE);

        assertThat(title(html("/futbolchilar/" + player, 200))).isEqualTo("Sardor Karimov — " + LEAGUE);
        assertThat(title(html("/oyinlar/" + matchId, 200))).isEqualTo(esc(homeName + " – " + awayName) + " — " + LEAGUE);
        // Natija kiritilgach nomda hisob ko'rinadi
        putJson("/api/admin/matches/" + matchId + "/schedule", Map.of("kickoff", "2026-05-02T10:00:00+05:00"));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", "FINISHED");
        result.put("homeScore", 2);
        result.put("awayScore", 1);
        // Gollar hisob bilan mos bo'lishi shart (muallif noma'lum)
        String homeId = match.get("homeId").asText();
        String awayId = match.get("awayId").asText();
        result.put("events", List.of(Map.of("type", "GOAL", "seasonTeamId", homeId), Map.of("type", "GOAL", "seasonTeamId", homeId),
                Map.of("type", "GOAL", "seasonTeamId", awayId)));
        perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/admin/matches/" + matchId + "/result"), result, asAdmin())
                .andExpect(status().isOk());
        assertThat(title(html("/oyinlar/" + matchId, 200))).isEqualTo(esc(homeName + " 2:1 " + awayName) + " — " + LEAGUE);

        // Yangilik: e'lon qilingani ochiq, qoralama — 404
        Map<String, Object> news = new LinkedHashMap<>();
        news.put("title", "Mavsum boshlandi");
        news.put("excerpt", "Birinchi tur o‘yinlari shanba kuni.");
        news.put("body", "Matn");
        news.put("important", false);
        news.put("status", "PUBLISHED");
        String slug = postJson("/api/admin/news", news).get("slug").asText();
        news.put("title", "Qoralama yangilik");
        news.put("status", "DRAFT");
        String draft = postJson("/api/admin/news", news).get("slug").asText();
        String newsPage = html("/yangiliklar/" + slug, 200);
        assertThat(title(newsPage)).isEqualTo("Mavsum boshlandi — " + LEAGUE);
        assertThat(newsPage).contains("content=\"Birinchi tur o‘yinlari shanba kuni.\"");
        html("/yangiliklar/" + draft, 404);

        // Sinov mavsumidagi jamoa saytda ham, sitemap'da ham yo'q
        String testSeason = season("Sinov", true);
        team(testSeason, "Sinovchi", "Sinov");
        String hidden = teamId(testSeason, "Sinovchi");
        html("/jamoalar/" + hidden, 404);

        String robots = mvc.perform(get("/robots.txt")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(robots).contains("Disallow: /admin").contains("Disallow: /api/").contains("Sitemap: http://localhost/sitemap.xml");

        String sitemap = mvc.perform(get("/sitemap.xml")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        // To'g'ri XML
        DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(new ByteArrayInputStream(sitemap.getBytes(StandardCharsets.UTF_8)));
        assertThat(sitemap).contains("<loc>http://localhost/</loc>", "<loc>http://localhost/jadval</loc>", "<loc>http://localhost/jamoalar/" + lochin + "</loc>",
                "<loc>http://localhost/futbolchilar/" + player + "</loc>", "<loc>http://localhost/oyinlar/" + matchId + "</loc>",
                "<loc>http://localhost/yangiliklar/" + slug + "</loc>");
        assertThat(sitemap).doesNotContain(hidden).doesNotContain(draft).doesNotContain("/admin");
    }

    private static String esc(String s) {
        return org.springframework.web.util.HtmlUtils.htmlEscape(s, "UTF-8");
    }
}
