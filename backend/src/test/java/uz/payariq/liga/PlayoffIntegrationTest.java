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
import org.hamcrest.Matchers;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

/**
 * Moslashuvchan format: 5 jamoali guruhdan 3 ta, 4 jamoalidan 2 ta chiqadi → 5 jamoa → saralash o'yini + yarim final.
 * Setka guruh bosqichi tugashi bilan o'zi tuziladi, natija tuzatilsa yangilanadi, pley-off boshlangach qotadi.
 */
class PlayoffIntegrationTest extends IntegrationTestBase {

    private String seasonId;
    /** Guruh nomi → jamoalar (kuchlidan kuchsizga) */
    private final Map<String, List<String>> groupTeams = new LinkedHashMap<>();
    private final Map<String, String> playerOf = new HashMap<>();

    private JsonNode bundle() throws Exception {
        return getJson("/api/public/seasons/" + seasonId + "/bundle");
    }

    private List<JsonNode> playoff() throws Exception {
        List<JsonNode> list = new ArrayList<>();
        for (JsonNode m : bundle().get("matches")) if ("PLAYOFF".equals(m.get("stage").asText())) list.add(m);
        return list;
    }

    private JsonNode round(String r) throws Exception {
        return playoff().stream().filter(m -> r.equals(m.get("playoffRound").asText())).findFirst().orElseThrow();
    }

    private Map<String, Object> result(String home, int hs, String away, int as) {
        List<Map<String, Object>> events = new ArrayList<>();
        for (int i = 0; i < hs; i++) events.add(Map.of("type", "GOAL", "seasonTeamId", home, "playerId", playerOf.get(home)));
        for (int i = 0; i < as; i++) events.add(Map.of("type", "GOAL", "seasonTeamId", away, "playerId", playerOf.get(away)));
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("status", "FINISHED");
        r.put("homeScore", hs);
        r.put("awayScore", as);
        r.put("events", events);
        return r;
    }

    /** Ro'yxatda oldinroq turgan jamoa farq bilan yutadi — jadvalda teng holat bo'lmaydi */
    private void playGroupStage() throws Exception {
        for (JsonNode m : bundle().get("matches")) {
            if (!"GROUP".equals(m.get("stage").asText())) continue;
            playGroupMatch(m, null);
        }
    }

    private void playGroupMatch(JsonNode m, String forcedWinner) throws Exception {
        putJson("/api/admin/matches/" + m.get("id").asText() + "/result", groupResult(m, forcedWinner));
    }

    private Map<String, Object> groupResult(JsonNode m, String forcedWinner) {
        String home = m.get("homeId").asText();
        String away = m.get("awayId").asText();
        List<String> order = groupTeams.values().stream().filter(l -> l.contains(home)).findFirst().orElseThrow();
        int diff = Math.abs(order.indexOf(home) - order.indexOf(away));
        boolean homeWins = forcedWinner != null ? forcedWinner.equals(home) : order.indexOf(home) < order.indexOf(away);
        return homeWins ? result(home, diff, away, 0) : result(home, 0, away, diff);
    }

    private JsonNode groupMatch(String a, String b) throws Exception {
        for (JsonNode m : bundle().get("matches")) {
            if ("GROUP".equals(m.get("stage").asText()) && List.of(a, b).contains(m.get("homeId").asText()) && List.of(a, b).contains(m.get("awayId").asText())) return m;
        }
        throw new AssertionError("o'yin topilmadi");
    }

