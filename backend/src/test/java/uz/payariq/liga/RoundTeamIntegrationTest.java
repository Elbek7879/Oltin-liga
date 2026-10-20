package uz.payariq.liga;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import uz.payariq.liga.domain.Role;

/** Ramziy jamoa: tur tugagach 5 futbolchi tanlanadi, qoralama saytda ko'rinmaydi, e'lon qilingani bundle'da chiqadi */
class RoundTeamIntegrationTest extends IntegrationTestBase {

    private String seasonId;
    /** seasonTeamId → shu jamoaning futbolchilari (playerId) */
    private final Map<String, List<String>> playersOf = new LinkedHashMap<>();

    private void setUpSeasonWithFirstRoundPlayed() throws Exception {
        Map<String, Object> rules = Map.of("pointsWin", 3, "pointsDraw", 1, "pointsLoss", 0, "tiebreakers", List.of("GOAL_DIFF"),
                "legs", 1, "qualifiersPerGroup", 2, "thirdPlaceMatch", false, "halfMinutes", 20);
        seasonId = postJson("/api/admin/seasons", Map.of("name", "Sinov", "year", 2026, "startDate", "2026-05-01", "endDate", "2026-08-31", "rules", rules))
                .get("id").asText();
        postJson("/api/admin/seasons/" + seasonId + "/activate", null);
        for (String name : List.of("Lochin", "Chinor", "Bahor", "Navbahor")) {
            postJson("/api/admin/teams?addToSeasonId=" + seasonId, Map.of("name", name, "shortName", name.substring(0, 3).toUpperCase(), "village", name,
                    "primaryColor", "#145A3A", "secondaryColor", "#E2BF4F"));
        }
        List<String> ids = new ArrayList<>();
        for (JsonNode row : getJson("/api/admin/seasons/" + seasonId + "/teams")) if (row.get("inSeason").asBoolean()) ids.add(row.get("seasonTeamId").asText());
        int n = 0;
        for (String st : ids) {
            List<Map<String, Object>> list = new ArrayList<>();
            for (String pos : List.of("GK", "DF", "MF", "FW")) list.add(Map.of("firstName", "O‘yinchi", "lastName", "N" + (++n), "number", n, "position", pos));
            postJson("/api/admin/seasons/" + seasonId + "/players/bulk", Map.of("seasonTeamId", st, "players", list));
        }
        for (JsonNode r : bundle().get("rosters")) playersOf.computeIfAbsent(r.get("seasonTeamId").asText(), k -> new ArrayList<>()).add(r.get("playerId").asText());
        putJson("/api/admin/seasons/" + seasonId + "/groups", Map.of("groups", List.of(Map.of("name", "A", "teamIds", ids))));
        scheduleUndated(bundle(), java.time.LocalDate.of(2026, 5, 2));
        // 1-tur: ikkala o'yin yakunlanadi (uy jamoasining hujumchisi bitta gol uradi)
        for (JsonNode m : bundle().get("matches")) {
            if (m.get("round").asInt() != 1) continue;
            String home = m.get("homeId").asText();
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("status", "FINISHED");
            result.put("homeScore", 1);
            result.put("awayScore", 0);
            result.put("events", List.of(Map.of("type", "GOAL", "seasonTeamId", home, "playerId", playersOf.get(home).get(3))));
            putJson("/api/admin/matches/" + m.get("id").asText() + "/result", result);
        }
    }

    private JsonNode bundle() throws Exception {
        return getJson("/api/public/seasons/" + seasonId + "/bundle");
    }

    private Map<String, Object> input(int round, Map<String, String> slots, boolean publish) {
        List<Map<String, Object>> list = new ArrayList<>();
        slots.forEach((slot, player) -> list.add(Map.of("slot", slot, "playerId", player)));
        Map<String, Object> body = new HashMap<>();
        body.put("stage", "GROUP");
        body.put("round", round);
        body.put("slots", list);
        body.put("publish", publish);
        return body;
    }

    /** Har jamoadan bittadan: GK, DF, MF_L, MF_R va FW */
    private Map<String, String> fullTeam() {
        List<List<String>> teams = new ArrayList<>(playersOf.values());
        Map<String, String> slots = new LinkedHashMap<>();
        slots.put("GK", teams.get(0).get(0));
        slots.put("DF", teams.get(1).get(1));
        slots.put("MF_L", teams.get(2).get(2));
        slots.put("MF_R", teams.get(3).get(2));
        slots.put("FW", teams.get(0).get(3));
        return slots;
    }

    @Test
    @DisplayName("ramziy jamoa: tugamagan tur rad etiladi, qoralama saytda ko'rinmaydi, 5 o'rin to'lgach e'lon qilinadi")
    void roundTeamLifecycle() throws Exception {
        setUpSeasonWithFirstRoundPlayed();
        String url = "/api/admin/seasons/" + seasonId + "/round-teams";

        // 2-tur hali o'ynalmagan
        perform(put(url), input(2, fullTeam(), false), asAdmin())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(Matchers.containsString("hali tugamagan")));

