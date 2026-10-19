package uz.payariq.liga;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.JsonNode;
import uz.payariq.liga.domain.Role;

class UserManagementIntegrationTest extends IntegrationTestBase {

    private static final String HELPER_PASSWORD = "Natija-2026-kun";

    private JsonNode createHelper(String username, Role role) throws Exception {
        return postJson("/api/admin/users", Map.of("username", username, "displayName", "Akmal Karimov", "role", role, "password", HELPER_PASSWORD));
    }

    private ResultActions login(String username, String password) throws Exception {
        return mvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("username", username, "password", password))));
    }

    private MockHttpSession session(String username, String password) throws Exception {
        return (MockHttpSession) login(username, password).andExpect(status().isOk()).andReturn().getRequest().getSession(false);
    }

    @Test
    @DisplayName("bosh tashkilotchi yordamchi qo'shadi, yordamchi o'z roli doirasida ishlaydi")
    void createHelperAndLogin() throws Exception {
        JsonNode created = createHelper("akmal", Role.RESULT_ENTRY);
        assertThat(created.get("role").asString()).isEqualTo("RESULT_ENTRY");
        assertThat(created.has("passwordHash")).isFalse();
        assertThat(getJson("/api/admin/users")).hasSize(2);

        MockHttpSession helper = session("akmal", HELPER_PASSWORD);
        mvc.perform(get("/api/auth/me").session(helper)).andExpect(jsonPath("$.role").value("RESULT_ENTRY"));
        mvc.perform(get("/api/admin/audit").session(helper)).andExpect(status().isOk());
        mvc.perform(get("/api/admin/users").session(helper)).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("foydalanuvchilarni faqat bosh tashkilotchi boshqaradi")
    void onlySuperAdmin() throws Exception {
        perform(get("/api/admin/users"), null, as(Role.ADMIN)).andExpect(status().isForbidden());
        perform(post("/api/admin/users"), Map.of("username", "begona", "displayName", "Begona", "role", "SUPER_ADMIN", "password", HELPER_PASSWORD), as(Role.ADMIN))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("oddiy parol, band login va noto'g'ri login rad etiladi")
    void validation() throws Exception {
        perform(post("/api/admin/users"), Map.of("username", "akmal", "displayName", "Akmal", "role", "EDITOR", "password", "12345"), asAdmin())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Parol kamida 10 ta belgidan iborat bo‘lsin."));
        perform(post("/api/admin/users"), Map.of("username", "akmal", "displayName", "Akmal", "role", "EDITOR", "password", "akmal-parol-1"), asAdmin())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Parol ichida login bo‘lmasin."));
        perform(post("/api/admin/users"), Map.of("username", "Akmal aka", "displayName", "Akmal", "role", "EDITOR", "password", HELPER_PASSWORD), asAdmin())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.username").exists());
        createHelper("akmal", Role.EDITOR);
        perform(post("/api/admin/users"), Map.of("username", "AKMAL", "displayName", "Akmal", "role", "EDITOR", "password", HELPER_PASSWORD), asAdmin())
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("o'z akkauntini o'chirib yoki rolini pasaytirib bo'lmaydi")
    void cannotLockSelfOut() throws Exception {
        JsonNode me = getJson("/api/admin/users").get(0);
        String url = "/api/admin/users/" + me.get("id").asString();
        perform(put(url), Map.of("displayName", "Sinov", "role", "SUPER_ADMIN", "enabled", false), asAdmin()).andExpect(status().isConflict());
        perform(put(url), Map.of("displayName", "Sinov", "role", "EDITOR", "enabled", true), asAdmin()).andExpect(status().isConflict());
        perform(put(url), Map.of("displayName", "Bosh tashkilotchi", "role", "SUPER_ADMIN", "enabled", true), asAdmin())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Bosh tashkilotchi"));
    }

    @Test
    @DisplayName("o'chirilgan yoki roli o'zgargan yordamchining sessiyasi darhol yopiladi")
    void disableAndRoleChangeEndSession() throws Exception {
        String id = createHelper("akmal", Role.ADMIN).get("id").asString();
        MockHttpSession helper = session("akmal", HELPER_PASSWORD);
        mvc.perform(get("/api/admin/audit").session(helper)).andExpect(status().isOk());

        putJson("/api/admin/users/" + id, Map.of("displayName", "Akmal Karimov", "role", "RESULT_ENTRY", "enabled", true));
        mvc.perform(get("/api/admin/audit").session(helper))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Rolingiz o‘zgartirildi. Qaytadan kiring."));

        MockHttpSession again = session("akmal", HELPER_PASSWORD);
        putJson("/api/admin/users/" + id, Map.of("displayName", "Akmal Karimov", "role", "RESULT_ENTRY", "enabled", false));
        mvc.perform(get("/api/admin/audit").session(again))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Akkauntingiz o‘chirilgan. Bosh tashkilotchiga murojaat qiling."));
        // O'chirilgan akkaunt: to'g'ri parolda tushuntirish, noto'g'ri parolda umumiy xabar
        login("akmal", HELPER_PASSWORD).andExpect(status().isForbidden());
        login("akmal", "Taxminiy-parol-1").andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("bosh tashkilotchi yordamchiga yangi parol o'rnatadi")
    void resetPassword() throws Exception {
        String id = createHelper("akmal", Role.EDITOR).get("id").asString();
        perform(put("/api/admin/users/" + id + "/password"), Map.of("password", "Yangi-parol-77"), asAdmin()).andExpect(status().isNoContent());
        login("akmal", HELPER_PASSWORD).andExpect(status().isUnauthorized());
        login("akmal", "Yangi-parol-77").andExpect(status().isOk());
    }

    @Test
    @DisplayName("har bir tashkilotchi o'z parolini joriy parol bilan almashtiradi")
    void changeOwnPassword() throws Exception {
        MockHttpSession me = session(ADMIN, ADMIN_PASSWORD);
        String wrong = json.writeValueAsString(Map.of("currentPassword", "xato-parol-123", "newPassword", "Boshqa-parol-55"));
        mvc.perform(put("/api/auth/password").session(me).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(wrong))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Joriy parol noto‘g‘ri."));

        String ok = json.writeValueAsString(Map.of("currentPassword", ADMIN_PASSWORD, "newPassword", "Boshqa-parol-55"));
        mvc.perform(put("/api/auth/password").session(me).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(ok))
                .andExpect(status().isNoContent());
        login(ADMIN, "Boshqa-parol-55").andExpect(status().isOk());

        mvc.perform(put("/api/auth/password").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(ok))
                .andExpect(status().isUnauthorized());
    }
}
