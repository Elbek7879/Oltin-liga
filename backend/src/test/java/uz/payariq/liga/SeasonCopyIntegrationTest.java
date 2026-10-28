package uz.payariq.liga;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import tools.jackson.databind.JsonNode;
import uz.payariq.liga.model.SeasonTeam;
import uz.payariq.liga.repo.SeasonTeamRepository;

/**
 * Yangi mavsum: jamoalarning ko'pchiligi qatnashishda davom etadi. Tanlangan jamoalar futbolchilari (raqamlari bilan),
 * sardori va murabbiyi bilan ko'chadi; qatnashmaydiganlari qoldiriladi va keyin «Jamoalar» bo'limidan oldingi tarkibi bilan qo'shiladi.
 */
class SeasonCopyIntegrationTest extends IntegrationTestBase {

    @Autowired
    private SeasonTeamRepository seasonTeams;

    private String createSeason(String name, int year, String copyFrom, List<String> copyTeamIds) throws Exception {
        Map<String, Object> body = new HashMap<>(Map.of("name", name, "year", year, "startDate", year + "-05-01", "endDate", year + "-08-31"));
        if (copyFrom != null) body.put("copyTeamsFromSeasonId", copyFrom);
        if (copyTeamIds != null) body.put("copyTeamIds", copyTeamIds);
        return postJson("/api/admin/seasons", body).get("id").asText();
    }

    /** Jamoa nomi → (futbolchi id → raqam) */
    private Map<String, Map<String, Integer>> rosters(String seasonId) throws Exception {
        JsonNode b = getJson("/api/public/seasons/" + seasonId + "/bundle");
        Map<String, String> teamName = new HashMap<>();
        for (JsonNode t : b.get("teams")) teamName.put(t.get("id").asText(), t.get("name").asText());
        Map<String, Map<String, Integer>> out = new HashMap<>();
        for (JsonNode r : b.get("rosters")) {
            out.computeIfAbsent(teamName.get(r.get("seasonTeamId").asText()), k -> new HashMap<>())
                    .put(r.get("playerId").asText(), r.get("number").isNull() ? null : r.get("number").asInt());
        }
        for (String name : teamName.values()) out.putIfAbsent(name, Map.of());
        return out;
    }

    private Map<String, String> teamIds(String seasonId) throws Exception {
        Map<String, String> ids = new HashMap<>();
        for (JsonNode row : getJson("/api/admin/seasons/" + seasonId + "/teams")) ids.put(row.get("name").asText(), row.get("id").asText());
        return ids;
    }

    private SeasonTeam seasonTeam(String seasonId, String teamId) {
        return seasonTeams.findBySeasonIdAndTeamId(UUID.fromString(seasonId), UUID.fromString(teamId)).orElseThrow();
    }