        // Qoralama: 2 ta o'rin yetarli, saytda ko'rinmaydi
        Map<String, String> partial = new LinkedHashMap<>();
        partial.put("GK", fullTeam().get("GK"));
        partial.put("FW", fullTeam().get("FW"));
        JsonNode draft = read(perform(put(url), input(1, partial, false), asAdmin()).andExpect(status().isOk()));
        assertThat(draft.get("published").asBoolean()).isFalse();
        assertThat(draft.get("slots")).hasSize(2);
        assertThat(bundle().get("roundTeams")).isEmpty();

        // E'lon qilish uchun 5 o'rin kerak
        perform(put(url), input(1, partial, true), asAdmin())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(Matchers.containsString("5 ta o‘rinning hammasiga")));

        // Bir futbolchi ikki o'rinda bo'lmaydi; noma'lum o'rin va tarkibda yo'q futbolchi rad etiladi
        Map<String, String> twice = new LinkedHashMap<>(fullTeam());
        twice.put("DF", twice.get("GK"));
        perform(put(url), input(1, twice, false), asAdmin()).andExpect(status().isBadRequest());
        perform(put(url), input(1, Map.of("LW", fullTeam().get("FW")), false), asAdmin()).andExpect(status().isBadRequest());
        perform(put(url), input(1, Map.of("FW", UUID.randomUUID().toString()), false), asAdmin()).andExpect(status().isBadRequest());

        // E'lon: saytda chiqadi, futbolchi jamoasi o'zi aniqlanadi; shu tur qayta saqlansa — yangi yozuv emas, yangilanadi
        JsonNode published = read(perform(put(url), input(1, fullTeam(), true), asAdmin()).andExpect(status().isOk()));
        assertThat(published.get("published").asBoolean()).isTrue();
        assertThat(published.get("publishedAt").isNull()).isFalse();
        JsonNode shown = bundle().get("roundTeams");
        assertThat(shown).hasSize(1);
        assertThat(shown.get(0).get("round").asInt()).isEqualTo(1);
        assertThat(shown.get(0).get("slots")).hasSize(5);
        String gk = fullTeam().get("GK");
        String gkTeam = playersOf.entrySet().stream().filter(e -> e.getValue().contains(gk)).findFirst().orElseThrow().getKey();
        assertThat(shown.get(0).get("slots").get(0).get("slot").asText()).isEqualTo("GK");
        assertThat(shown.get(0).get("slots").get(0).get("seasonTeamId").asText()).isEqualTo(gkTeam);
        perform(put(url), input(1, fullTeam(), true), asAdmin()).andExpect(status().isOk());
        assertThat(getJson(url)).hasSize(1);

        // Ramziy jamoadagi futbolchini o'chirib bo'lmaydi
        perform(delete("/api/admin/players/" + gk), null, asAdmin())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(Matchers.containsString("ramziy jamoada")));

        // Natija kirituvchi ko'radi, lekin o'zgartira olmaydi
        perform(get(url), null, as(Role.RESULT_ENTRY)).andExpect(status().isOk());
        perform(put(url), input(1, fullTeam(), true), as(Role.RESULT_ENTRY)).andExpect(status().isForbidden());

        // O'chirish
        String id = published.get("id").asText();
        perform(delete("/api/admin/round-teams/" + id), null, asAdmin()).andExpect(status().isNoContent());
        assertThat(getJson(url)).isEmpty();
        assertThat(bundle().get("roundTeams")).isEmpty();
    }

    @Test
    @DisplayName("futbolchi rasmi: faqat yuklangan rasm manzili qabul qilinadi va saytda ko'rinadi, olib tashlash mumkin")
    void playerPhoto() throws Exception {
        setUpSeasonWithFirstRoundPlayed();
        String player = playersOf.values().iterator().next().get(0);
        String photo = "/api/admin/players/" + player + "/photo";
        perform(put(photo), Map.of("photoUrl", "https://evil.example/x.png"), asAdmin()).andExpect(status().isBadRequest());
        perform(put(photo), Map.of("photoUrl", "/media/../../etc/passwd"), asAdmin()).andExpect(status().isBadRequest());
        String media = "/media/" + UUID.randomUUID() + ".webp";
        perform(put(photo), Map.of("photoUrl", media), asAdmin()).andExpect(status().isNoContent());
        JsonNode p = null;
        for (JsonNode x : bundle().get("players")) if (x.get("id").asText().equals(player)) p = x;
        assertThat(p.get("photoUrl").asText()).isEqualTo(media);
        assertThat(p.has("phone")).isFalse();
        perform(put(photo), Map.of("photoUrl", ""), asAdmin()).andExpect(status().isNoContent());
        for (JsonNode x : bundle().get("players")) if (x.get("id").asText().equals(player)) assertThat(x.get("photoUrl").isNull()).isTrue();
    }
}