    private void setUp() throws Exception {
        Map<String, Object> rules = Map.of("pointsWin", 3, "pointsDraw", 1, "pointsLoss", 0,
                "tiebreakers", List.of("H2H_POINTS", "H2H_GOAL_DIFF", "GOAL_DIFF", "GOALS_FOR", "FAIR_PLAY"),
                "legs", 1, "qualifiersPerGroup", 2, "qualifiersBySize", Map.of(4, 2, 5, 3), "thirdPlaceMatch", true);
        seasonId = postJson("/api/admin/seasons", Map.of("name", "2-mavsum", "year", 2027, "startDate", "2027-05-01", "endDate", "2027-08-31", "rules", rules))
                .get("id").asText();
        postJson("/api/admin/seasons/" + seasonId + "/activate", null);
        for (int i = 0; i < 9; i++) {
            postJson("/api/admin/teams?addToSeasonId=" + seasonId, Map.of("name", "Jamoa " + (i + 1), "shortName", "J" + (char) ('A' + i), "village", "Qishloq",
                    "primaryColor", "#145A3A", "secondaryColor", "#E2BF4F"));
        }
        List<String> ids = new ArrayList<>();
        for (JsonNode row : getJson("/api/admin/seasons/" + seasonId + "/teams")) if (row.get("inSeason").asBoolean()) ids.add(row.get("seasonTeamId").asText());
        // Futbolchilar ro'yxat bilan birdaniga qo'shiladi
        for (String st : ids) {
            JsonNode created = postJson("/api/admin/seasons/" + seasonId + "/players/bulk", Map.of("seasonTeamId", st, "players", List.of(
                    Map.of("firstName", "Ali", "lastName", "Valiyev", "number", 9),
                    Map.of("firstName", "Vali", "lastName", "Aliyev", "number", 1, "position", "GK"))));
            assertThat(created.get("created").asInt()).isEqualTo(2);
        }
        for (JsonNode r : bundle().get("rosters")) if (r.get("number").asInt() == 9) playerOf.put(r.get("seasonTeamId").asText(), r.get("playerId").asText());
        groupTeams.put("A", ids.subList(0, 5));
        groupTeams.put("B", ids.subList(5, 9));
        putJson("/api/admin/seasons/" + seasonId + "/groups", Map.of("groups", List.of(
                Map.of("name", "A", "teamIds", groupTeams.get("A")), Map.of("name", "B", "teamIds", groupTeams.get("B")))));
        // Qur'adan keyin juftliklar o'zi tuziladi (5 jamoali — 10, 4 jamoali — 6), sanani tashkilotchi qo'yadi
        assertThat(scheduleUndated(bundle(), java.time.LocalDate.of(2027, 5, 1))).isEqualTo(16);
    }

    @Test
    @DisplayName("5 va 4 jamoali guruhlar: 5 jamoa chiqadi, saralash o'yini bilan setka o'zi tuziladi")
    void autoBracketWithPlayIn() throws Exception {
        setUp();
        assertThat(playoff()).isEmpty();
        playGroupStage();

        List<JsonNode> matches = playoff();
        // Saralash (1) + yarim final (2) + final + 3-o'rin
        assertThat(matches).hasSize(5);
        assertThat(matches).allMatch(m -> !m.get("timeConfirmed").asBoolean());
        JsonNode playIn = round("QF");
        // Reyting: A1, B1, A2, B2, A3 → saralashda B2 va A3 (bitta guruhdan emas)
        assertThat(playIn.get("homeId").asText()).isEqualTo(groupTeams.get("B").get(1));
        assertThat(playIn.get("awayId").asText()).isEqualTo(groupTeams.get("A").get(2));
        List<JsonNode> semis = matches.stream().filter(m -> "SF".equals(m.get("playoffRound").asText()))
                .sorted((x, y) -> Integer.compare(x.get("bracketIndex").asInt(), y.get("bracketIndex").asInt())).toList();
        assertThat(semis.get(0).get("homeId").asText()).isEqualTo(groupTeams.get("A").get(0));
        assertThat(semis.get(0).get("awayId").isNull()).isTrue();
        assertThat(semis.get(1).get("homeId").asText()).isEqualTo(groupTeams.get("B").get(0));
        assertThat(semis.get(1).get("awayId").asText()).isEqualTo(groupTeams.get("A").get(1));
        assertThat(playIn.get("nextMatchId").asText()).isEqualTo(semis.get(0).get("id").asText());
    }

    @Test
    @DisplayName("sana belgilanadi; guruh natijasi tuzatilsa setka yangilanadi va sanalar saqlanadi; pley-off boshlangach setka qotadi")
    void scheduleRebuildAndFreeze() throws Exception {
        setUp();
        playGroupStage();
        String finalId = round("F").get("id").asText();
        perform(put("/api/admin/matches/" + finalId + "/schedule"), Map.of("kickoff", "2027-07-10T17:30:00+05:00"), asAdmin())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.timeConfirmed").value(true));

        // B guruhida 2-jamoa 1-jamoani yutgan deb tuzatiladi: B1 va B2 o'rin almashadi
        String b1 = groupTeams.get("B").get(0);
        String b2 = groupTeams.get("B").get(1);
        JsonNode bMatch = null;
        for (JsonNode m : bundle().get("matches")) {
            if ("GROUP".equals(m.get("stage").asText()) && List.of(b1, b2).contains(m.get("homeId").asText()) && List.of(b1, b2).contains(m.get("awayId").asText())) bMatch = m;
        }
        playGroupMatch(bMatch, b2);
        JsonNode fin = round("F");
        assertThat(fin.get("kickoff").asText()).startsWith("2027-07-10T12:30");
        assertThat(fin.get("timeConfirmed").asBoolean()).isTrue();
        assertThat(round("QF").get("homeId").asText()).as("endi B1 saralash o'ynaydi").isEqualTo(b1);

        // Saralash o'yini o'tkazildi — pley-off boshlandi: juftliklarni o'zgartiradigan guruh tuzatishi rad etiladi
        scheduleUndated(bundle(), java.time.LocalDate.of(2027, 7, 1));
        JsonNode playIn = round("QF");
        putJson("/api/admin/matches/" + playIn.get("id").asText() + "/result", result(playIn.get("homeId").asText(), 2, playIn.get("awayId").asText(), 0));
        perform(put("/api/admin/matches/" + bMatch.get("id").asText() + "/result"), groupResult(bMatch, b1), asAdmin())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(Matchers.containsString("Pley-off allaqachon boshlangan")));
        assertThat(groupMatch(b1, b2).get("winnerId").asText()).as("rad etilgan natija saqlanmadi").isEqualTo(b2);
        assertThat(round("QF").get("homeId").asText()).isEqualTo(b1);
        assertThat(round("QF").get("status").asText()).isEqualTo("FINISHED");

