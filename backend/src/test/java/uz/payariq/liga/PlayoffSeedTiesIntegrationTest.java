package uz.payariq.liga;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

/**
 * Pley-off reytingida bir o'rinning o'zida bir-biridan alohida bir nechta teng holat (masalan, guruh g'oliblari orasida
 * ikki juft to'liq teng jamoa). Tizim har biriga qur'a tashlaydi — qur'alar bir-birini o'chirmasligi va setka tuzilishi shart.
 */
class PlayoffSeedTiesIntegrationTest extends IntegrationTestBase {

    private String seasonId;
    private final Map<String, String> playerOf = new HashMap<>();

    private JsonNode bundle() throws Exception {
        return getJson("/api/public/seasons/" + seasonId + "/bundle");
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

    @Test
    @DisplayName("bir o'rinda ikki juft teng jamoa: ikkala qur'a saqlanadi va setka o'zi tuziladi")
    void twoSeparateTiesOnOneSeedPosition() throws Exception {
        Map<String, Object> rules = Map.of("pointsWin", 3, "pointsDraw", 1, "pointsLoss", 0,
                "tiebreakers", List.of("H2H_POINTS", "H2H_GOAL_DIFF", "GOAL_DIFF", "GOALS_FOR", "FAIR_PLAY"),
                "legs", 1, "qualifiersPerGroup", 2, "qualifiersBySize", Map.of(3, 2), "thirdPlaceMatch", true);
        seasonId = postJson("/api/admin/seasons", Map.of("name", "1-mavsum", "year", 2027, "startDate", "2027-05-01", "endDate", "2027-08-31", "rules", rules))
                .get("id").asText();
        for (int i = 0; i < 12; i++) {
            postJson("/api/admin/teams?addToSeasonId=" + seasonId, Map.of("name", "Jamoa " + (i + 1), "shortName", "J" + (char) ('A' + i), "village", "Qishloq " + i,
                    "primaryColor", "#145A3A", "secondaryColor", "#E2BF4F"));
        }
        List<String> ids = new ArrayList<>();
        for (JsonNode row : getJson("/api/admin/seasons/" + seasonId + "/teams")) if (row.get("inSeason").asBoolean()) ids.add(row.get("seasonTeamId").asText());
        for (String st : ids) {
            postJson("/api/admin/seasons/" + seasonId + "/players/bulk", Map.of("seasonTeamId", st, "players", List.of(Map.of("firstName", "Ali", "lastName", "Valiyev", "number", 9))));
        }
        for (JsonNode r : bundle().get("rosters")) playerOf.put(r.get("seasonTeamId").asText(), r.get("playerId").asText());
        Map<String, List<String>> groups = new LinkedHashMap<>();
        groups.put("A", ids.subList(0, 3));
        groups.put("B", ids.subList(3, 6));
        groups.put("C", ids.subList(6, 9));
        groups.put("D", ids.subList(9, 12));
        List<Map<String, Object>> draw = new ArrayList<>();
        groups.forEach((name, teams) -> draw.add(Map.of("name", name, "teamIds", teams)));
        putJson("/api/admin/seasons/" + seasonId + "/groups", Map.of("groups", draw));
        scheduleUndated(bundle(), java.time.LocalDate.of(2027, 5, 1));

        // A va B: g'olib ikkalasini 1:0 yutadi; C va D: g'olib 2:0 yutadi; ikkinchi o'rin uchinchini 1:0 yutadi.
        // Natijada g'oliblar orasida {A1, B1} va {C1, D1}, ikkinchilar orasida {A2, B2} va {C2, D2} — to'liq teng juftliklar
        for (JsonNode m : bundle().get("matches")) {
            String home = m.get("homeId").asText();
            String away = m.get("awayId").asText();
            String group = groups.entrySet().stream().filter(e -> e.getValue().contains(home)).findFirst().orElseThrow().getKey();
            List<String> order = groups.get(group);
            boolean homeStronger = order.indexOf(home) < order.indexOf(away);
            boolean winnerGame = order.indexOf(home) == 0 || order.indexOf(away) == 0;
            int margin = winnerGame && List.of("C", "D").contains(group) ? 2 : 1;
            putJson("/api/admin/matches/" + m.get("id").asText() + "/result", homeStronger ? result(home, margin, away, 0) : result(home, 0, away, margin));
        }

        JsonNode b = bundle();
        long playoff = 0;
        for (JsonNode m : b.get("matches")) if ("PLAYOFF".equals(m.get("stage").asText())) playoff++;
        // 8 jamoa: chorak final (4) + yarim final (2) + final + 3-o'rin
        assertThat(playoff).isEqualTo(8);
        Map<String, Integer> lotSizes = new HashMap<>();
        for (JsonNode l : b.get("lots")) lotSizes.put(l.get("scope").asText(), l.get("order").size());
        assertThat(lotSizes).containsEntry("SEED:1", 4).containsEntry("SEED:2", 4);
    }
}
