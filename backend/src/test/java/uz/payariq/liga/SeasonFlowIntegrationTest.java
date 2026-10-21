package uz.payariq.liga;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

/**
 * To'liq jarayon: mavsum ochish → jamoalar → futbolchilar → qur'a → taqvim → natijalar →
 * jadval → natijani tahrirlash → pley-off → final → mavsumni yakunlash → arxiv qulfi.
 */
class SeasonFlowIntegrationTest extends IntegrationTestBase {

    private String seasonId;
    private final List<String> seasonTeams = new ArrayList<>();
    private final Map<String, String> firstPlayerOf = new HashMap<>();

    private static Map<String, Object> rules() {
        return Map.of("pointsWin", 3, "pointsDraw", 1, "pointsLoss", 0,
                "tiebreakers", List.of("H2H_POINTS", "H2H_GOAL_DIFF", "GOAL_DIFF", "GOALS_FOR", "FAIR_PLAY"),
                "legs", 1, "qualifiersPerGroup", 2, "thirdPlaceMatch", true);
    }

    private Map<String, Object> result(String status, int hs, int as, List<Map<String, Object>> events) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("status", status);
        r.put("homeScore", hs);
        r.put("awayScore", as);
        r.put("events", events);
        return r;
    }

    private List<Map<String, Object>> goals(String team, int count) {
        List<Map<String, Object>> list = new ArrayList<>();
        for (int i = 0; i < count; i++) list.add(Map.of("type", "GOAL", "seasonTeamId", team, "playerId", firstPlayerOf.get(team)));
        return list;
    }

    private List<Map<String, Object>> goals(String home, int hs, String away, int as) {
        List<Map<String, Object>> list = new ArrayList<>(goals(home, hs));
        list.addAll(goals(away, as));
        return list;
    }

    private JsonNode bundle() throws Exception {
        return getJson("/api/public/seasons/" + seasonId + "/bundle");
    }

    private List<JsonNode> playoffMatches() throws Exception {
        List<JsonNode> list = new ArrayList<>();
        for (JsonNode m : bundle().get("matches")) if ("PLAYOFF".equals(m.get("stage").asText())) list.add(m);
        return list;
    }

    private void setUpSeasonWithGroups() throws Exception {
        JsonNode season = postJson("/api/admin/seasons", Map.of("name", "1-mavsum", "year", 2026, "startDate", "2026-05-01", "endDate", "2026-07-31", "rules", rules()));
        seasonId = season.get("id").asText();
        assertThat(postJson("/api/admin/seasons/" + seasonId + "/activate", null).get("status").asText()).isEqualTo("ACTIVE");

        String letters = "ABCDEFGH";
        for (int i = 0; i < 8; i++) {
            char c = letters.charAt(i);
            postJson("/api/admin/teams?addToSeasonId=" + seasonId, Map.of("name", "Jamoa " + c, "shortName", "J" + c, "village", "Qishloq " + c,
                    "primaryColor", "#145A3A", "secondaryColor", "#E2BF4F"));
        }
        for (JsonNode row : getJson("/api/admin/seasons/" + seasonId + "/teams")) {
            if (row.get("inSeason").asBoolean()) seasonTeams.add(row.get("seasonTeamId").asText());
        }
        assertThat(seasonTeams).hasSize(8);

        int n = 0;
        for (String st : seasonTeams) {
            for (int k = 1; k <= 2; k++) {
                n++;
                perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/admin/seasons/" + seasonId + "/players"),
                        Map.of("firstName", "Futbolchi", "lastName", "Raqam" + n, "position", "FW", "seasonTeamId", st, "number", k,
                                "phone", "+998 90 123 45 6" + (n % 10)), asAdmin())
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.id").isNotEmpty());
            }
        }
        for (JsonNode r : bundle().get("rosters")) firstPlayerOf.putIfAbsent(r.get("seasonTeamId").asText(), r.get("playerId").asText());

        putJson("/api/admin/seasons/" + seasonId + "/groups", Map.of("groups", List.of(
                Map.of("name", "A", "teamIds", seasonTeams.subList(0, 4)),
                Map.of("name", "B", "teamIds", seasonTeams.subList(4, 8)))));
        // Qur'a saqlanishi bilan juftliklar o'zi tuziladi — sanalari hali belgilanmagan
        JsonNode drawn = bundle();
        assertThat(drawn.get("matches")).hasSize(12);
        drawn.get("matches").forEach(m -> {
            assertThat(m.get("timeConfirmed").asBoolean()).isFalse();
            assertThat(m.get("round").asInt()).isBetween(1, 3);
        });
        // Sanasi belgilanmagan o'yinga natija kiritilmaydi
        JsonNode undated = drawn.get("matches").get(0);
        perform(put("/api/admin/matches/" + undated.get("id").asText() + "/result"),
                result("FINISHED", 1, 0, goals(undated.get("homeId").asText(), 1)), asAdmin())
                .andExpect(status().isBadRequest());
        // Juftliklar allaqachon bor — qayta tuzish so'ralsa rad etiladi
        perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/admin/seasons/" + seasonId + "/fixtures"), null, asAdmin())
                .andExpect(status().isConflict());
        // Tashkilotchi har bir o'yinga sana va vaqt qo'yadi
        assertThat(scheduleUndated(drawn, java.time.LocalDate.of(2026, 5, 2))).isEqualTo(12);
        bundle().get("matches").forEach(m -> assertThat(m.get("timeConfirmed").asBoolean()).isTrue());
    }

    @Test
    @DisplayName("jamoa qo'shishdan chempionni aniqlashgacha to'liq jarayon")
    void fullSeason() throws Exception {
        setUpSeasonWithGroups();

        // Guruh o'yinlari: uy jamoasi 1:0 yutadi
        for (JsonNode m : bundle().get("matches")) {
            String home = m.get("homeId").asText();
            putJson("/api/admin/matches/" + m.get("id").asText() + "/result", result("FINISHED", 1, 0, goals(home, 1)));
        }
        JsonNode b = bundle();
        for (JsonNode rows : b.get("standings")) {
            int total = 0;
            for (JsonNode row : rows) {
                assertThat(row.get("played").asInt()).isEqualTo(3);
                total += row.get("points").asInt();
            }
            assertThat(total).as("har guruhda 6 ta o‘yin × 3 ochko").isEqualTo(18);
        }
        int goalsFromStats = 0;
        for (JsonNode s : b.get("playerStats")) goalsFromStats += s.get("goals").asInt();
        assertThat(goalsFromStats).isEqualTo(12);

        // Natijani durangga o'zgartirish: ochkolar qayta hisoblanadi, o'yin ikki marta qo'shilmaydi
        JsonNode first = b.get("matches").get(0);
        String home = first.get("homeId").asText();
        String away = first.get("awayId").asText();
        putJson("/api/admin/matches/" + first.get("id").asText() + "/result", result("FINISHED", 2, 2, goals(home, 2, away, 2)));
        JsonNode groupA = bundle().get("standings").get(first.get("groupId").asText());
        int total = 0;
        for (JsonNode row : groupA) {
            assertThat(row.get("played").asInt()).isEqualTo(3);
            total += row.get("points").asInt();
        }
        assertThat(total).isEqualTo(17);

        // Pley-off guruh bosqichi tugashi bilan o'zi tuzildi: 4 ta jamoa — 2 yarim final, final va 3-o'rin o'yini.
        // Sana-vaqt hali tasdiqlanmagan; qo'lda qayta yaratib bo'lmaydi
        // B guruhida uch jamoa barcha mezonlar bo'yicha teng (aylanma natijalar) — 2 o'rin uchun qur'a kerak, setka kutadi
        assertThat(playoffMatches()).isEmpty();
        String tiedGroup = null;
        List<String> tied = new ArrayList<>();
        var standings = bundle().get("standings").properties();
        for (var entry : standings) {
            for (JsonNode row : entry.getValue()) {
                if (row.get("unresolvedTie").asBoolean()) {
                    tiedGroup = entry.getKey();
                    tied.add(row.get("seasonTeamId").asText());
                }
            }
        }
        assertThat(tied).hasSize(3);
        perform(post("/api/admin/seasons/" + seasonId + "/lots"), Map.of("scope", "GROUP:" + tiedGroup, "seasonTeamIds", tied, "random", true), asAdmin())
                .andExpect(status().isNoContent());
        // Qur'adan keyin teng belgisi yo'qoladi va setka o'zi tuziladi
        for (JsonNode row : bundle().get("standings").get(tiedGroup)) assertThat(row.get("unresolvedTie").asBoolean()).isFalse();
        List<JsonNode> auto = playoffMatches();
        assertThat(auto).hasSize(4);
        assertThat(auto).allMatch(m -> !m.get("timeConfirmed").asBoolean());
        perform(post("/api/admin/seasons/" + seasonId + "/playoff"), Map.of("thirdPlace", true, "startDate", "2026-06-01"), asAdmin())
                .andExpect(status().isConflict());
        // Tashkilotchi pley-off o'yinlariga sana va vaqt qo'yadi — shundan keyingina natija kiritiladi
        assertThat(scheduleUndated(bundle(), java.time.LocalDate.of(2026, 6, 1))).isEqualTo(4);
        Map<String, JsonNode> playoff = new HashMap<>();
        List<JsonNode> semis = new ArrayList<>();
        for (JsonNode m : bundle().get("matches")) {
            if (!"PLAYOFF".equals(m.get("stage").asText())) continue;
            if ("SF".equals(m.get("playoffRound").asText())) semis.add(m);
            else playoff.put(m.get("playoffRound").asText(), m);
        }
        semis.sort((x, y) -> Integer.compare(x.get("bracketIndex").asInt(), y.get("bracketIndex").asInt()));
        JsonNode sf1 = semis.get(0);
        JsonNode sf2 = semis.get(1);

        // Pley-offda durang qo'shimcha vaqt/penaltisiz qabul qilinmaydi
        perform(put("/api/admin/matches/" + sf2.get("id").asText() + "/result"),
                result("FINISHED", 1, 1, goals(sf2.get("homeId").asText(), 1, sf2.get("awayId").asText(), 1)), asAdmin())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Qo‘shimcha vaqt")));

        putJson("/api/admin/matches/" + sf1.get("id").asText() + "/result",
                result("FINISHED", 2, 1, goals(sf1.get("homeId").asText(), 2, sf1.get("awayId").asText(), 1)));
        Map<String, Object> pens = result("FINISHED", 1, 1, goals(sf2.get("homeId").asText(), 1, sf2.get("awayId").asText(), 1));
        pens.put("homeExtra", 0);
        pens.put("awayExtra", 0);
        pens.put("homePens", 2);
        pens.put("awayPens", 4);
        putJson("/api/admin/matches/" + sf2.get("id").asText() + "/result", pens);

        // G'oliblar finalga, mag'lublar 3-o'rin o'yiniga avtomatik o'tdi
        JsonNode fin = null;
        JsonNode third = null;
        for (JsonNode m : bundle().get("matches")) {
            if ("F".equals(m.path("playoffRound").asText())) fin = m;
            if ("THIRD".equals(m.path("playoffRound").asText())) third = m;
        }
        assertThat(fin.get("homeId").asText()).isEqualTo(sf1.get("homeId").asText());
        assertThat(fin.get("awayId").asText()).isEqualTo(sf2.get("awayId").asText());
        assertThat(third.get("homeId").asText()).isEqualTo(sf1.get("awayId").asText());
        assertThat(third.get("awayId").asText()).isEqualTo(sf2.get("homeId").asText());

        putJson("/api/admin/matches/" + third.get("id").asText() + "/result", result("FINISHED", 1, 0, goals(third.get("homeId").asText(), 1)));
        Map<String, Object> finalResult = result("FINISHED", 0, 0, goals(fin.get("awayId").asText(), 1));
        finalResult.put("homeExtra", 0);
        finalResult.put("awayExtra", 1);
        putJson("/api/admin/matches/" + fin.get("id").asText() + "/result", finalResult);

        // Mavsumni yakunlash: chempion — final g'olibi, mavsum arxivga qulflanadi
        JsonNode preview = getJson("/api/admin/seasons/" + seasonId + "/finish-preview");
        assertThat(preview.get("canFinish").asBoolean()).isTrue();
        assertThat(preview.get("champion").get("id").asText()).isEqualTo(fin.get("awayId").asText());
        assertThat(postJson("/api/admin/seasons/" + seasonId + "/finish", null).get("status").asText()).isEqualTo("FINISHED");

        JsonNode archive = mvcGetPublic("/api/public/archive");
        JsonNode summary = archive.get("summaries").get(0);
        assertThat(summary.get("champion").get("id").asText()).isEqualTo(fin.get("awayId").asText());
        assertThat(summary.get("final").get("decidedBy").asText()).isEqualTo("EXTRA_TIME");

        perform(put("/api/admin/matches/" + fin.get("id").asText() + "/result"), result("FINISHED", 0, 0, List.of()), asAdmin())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("arxivga qulflangan")));
    }

    @Test
    @DisplayName("hisob va gol mualliflari mos kelmasa natija saqlanmaydi")
    void rejectsMismatchedGoals() throws Exception {
        setUpSeasonWithGroups();
        JsonNode m = bundle().get("matches").get(0);
        perform(put("/api/admin/matches/" + m.get("id").asText() + "/result"), result("FINISHED", 3, 0, goals(m.get("homeId").asText(), 1)), asAdmin())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("hisobda 3 ta gol, kiritilgan gollar esa 1 ta")));
        assertThat(bundle().get("matches").get(0).get("status").asText()).isEqualTo("SCHEDULED");
    }

    @Test
    @DisplayName("ommaviy API futbolchilarning telefon raqamini qaytarmaydi")
    void publicBundleHidesPhones() throws Exception {
        setUpSeasonWithGroups();
        String body = mvc.perform(get("/api/public/seasons/" + seasonId + "/bundle")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain("phone").doesNotContain("+998");
        String admin = mvc.perform(get("/api/admin/seasons/" + seasonId + "/players").with(asAdmin())).andReturn().getResponse().getContentAsString();
        assertThat(admin).contains("+998");
    }

    @Test
    @DisplayName("o'yinlari bor jamoani o'chirib bo'lmaydi, qur'ani o'yin boshlangach o'zgartirib bo'lmaydi")
    void protectsHistory() throws Exception {
        setUpSeasonWithGroups();
        JsonNode m = bundle().get("matches").get(0);
        putJson("/api/admin/matches/" + m.get("id").asText() + "/result", result("FINISHED", 1, 0, goals(m.get("homeId").asText(), 1)));
        String teamId = null;
        for (JsonNode t : bundle().get("teams")) if (t.get("id").asText().equals(m.get("homeId").asText())) teamId = t.get("teamId").asText();
        doDelete("/api/admin/teams/" + teamId).andExpect(status().isConflict());
        perform(put("/api/admin/seasons/" + seasonId + "/groups"), Map.of("groups", List.of(Map.of("name", "A", "teamIds", seasonTeams))), asAdmin())
                .andExpect(status().isConflict());
        // Natija kiritilgach qur'ani bekor qilib ham bo'lmaydi
        doDelete("/api/admin/seasons/" + seasonId + "/groups").andExpect(status().isConflict());
        assertThat(bundle().get("groups")).hasSize(2);
    }

    @Test
    @DisplayName("bir davrali guruhda juftlik ikkinchi marta qo'shilmaydi (qo'lda qo'shish va tahrirlashda ham); bekor qilingan o'yin o'rniga qo'shish mumkin")
    void noDuplicatePairsInGroup() throws Exception {
        setUpSeasonWithGroups();
        JsonNode b = bundle();
        JsonNode first = b.get("matches").get(0);
        Map<String, Object> again = new java.util.HashMap<>(Map.of("stage", "GROUP", "groupId", first.get("groupId").asText(), "round", 4,
                "homeId", first.get("awayId").asText(), "awayId", first.get("homeId").asText(), "kickoff", "2026-06-20T18:00:00+05:00", "status", "SCHEDULED"));
        var create = org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/admin/seasons/" + seasonId + "/matches");
        perform(create, again, asAdmin())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("allaqachon bir marta o‘ynaydi")));

        // Boshqa o'yinning jamoalarini shu juftlikka o'zgartirib ham bo'lmaydi
        JsonNode other = null;
        for (JsonNode m : b.get("matches")) {
            if (m.get("groupId").asText().equals(first.get("groupId").asText()) && !m.get("id").asText().equals(first.get("id").asText())) other = m;
        }
        Map<String, Object> edit = new java.util.HashMap<>(again);
        edit.put("round", other.get("round").asInt());
        perform(put("/api/admin/matches/" + other.get("id").asText()), edit, asAdmin()).andExpect(status().isConflict());
        // Juftlikning yagona o'yinini o'chirib bo'lmaydi — aks holda jamoalar o'zaro o'ynamay qoladi
        doDelete("/api/admin/matches/" + other.get("id").asText())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Bekor qilingan")));

        // O'yinni o'zini tahrirlash (sana o'zgarishi) — takror hisoblanmaydi
        Map<String, Object> self = new java.util.HashMap<>(again);
        self.put("homeId", first.get("homeId").asText());
        self.put("awayId", first.get("awayId").asText());
        self.put("round", first.get("round").asInt());
        perform(put("/api/admin/matches/" + first.get("id").asText()), self, asAdmin()).andExpect(status().isOk());

        // Bekor qilingan o'yin o'rniga yangisi qo'shiladi
        self.put("status", "CANCELLED");
        perform(put("/api/admin/matches/" + first.get("id").asText()), self, asAdmin()).andExpect(status().isOk());
        perform(create, again, asAdmin()).andExpect(status().isOk());
        assertThat(bundle().get("matches")).hasSize(13);
    }

    @Test
    @DisplayName("qur'adan keyin mavsumga jamoa qo'shib yoki chiqarib bo'lmaydi; natija yo'q bo'lsa qur'ani bekor qilib, jamoa qo'shiladi")
    void teamListLockedAfterDraw() throws Exception {
        setUpSeasonWithGroups();
        Map<String, Object> late = Map.of("name", "Kechikkan jamoa", "shortName", "KEC", "village", "Qishloq", "primaryColor", "#145A3A", "secondaryColor", "#E2BF4F");
        var post = org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/admin/teams?addToSeasonId=" + seasonId);
        perform(post, late, asAdmin())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Qur’a tashlangan")));
        // Mavsumga qo'shilmagan jamoa yaratilmaydi ham (yarim yo'lda qolmaydi)
        assertThat(getJson("/api/admin/seasons/" + seasonId + "/teams")).hasSize(8);

        // Keyingi mavsum uchun ro'yxatga saqlash mumkin, lekin bu mavsumga qo'shib bo'lmaydi
        String lateId = postJson("/api/admin/teams", late).get("id").asText();
        perform(put("/api/admin/seasons/" + seasonId + "/teams/" + lateId), Map.of("inSeason", true), asAdmin()).andExpect(status().isConflict());
        String member = bundle().get("teams").get(0).get("teamId").asText();
        perform(put("/api/admin/seasons/" + seasonId + "/teams/" + member), Map.of("inSeason", false), asAdmin()).andExpect(status().isConflict());

        // Qur'ani bekor qilish: guruhlar va juftliklar (sanalari bilan) o'chadi, jamoalar mavsumda qoladi
        doDelete("/api/admin/seasons/" + seasonId + "/groups").andExpect(status().isNoContent());
        JsonNode reset = bundle();
        assertThat(reset.get("groups")).isEmpty();
        assertThat(reset.get("matches")).isEmpty();
        assertThat(reset.get("teams")).hasSize(8);
        // Endi esdan chiqqan jamoa qo'shiladi va qur'a qaytadan tashlanadi
        perform(put("/api/admin/seasons/" + seasonId + "/teams/" + lateId), Map.of("inSeason", true), asAdmin()).andExpect(status().is2xxSuccessful());
        assertThat(bundle().get("teams")).hasSize(9);
        doDelete("/api/admin/seasons/" + seasonId + "/groups").andExpect(status().isConflict());
    }

    private JsonNode mvcGetPublic(String url) throws Exception {
        return json.readTree(mvc.perform(get(url)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }
}
