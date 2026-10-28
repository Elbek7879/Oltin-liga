package uz.payariq.liga;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.JsonNode;
import uz.payariq.liga.domain.Role;

/** Sinov mavsumi: saytda ko'rinmaydi, sinab bo'lgach bosh tashkilotchi uni butunlay o'chiradi. Haqiqiy mavsum himoyalangan */
class TestSeasonIntegrationTest extends IntegrationTestBase {

    @Autowired
    private JdbcTemplate sql;

    private static final Map<String, Object> RULES = Map.of("pointsWin", 3, "pointsDraw", 1, "pointsLoss", 0, "tiebreakers", List.of("GOAL_DIFF"),
            "legs", 1, "qualifiersPerGroup", 2, "thirdPlaceMatch", false, "halfMinutes", 20);

    private String createSeason(String name, boolean test) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", name);
        body.put("year", 2026);
        body.put("startDate", "2026-05-01");
        body.put("endDate", "2026-08-31");
        body.put("rules", RULES);
        body.put("test", test);
        return postJson("/api/admin/seasons", body).get("id").asText();
    }

    private Map<String, Object> team(String name, String logoUrl) {
        Map<String, Object> t = new LinkedHashMap<>();
        t.put("name", name);
        t.put("shortName", name.substring(0, 3).toUpperCase());
        t.put("village", name);
        t.put("primaryColor", "#145A3A");
        t.put("secondaryColor", "#E2BF4F");
        if (logoUrl != null) t.put("logoUrl", logoUrl);
        return t;
    }

    /** Mavsumga 4 jamoa, har biriga 4 futbolchi, qur'a, sanalar va 1-tur natijalari (gol bilan) */
    private void playFirstRound(String seasonId, List<String> names, String logoUrl) throws Exception {
        postJson("/api/admin/seasons/" + seasonId + "/activate", null);
        for (String n : names) postJson("/api/admin/teams?addToSeasonId=" + seasonId, team(n, n.equals(names.get(0)) ? logoUrl : null));
        List<String> ids = new ArrayList<>();
        for (JsonNode row : getJson("/api/admin/seasons/" + seasonId + "/teams")) if (row.get("inSeason").asBoolean()) ids.add(row.get("seasonTeamId").asText());
        int n = 0;
        for (String st : ids) {
            List<Map<String, Object>> list = new ArrayList<>();
            for (String pos : List.of("GK", "DF", "MF", "FW")) list.add(Map.of("firstName", "O‘yinchi", "lastName", "S" + (++n), "number", n, "position", pos));
            postJson("/api/admin/seasons/" + seasonId + "/players/bulk", Map.of("seasonTeamId", st, "players", list));
        }
        putJson("/api/admin/seasons/" + seasonId + "/groups", Map.of("groups", List.of(Map.of("name", "A", "teamIds", ids))));
        JsonNode bundle = getJson("/api/public/seasons/" + seasonId + "/bundle");
        scheduleUndated(bundle, java.time.LocalDate.of(2026, 5, 2));
        Map<String, String> anyPlayerOf = new LinkedHashMap<>();
        for (JsonNode r : bundle.get("rosters")) anyPlayerOf.putIfAbsent(r.get("seasonTeamId").asText(), r.get("playerId").asText());
        for (JsonNode m : getJson("/api/public/seasons/" + seasonId + "/bundle").get("matches")) {
            if (m.get("round").asInt() != 1) continue;
            String home = m.get("homeId").asText();
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("status", "FINISHED");
            result.put("homeScore", 1);
            result.put("awayScore", 0);
            result.put("events", List.of(Map.of("type", "GOAL", "seasonTeamId", home, "playerId", anyPlayerOf.get(home))));
            putJson("/api/admin/matches/" + m.get("id").asText() + "/result", result);
        }
    }

    private String teamId(String seasonId, String name) throws Exception {
        for (JsonNode row : getJson("/api/admin/seasons/" + seasonId + "/teams")) if (row.get("name").asText().equals(name)) return row.get("id").asText();
        return null;
    }

    private int count(String table) {
        return sql.queryForObject("select count(*) from " + table, Integer.class);
    }

    @Test
    @DisplayName("sinov mavsumi saytda ko'rinmaydi, sinab bo'lgach butunlay o'chadi; boshqa mavsumdagi jamoa va haqiqiy mavsum qoladi")
    void testSeasonLifecycle() throws Exception {
        // Logotip fayli: o'chirilgan jamoa bilan birga o'chishi kerak
        Path media = Path.of("target/test-uploads").toAbsolutePath();
        Files.createDirectories(media);
        String logoName = UUID.randomUUID() + ".png";
        Files.write(media.resolve(logoName), new byte[] {1, 2, 3});

        String testId = createSeason("Sinov", true);
        JsonNode adminList = getJson("/api/admin/seasons");
        assertThat(adminList).hasSize(1);
        assertThat(adminList.get(0).get("test").asBoolean()).isTrue();
        assertThat(adminList.get(0).get("number").asInt()).isNegative();
        // Saytda sinov mavsumi yo'q
        assertThat(read(perform(get("/api/public/seasons"), null, null))).isEmpty();

        playFirstRound(testId, List.of("Lochin", "Chinor", "Bahor", "Navbahor"), "/media/" + logoName);
        String lochin = teamId(testId, "Lochin");
        String chinor = teamId(testId, "Chinor");
        perform(get("/api/public/teams/" + lochin + "/profile"), null, null).andExpect(status().isNotFound());
        assertThat(read(perform(get("/api/public/archive"), null, null)).get("summaries")).isEmpty();
        // Futbolchi profili ham yashirin
        String player = getJson("/api/public/seasons/" + testId + "/bundle").get("rosters").get(0).get("playerId").asText();
        perform(get("/api/public/players/" + player + "/profile"), null, null).andExpect(status().isNotFound());
        // Mavsum ma'lumotlari va o'yin havolasi ham muxlislarga yopiq, tashkilotchiga ochiq
        perform(get("/api/public/seasons/" + testId + "/bundle"), null, null).andExpect(status().isNotFound());
        String testMatch = getJson("/api/public/seasons/" + testId + "/bundle").get("matches").get(0).get("id").asText();
        perform(get("/api/public/matches/" + testMatch + "/season"), null, null).andExpect(status().isNotFound());
        perform(get("/api/public/matches/" + testMatch + "/season"), null, asAdmin()).andExpect(status().isOk());

        // Haqiqiy mavsum ochiladi; sinov boshlangan ekan, uni boshlashdan oldin o'chirish so'raladi
        String realId = createSeason("1-mavsum", false);
        assertThat(getJson("/api/admin/seasons").findValues("number").stream().map(JsonNode::asInt).toList()).contains(1);
        perform(post("/api/admin/seasons/" + realId + "/activate"), null, asAdmin())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(Matchers.containsString("sinov mavsumi boshlangan")));
        // Chinor haqiqiy mavsumga ham qo'shiladi — u o'chmasligi kerak
        putJson("/api/admin/seasons/" + realId + "/teams/" + chinor, Map.of("inSeason", true));
        assertThat(read(perform(get("/api/public/seasons"), null, null))).hasSize(1);

        // Nima o'chishi oldindan ko'rsatiladi
        JsonNode preview = getJson("/api/admin/seasons/" + testId + "/delete-preview");
        assertThat(preview.get("canDelete").asBoolean()).isTrue();
        assertThat(preview.get("teams").asInt()).isEqualTo(4);
        assertThat(preview.get("teamsRemoved").asInt()).isEqualTo(3);
        assertThat(preview.get("players").asInt()).isEqualTo(16);
        assertThat(preview.get("results").asInt()).isEqualTo(2);

        // Faqat bosh tashkilotchi va faqat nomini to'g'ri yozganda
        String url = "/api/admin/seasons/" + testId + "/delete";
        perform(post(url), Map.of("name", "Sinov"), as(Role.ADMIN)).andExpect(status().isForbidden());
        perform(post(url), Map.of("name", "boshqa"), asAdmin())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(Matchers.containsString("«Sinov»")));
        JsonNode deleted = read(perform(post(url), Map.of("name", " sinov "), asAdmin()).andExpect(status().isOk()));
        assertThat(deleted.get("teams").asInt()).isEqualTo(3);
        assertThat(deleted.get("players").asInt()).isEqualTo(16);
        assertThat(deleted.get("matches").asInt()).isEqualTo(6);

        // Sinovdan hech narsa qolmadi: mavsum, o'yinlar, hodisalar, faqat shu mavsumdagi jamoalar va futbolchilar, logotip fayli
        perform(get("/api/public/seasons/" + testId + "/bundle"), null, null).andExpect(status().isNotFound());
        assertThat(getJson("/api/admin/seasons")).hasSize(1);
        assertThat(count("matches")).isZero();
        assertThat(count("match_events")).isZero();
        assertThat(count("league_groups")).isZero();
        assertThat(count("season_rosters")).isZero();
        assertThat(count("players")).isZero();
        assertThat(sql.queryForList("select name from teams", String.class)).containsExactly("Chinor");
        assertThat(Files.exists(media.resolve(logoName))).isFalse();
        // Tarixda sinov yozuvlari o'rniga bitta umumiy yozuv
        assertThat(sql.queryForObject("select count(*) from audit_logs where entity_id = ?", Integer.class, UUID.fromString(testId))).isZero();
        assertThat(sql.queryForObject("select count(*) from audit_logs where summary like '%sinov mavsumi butunlay o‘chirildi%'", Integer.class)).isEqualTo(1);

        // Endi haqiqiy mavsum boshlanadi
        postJson("/api/admin/seasons/" + realId + "/activate", null);
        assertThat(read(perform(get("/api/public/seasons"), null, null)).get(0).get("status").asText()).isEqualTo("ACTIVE");
    }

    @Test
    @DisplayName("haqiqiy mavsum: natija kiritilgach o'chirib bo'lmaydi, xato ochilgan bo'sh mavsumni o'chirish mumkin")
    void realSeasonIsProtected() throws Exception {
        String played = createSeason("Asosiy", false);
        playFirstRound(played, List.of("Lochin", "Chinor", "Bahor", "Navbahor"), null);
        JsonNode preview = getJson("/api/admin/seasons/" + played + "/delete-preview");
        assertThat(preview.get("canDelete").asBoolean()).isFalse();
        assertThat(preview.get("problem").asText()).contains("o‘yin natijalari bor");
        perform(post("/api/admin/seasons/" + played + "/delete"), Map.of("name", "Asosiy"), asAdmin()).andExpect(status().isConflict());
        assertThat(count("matches")).isEqualTo(6);

        // Xato ochilgan mavsum (natijasiz) o'chadi; avvalgi mavsum jamoalari saqlanadi
        String mistake = createSeason("Xato mavsum", false);
        putJson("/api/admin/seasons/" + mistake + "/teams/" + teamId(played, "Lochin"), Map.of("inSeason", true));
        perform(post("/api/admin/seasons/" + mistake + "/delete"), Map.of("name", "Xato mavsum"), asAdmin()).andExpect(status().isOk());
        assertThat(getJson("/api/admin/seasons")).hasSize(1);
        assertThat(count("teams")).isEqualTo(4);
        assertThat(count("players")).isEqualTo(16);
    }
}