        // Juftliklarga ta'sir qilmaydigan tuzatish (A guruhida 4- va 5-o'rin) qabul qilinadi
        String a4 = groupTeams.get("A").get(3);
        String a5 = groupTeams.get("A").get(4);
        perform(put("/api/admin/matches/" + groupMatch(a4, a5).get("id").asText() + "/result"), groupResult(groupMatch(a4, a5), a5), asAdmin())
                .andExpect(status().isOk());
        assertThat(groupMatch(a4, a5).get("winnerId").asText()).isEqualTo(a5);
    }

    @Test
    @DisplayName("eskirgan forma: boshqa joyda o'zgargan natija ustidan yozilmaydi; versiyasiz (bot) saqlash ishlaydi")
    void staleResultRejected() throws Exception {
        setUp();
        String a1 = groupTeams.get("A").get(0);
        String a2 = groupTeams.get("A").get(1);
        JsonNode m = groupMatch(a1, a2);
        String url = "/api/admin/matches/" + m.get("id").asText() + "/result";
        int opened = m.get("version").asInt();

        // Forma ochilgan versiya bilan saqlanadi — javobda yangi versiya
        Map<String, Object> first = new HashMap<>(result(m.get("homeId").asText(), 1, m.get("awayId").asText(), 0));
        first.put("version", opened);
        int saved = read(perform(put(url), first, asAdmin()).andExpect(status().isOk())).get("version").asInt();
        assertThat(saved).isGreaterThan(opened);
        assertThat(groupMatch(a1, a2).get("version").asInt()).isEqualTo(saved);

        // Faqat kartochka qo'shilsa ham versiya oshadi
        Map<String, Object> withCard = new HashMap<>(first);
        List<Object> events = new ArrayList<>((List<?>) first.get("events"));
        events.add(Map.of("type", "YELLOW", "seasonTeamId", m.get("awayId").asText(), "playerId", playerOf.get(m.get("awayId").asText()), "minute", 30));
        withCard.put("events", events);
        withCard.put("version", saved);
        int afterCard = read(perform(put(url), withCard, asAdmin()).andExpect(status().isOk())).get("version").asInt();
        assertThat(afterCard).isGreaterThan(saved);

        // Eski versiyadagi forma rad etiladi, ma'lumot o'zgarmaydi
        Map<String, Object> stale = new HashMap<>(result(m.get("homeId").asText(), 3, m.get("awayId").asText(), 0));
        stale.put("version", saved);
        perform(put(url), stale, asAdmin())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(Matchers.containsString("boshqa joyda o‘zgartirildi")));
        assertThat(groupMatch(a1, a2).get("homeScore").asInt()).isEqualTo(1);

        // Versiyasiz saqlash (Telegram bot, eski mijozlar) avvalgidek ishlaydi
        perform(put(url), result(m.get("homeId").asText(), 2, m.get("awayId").asText(), 0), asAdmin()).andExpect(status().isOk());
        assertThat(groupMatch(a1, a2).get("homeScore").asInt()).isEqualTo(2);
    }

    @Test
    @DisplayName("texnik mag'lubiyat: hisob 3:0, kartochkalar saqlanadi")
    void forfeitKeepsCards() throws Exception {
        setUp();
        JsonNode m = groupMatch(groupTeams.get("B").get(0), groupTeams.get("B").get(1));
        String away = m.get("awayId").asText();
        Map<String, Object> forfeit = new LinkedHashMap<>();
        forfeit.put("status", "FINISHED");
        forfeit.put("forfeitLoser", "away");
        forfeit.put("events", List.of(
                Map.of("type", "GOAL", "seasonTeamId", m.get("homeId").asText(), "playerId", playerOf.get(m.get("homeId").asText())),
                Map.of("type", "RED", "seasonTeamId", away, "playerId", playerOf.get(away), "minute", 35)));
        perform(put("/api/admin/matches/" + m.get("id").asText() + "/result"), forfeit, asAdmin()).andExpect(status().isOk());

        JsonNode saved = groupMatch(groupTeams.get("B").get(0), groupTeams.get("B").get(1));
        assertThat(saved.get("decidedBy").asText()).isEqualTo("FORFEIT");
        assertThat(saved.get("homeScore").asInt()).isEqualTo(3);
        List<String> types = new ArrayList<>();
        for (JsonNode e : bundle().get("events")) if (e.get("matchId").asText().equals(m.get("id").asText())) types.add(e.get("type").asText());
        assertThat(types).containsExactly("RED");
    }

    @Test
    @DisplayName("muxlislar keshi: tashkilotchi o'zgarishi saytda darhol ko'rinadi")
    void publicCacheEvictedOnChange() throws Exception {
        setUp();
        String url = "/api/public/seasons/" + seasonId + "/bundle";
        JsonNode team = read(perform(get(url), null, null).andExpect(status().isOk())).get("teams").get(0);
        putJson("/api/admin/teams/" + team.get("teamId").asText(), Map.of("name", "Yangi nomli jamoa", "shortName", team.get("shortName").asText(),
                "village", team.get("village").asText(), "primaryColor", team.get("primaryColor").asText(), "secondaryColor", team.get("secondaryColor").asText()));
        assertThat(read(perform(get(url), null, null)).get("teams").findValuesAsString("name")).contains("Yangi nomli jamoa");

        // O'zgarmagan ma'lumot qayta yuklanmaydi: 304
        String etag = perform(get(url), null, null).andReturn().getResponse().getHeader("ETag");
        assertThat(etag).isNotBlank();
        mvc.perform(get(url).header("If-None-Match", etag)).andExpect(status().isNotModified());
    }

    @Test
    @DisplayName("o'yin havolasi: o'yin qaysi mavsumga tegishli ekani ommaviy API'da")
    void matchSeasonLookup() throws Exception {
        setUp();
        JsonNode m = bundle().get("matches").get(0);
        perform(get("/api/public/matches/" + m.get("id").asText() + "/season"), null, null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seasonId").value(seasonId));
        perform(get("/api/public/matches/00000000-0000-0000-0000-000000000000/season"), null, null).andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("nizom: guruh hajmi bo'yicha chiqadiganlar soni tekshiriladi")
    void rulesValidation() throws Exception {
        setUp();
        Map<String, Object> bad = new HashMap<>(Map.of("pointsWin", 3, "pointsDraw", 1, "pointsLoss", 0, "tiebreakers", List.of("GOAL_DIFF"),
                "legs", 1, "qualifiersPerGroup", 2, "qualifiersBySize", Map.of(4, 4), "thirdPlaceMatch", true));
        perform(put("/api/admin/seasons/" + seasonId + "/rules"), bad, asAdmin())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("4 jamoali guruhdan 1 tadan 3 tagacha jamoa chiqishi mumkin."));
        assertThat(bundle().get("season").get("rules").get("qualifiersBySize").get("5").asInt()).isEqualTo(3);
    }

    @Test
    @DisplayName("futbolchilar ro'yxati: takror va band raqamlar qator raqami bilan aytiladi")
    void bulkPlayersValidation() throws Exception {
        setUp();
        String team = groupTeams.get("A").get(0);
        perform(post("/api/admin/seasons/" + seasonId + "/players/bulk"), Map.of("seasonTeamId", team, "players", List.of(
                Map.of("firstName", "Sardor", "lastName", "Karimov", "number", 7), Map.of("firstName", "Jasur", "lastName", "Rahimov", "number", 7))), asAdmin())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("2-qator: 7-raqam ro‘yxatda ikki marta yozilgan."));
        perform(post("/api/admin/seasons/" + seasonId + "/players/bulk"), Map.of("seasonTeamId", team, "players", List.of(
                Map.of("firstName", "Sardor", "lastName", "Karimov", "number", 9))), asAdmin())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(Matchers.startsWith("1-qator: 9-raqam")));
        // Pozitsiyasiz futbolchi ham qo'shiladi
        assertThat(postJson("/api/admin/seasons/" + seasonId + "/players/bulk", Map.of("seasonTeamId", team, "players", List.of(
                Map.of("firstName", "Sardor", "lastName", "Karimov")))).get("created").asInt()).isEqualTo(1);
    }
}