    @Test
    @DisplayName("yangi mavsumga tanlangan jamoalar tarkibi bilan ko'chadi; qolgani keyin oldingi tarkibi bilan qo'shiladi")
    void returningTeamsMoveWithTheirPlayers() throws Exception {
        String first = createSeason("1-mavsum", 2027, null, null);
        for (String name : List.of("Lochin", "Kaptar", "Burgut", "Shunqor")) {
            postJson("/api/admin/teams?addToSeasonId=" + first, Map.of("name", name, "shortName", name.substring(0, 3).toUpperCase(), "village", "Payariq",
                    "primaryColor", "#145A3A", "secondaryColor", "#E2BF4F"));
        }
        Map<String, String> teams = teamIds(first);
        for (JsonNode row : getJson("/api/admin/seasons/" + first + "/teams")) {
            List<Map<String, Object>> squad = new ArrayList<>();
            for (int i = 1; i <= 5; i++) squad.add(Map.of("firstName", "Futbolchi", "lastName", row.get("name").asText() + "ov" + (char) ('a' + i), "number", i + 10));
            postJson("/api/admin/seasons/" + first + "/players/bulk", Map.of("seasonTeamId", row.get("seasonTeamId").asText(), "players", squad));
        }
        // Sardor va murabbiy
        Map<String, Map<String, Integer>> before = rosters(first);
        SeasonTeam lochin = seasonTeam(first, teams.get("Lochin"));
        String captain = before.get("Lochin").keySet().iterator().next();
        lochin.captainId = UUID.fromString(captain);
        lochin.coach = "Karimov Akmal";
        seasonTeams.save(lochin);

        // 2-mavsum: «Shunqor» bu yil qatnashmaydi
        String second = createSeason("2-mavsum", 2028, first, List.of(teams.get("Lochin"), teams.get("Kaptar"), teams.get("Burgut")));
        Map<String, Map<String, Integer>> after = rosters(second);
        assertThat(after.keySet()).containsExactlyInAnyOrder("Lochin", "Kaptar", "Burgut");
        for (String name : List.of("Lochin", "Kaptar", "Burgut")) assertThat(after.get(name)).as(name + " tarkibi raqamlari bilan").isEqualTo(before.get(name));
        SeasonTeam lochin2 = seasonTeam(second, teams.get("Lochin"));
        assertThat(lochin2.captainId).hasToString(captain);
        assertThat(lochin2.coach).isEqualTo("Karimov Akmal");

        // «Shunqor» kech qaytdi: «Jamoalar» bo'limidan qo'shilganda oldingi tarkibi bilan keladi
        JsonNode added = putJson("/api/admin/seasons/" + second + "/teams/" + teams.get("Shunqor"), Map.of("inSeason", true));
        assertThat(added.get("copiedPlayers").asInt()).isEqualTo(5);
        assertThat(rosters(second).get("Shunqor")).isEqualTo(before.get("Shunqor"));

        // 3-mavsum: faqat «Lochin» ko'chdi; «Kaptar» futbolchilaridan biri «Lochin»ga o'tdi
        String third = createSeason("3-mavsum", 2029, second, List.of(teams.get("Lochin")));
        String moved = before.get("Kaptar").keySet().iterator().next();
        String lochin3 = seasonTeam(third, teams.get("Lochin")).getId().toString();
        putJson("/api/admin/seasons/" + third + "/players/" + moved, Map.of("firstName", "Futbolchi", "lastName", "Kaptarovb", "seasonTeamId", lochin3, "number", 77));
        // Endi «Kaptar» qo'shilsa — o'tib ketgan futbolchi ko'chirilmaydi, u «Lochin»da qoladi
        assertThat(putJson("/api/admin/seasons/" + third + "/teams/" + teams.get("Kaptar"), Map.of("inSeason", true)).get("copiedPlayers").asInt()).isEqualTo(4);
        Map<String, Map<String, Integer>> third3 = rosters(third);
        assertThat(third3.get("Kaptar")).doesNotContainKey(moved).hasSize(4);
        assertThat(third3.get("Lochin")).containsEntry(moved, 77);

        // Tarkibsiz qo'shish ham mumkin
        assertThat(putJson("/api/admin/seasons/" + third + "/teams/" + teams.get("Burgut"), Map.of("inSeason", true, "withPlayers", false)).get("copiedPlayers").asInt()).isZero();
        assertThat(rosters(third).get("Burgut")).isEmpty();
    }

    @Test
    @DisplayName("jamoalar ro'yxati berilmasa — oldingi mavsumning hamma jamoasi ko'chadi (avvalgidek)")
    void copiesAllTeamsByDefault() throws Exception {
        String first = createSeason("1-mavsum", 2027, null, null);
        for (String name : List.of("Lochin", "Kaptar")) {
            postJson("/api/admin/teams?addToSeasonId=" + first, Map.of("name", name, "shortName", name.substring(0, 3).toUpperCase(), "village", "Payariq",
                    "primaryColor", "#145A3A", "secondaryColor", "#E2BF4F"));
        }
        String second = createSeason("2-mavsum", 2028, first, null);
        assertThat(rosters(second).keySet()).containsExactlyInAnyOrder("Lochin", "Kaptar");
    }
}
