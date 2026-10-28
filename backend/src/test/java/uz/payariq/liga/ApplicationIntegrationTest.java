package uz.payariq.liga;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import uz.payariq.liga.domain.Role;

/** Saytdan ariza va murojaat yuborish hamda admin «Arizalar» bo'limi */
class ApplicationIntegrationTest extends IntegrationTestBase {

    /** PNG faylining birinchi baytlari — server turini mazmunidan aniqlaydi */
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0x0D, 'I', 'H', 'D', 'R'};
    private static final String[] POSITIONS = {"GK", "DF", "DF", "DF", "MF", "MF", "MF", "FW", "FW", "DF"};

    private static Map<String, Object> player(String first, String last, String position) {
        Map<String, Object> p = new HashMap<>();
        p.put("firstName", first);
        p.put("lastName", last);
        if (position != null) p.put("position", position);
        return p;
    }

    private static List<Map<String, Object>> squad(String lastName) {
        List<Map<String, Object>> list = new ArrayList<>();
        for (int i = 0; i < 10; i++) list.add(player("O‘yinchi" + (char) ('A' + i), lastName, POSITIONS[i]));
        return list;
    }

    private static Map<String, Object> application(String teamName, List<Map<String, Object>> players) {
        Map<String, Object> a = new HashMap<>();
        a.put("teamName", teamName);
        a.put("players", players);
        return a;
    }

    private ResultActions submit(Map<String, Object> data, byte[] logo) throws Exception {
        MockMultipartHttpServletRequestBuilder req = multipart("/api/public/applications/team")
                .file(new MockMultipartFile("data", "", MediaType.APPLICATION_JSON_VALUE, json.writeValueAsBytes(data)));
        if (logo != null) req.file(new MockMultipartFile("logo", "logo.png", "image/png", logo));
        return mvc.perform(req.with(csrf()));
    }

    private String season(String name, int year) throws Exception {
        return postJson("/api/admin/seasons", Map.of("name", name, "year", year, "startDate", year + "-05-01", "endDate", year + "-07-31"))
                .get("id").asText();
    }

    private JsonNode teamRow(String seasonId, String name) throws Exception {
        for (JsonNode t : getJson("/api/admin/seasons/" + seasonId + "/teams")) if (t.get("name").asText().equals(name)) return t;
        return null;
    }

    private JsonNode newApplication() throws Exception {
        for (JsonNode a : getJson("/api/admin/applications/teams")) if (a.get("status").asText().equals("NEW")) return a;
        return null;
    }

    @Test
    @DisplayName("ariza saytdan yuboriladi, admin qabul qiladi: jamoa logotipi va 10 futbolchisi bilan mavsumga qo'shiladi")
    void submitAndAccept() throws Exception {
        submit(application("Burgut", squad("Karimov")), PNG).andExpect(status().isNoContent());
        assertThat(getJson("/api/admin/applications/counts").get("teams").asInt()).isEqualTo(1);

        JsonNode app = newApplication();
        assertThat(app.get("players")).hasSize(10);
        assertThat(app.get("logoUrl").asText()).startsWith("/media/");
        assertThat(app.get("existingTeam").asBoolean()).isFalse();

        String seasonId = season("2-mavsum", 2027);
        // Mavsum tanlanmaydi — jamoa o'zi yangi (tayyorlanayotgan) mavsumga qo'shiladi
        JsonNode accepted = postJson("/api/admin/applications/teams/" + app.get("id").asText() + "/accept", null);
        assertThat(accepted.get("players").asInt()).isEqualTo(10);
        assertThat(accepted.get("existingTeam").asBoolean()).isFalse();
        assertThat(accepted.get("seasonName").asText()).isEqualTo("2-mavsum");

        JsonNode team = teamRow(seasonId, "Burgut");
        assertThat(team).isNotNull();
        assertThat(team.get("inSeason").asBoolean()).isTrue();
        assertThat(team.get("playersCount").asInt()).isEqualTo(10);
        assertThat(team.get("shortName").asText()).isEqualTo("BUR");
        assertThat(team.get("logoUrl").asText()).isEqualTo(app.get("logoUrl").asText());

        JsonNode decided = getJson("/api/admin/applications/teams").get(0);
        assertThat(decided.get("status").asText()).isEqualTo("ACCEPTED");
        assertThat(decided.get("seasonName").asText()).isEqualTo("2-mavsum");
        assertThat(getJson("/api/admin/applications/counts").get("teams").asInt()).isZero();
        // Ikkinchi marta qabul qilinmaydi
        perform(post("/api/admin/applications/teams/" + app.get("id").asText() + "/accept"), null, asAdmin())
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("ariza faqat yangi mavsumga qabul qilinadi: mavsum ochilmagan yoki boshlangan bo'lsa rad etiladi")
    void onlyUpcomingSeason() throws Exception {
        submit(application("Burgut", squad("Karimov")), PNG).andExpect(status().isNoContent());
        String id = newApplication().get("id").asText();
        String accept = "/api/admin/applications/teams/" + id + "/accept";
        perform(post(accept), null, asAdmin()).andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(containsString("Yangi mavsum hali ochilmagan")));

        // Qur'asi tashlangan mavsum boshlangan hisoblanadi — unga jamoa qo'shilmaydi
        String current = season("1-mavsum", 2026);
        for (String name : List.of("Lochin", "Kaptar", "Qarchig‘ay")) {
            postJson("/api/admin/teams?addToSeasonId=" + current, Map.of("name", name, "shortName", name.substring(0, 3).toUpperCase(),
                    "village", "Payariq", "primaryColor", "#145A3A", "secondaryColor", "#E2BF4F"));
        }
        List<String> seasonTeamIds = new ArrayList<>();
        for (JsonNode t : getJson("/api/admin/seasons/" + current + "/teams")) seasonTeamIds.add(t.get("seasonTeamId").asText());
        putJson("/api/admin/seasons/" + current + "/groups", Map.of("groups", List.of(Map.of("name", "A", "teamIds", seasonTeamIds))));
        perform(post(accept), null, asAdmin()).andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(containsString("boshlangan")));
        assertThat(teamRow(current, "Burgut")).isNull();

        // Yangi mavsum ochilgach — ariza o'sha mavsumga qabul qilinadi
        String next = season("2-mavsum", 2027);
        assertThat(postJson(accept, null).get("seasonName").asText()).isEqualTo("2-mavsum");
        assertThat(teamRow(next, "Burgut").get("inSeason").asBoolean()).isTrue();
    }

    @Test
    @DisplayName("noto'g'ri ariza saqlanmaydi: 10 futbolchi, pozitsiya, darvozabon, takroriy ism va logotip tekshiriladi; arizalarni faqat admin ko'radi")
    void validation() throws Exception {
        submit(application("Lochin", squad("Valiyev").subList(0, 9)), PNG).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("10 ta futbolchi")));

        List<Map<String, Object>> noPosition = squad("Valiyev");
        noPosition.set(4, player("Aziz", "Valiyev", null));
        submit(application("Lochin", noPosition), PNG).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("5-futbolchi: pozitsiyasini")));

        List<Map<String, Object>> noKeeper = squad("Valiyev");
        noKeeper.set(0, player("O‘yinchiA", "Valiyev", "FW"));
        submit(application("Lochin", noKeeper), PNG).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("darvozabon")));

        List<Map<String, Object>> twice = squad("Valiyev");
        twice.set(9, player("o‘yinchia", "VALIYEV", "DF"));
        submit(application("Lochin", twice), PNG).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("ikki marta")));

        submit(application("Lochin", squad("Valiyev")), null).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("logotip")));
        submit(application("Lochin", squad("Valiyev")), "bu rasm emas".getBytes()).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("PNG")));

        // Bot to'ldirgan ko'rinmas maydon: javob odatdagidek, lekin ariza saqlanmaydi
        Map<String, Object> bot = application("Spam FC", squad("Bot"));
        bot.put("website", "https://spam.example");
        submit(bot, PNG).andExpect(status().isNoContent());
        assertThat(getJson("/api/admin/applications/teams")).isEmpty();

        // Arizalarda telefon raqamlari bor: muxlis va yordamchi rollar ko'rmaydi
        mvc.perform(get("/api/admin/applications/teams")).andExpect(status().isUnauthorized());
        perform(get("/api/admin/applications/teams"), null, as(Role.RESULT_ENTRY)).andExpect(status().isForbidden());
        perform(get("/api/admin/applications/counts"), null, as(Role.EDITOR)).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("bir xil nomli jamoa: ko'rib chiqilayotgan ariza, ro'yxatdan o'tgan jamoa va mavjud jamoa nomini takrorlab bo'lmaydi")
    void duplicateNames() throws Exception {
        String seasonId = season("2-mavsum", 2027);
        submit(application("Qo‘rg‘on", squad("Karimov")), PNG).andExpect(status().isNoContent());
        // Katta-kichik harf, tutuq belgisi va bo'shliqlar farqi yangi nom hisoblanmaydi
        submit(application("  qo'rg'on ", squad("Karimov")), PNG).andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(containsString("ko‘rib chiqilmoqda")));

        String first = newApplication().get("id").asText();
        perform(post("/api/admin/applications/teams/" + first + "/ignore"), null, asAdmin()).andExpect(status().isNoContent());
        // Birinchisi e'tiborsiz qoldirildi — tuzatilgan ariza qayta yuboriladi
        submit(application("QO‘RG‘ON", squad("Karimov")), PNG).andExpect(status().isNoContent());
        String second = newApplication().get("id").asText();
        postJson("/api/admin/applications/teams/" + second + "/accept", null);

        submit(application("Qo'rg'on", squad("Karimov")), PNG).andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(containsString("ro‘yxatdan o‘tgan")));
        perform(post("/api/admin/teams"), Map.of("name", "qo’rg’on", "shortName", "QOR", "village", "Payariq",
                "primaryColor", "#145A3A", "secondaryColor", "#E2BF4F"), asAdmin()).andExpect(status().isConflict());
        // Eski (e'tiborsiz qoldirilgan) ariza endi qabul qilinmaydi — jamoa mavsumda allaqachon bor
        perform(post("/api/admin/applications/teams/" + first + "/accept"), null, asAdmin())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(containsString("allaqachon ishtirok etadi")));
        assertThat(getJson("/api/admin/seasons/" + seasonId + "/teams")).hasSize(1);
    }

    @Test
    @DisplayName("qaytgan jamoa: mavjud jamoa yangi mavsumga qo'shiladi, oldingi mavsum futbolchilari taniladi va statistikasi davom etadi")
    void returningTeam() throws Exception {
        String previous = season("1-mavsum", 2026);
        for (String name : List.of("Lochin", "Kaptar", "Qarchig‘ay")) {
            postJson("/api/admin/teams?addToSeasonId=" + previous, Map.of("name", name, "shortName", name.substring(0, 3).toUpperCase(),
                    "village", "Payariq", "primaryColor", "#145A3A", "secondaryColor", "#E2BF4F"));
        }
        List<String> seasonTeamIds = new ArrayList<>();
        for (JsonNode t : getJson("/api/admin/seasons/" + previous + "/teams")) seasonTeamIds.add(t.get("seasonTeamId").asText());
        String lochin = teamRow(previous, "Lochin").get("seasonTeamId").asText();
        postJson("/api/admin/seasons/" + previous + "/players/bulk", Map.of("seasonTeamId", lochin, "players", List.of(
                Map.of("firstName", "Sardor", "lastName", "Qo'chqorov", "number", 9, "position", "FW"),
                Map.of("firstName", "Ali", "lastName", "Valiyev", "number", 1, "position", "GK"))));
        String sardor = null;
        for (JsonNode p : getJson("/api/admin/seasons/" + previous + "/players")) if (p.get("firstName").asText().equals("Sardor")) sardor = p.get("id").asText();
        // Qur'a tashlangan — o'tgan mavsum jamoalari yangi mavsumga bemalol ariza beradi
        putJson("/api/admin/seasons/" + previous + "/groups", Map.of("groups", List.of(Map.of("name", "A", "teamIds", seasonTeamIds))));

        String next = season("2-mavsum", 2027);
        List<Map<String, Object>> players = squad("Rahimov");
        players.set(0, player("ali", "valiyev", "GK"));
        players.set(8, player("Sardor", "Qo‘chqorov", "MF"));
        submit(application("lochin", players), PNG).andExpect(status().isNoContent());
        JsonNode app = newApplication();
        assertThat(app.get("existingTeam").asBoolean()).isTrue();

        JsonNode accepted = postJson("/api/admin/applications/teams/" + app.get("id").asText() + "/accept", null);
        assertThat(accepted.get("existingTeam").asBoolean()).isTrue();
        assertThat(accepted.get("returning").asInt()).isEqualTo(2);
        assertThat(accepted.get("teamName").asText()).isEqualTo("Lochin");

        // Yangi jamoa ochilmadi: o'sha «Lochin» yangi mavsumda, arizadagi logotip bilan
        assertThat(getJson("/api/admin/seasons/" + next + "/teams")).hasSize(3);
        JsonNode team = teamRow(next, "Lochin");
        assertThat(team.get("inSeason").asBoolean()).isTrue();
        assertThat(team.get("playersCount").asInt()).isEqualTo(10);
        assertThat(team.get("logoUrl").asText()).isEqualTo(app.get("logoUrl").asText());
        JsonNode same = null;
        for (JsonNode p : getJson("/api/admin/seasons/" + next + "/players")) if (p.get("id").asText().equals(sardor)) same = p;
        assertThat(same).isNotNull();
        assertThat(same.get("seasonTeamId").asText()).isEqualTo(team.get("seasonTeamId").asText());
        assertThat(same.get("position").asText()).isEqualTo("MF");
    }

    @Test
    @DisplayName("taklif va shikoyat: saytdan matn yuboriladi, admin o'qilgan deb belgilaydi va o'chiradi")
    void feedback() throws Exception {
        perform(post("/api/public/applications/feedback"), Map.of("kind", "SUGGESTION", "body", "Final o‘yinini kechqurun o‘tkazsangiz yaxshi bo‘lardi",
                "authorName", "Anvar"), null).andExpect(status().isNoContent());
        perform(post("/api/public/applications/feedback"), Map.of("kind", "COMPLAINT", "body", "Qisqa"), null).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("kamida 10")));
        perform(post("/api/public/applications/feedback"), Map.of("body", "Turi tanlanmagan murojaat matni"), null).andExpect(status().isBadRequest());
        perform(post("/api/public/applications/feedback"), Map.of("kind", "REQUEST", "body", "Botdan kelgan reklama matni bu yerda", "website", "x"), null)
                .andExpect(status().isNoContent());

        assertThat(getJson("/api/admin/applications/counts").get("messages").asInt()).isEqualTo(1);
        JsonNode list = getJson("/api/admin/applications/messages");
        assertThat(list).hasSize(1);
        JsonNode m = list.get(0);
        assertThat(m.get("kind").asText()).isEqualTo("SUGGESTION");
        assertThat(m.get("authorName").asText()).isEqualTo("Anvar");
        assertThat(m.get("status").asText()).isEqualTo("NEW");

        perform(post("/api/admin/applications/messages/" + m.get("id").asText() + "/read"), null, asAdmin()).andExpect(status().isNoContent());
        assertThat(getJson("/api/admin/applications/counts").get("messages").asInt()).isZero();
        perform(post("/api/admin/applications/messages/read-all"), null, asAdmin()).andExpect(status().isNoContent());
        doDelete("/api/admin/applications/messages/" + m.get("id").asText()).andExpect(status().isNoContent());
        assertThat(getJson("/api/admin/applications/messages")).isEmpty();
    }
}
