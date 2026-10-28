package uz.payariq.liga;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class VenueIntegrationTest extends IntegrationTestBase {

    @Test
    @DisplayName("Bir qishloqda bir xil nomli maydon ikkinchi marta qo'shilmaydi")
    void duplicateVenue() throws Exception {
        String first = read(perform(post("/api/admin/venues"), Map.of("name", "Sinov maydoni", "village", "Payariq"), asAdmin())
                .andExpect(status().isOk())).get("id").asText();
        // Katta-kichik harf va bo'shliqlar farqi dublikatni yashirmaydi
        perform(post("/api/admin/venues"), Map.of("name", " sinov MAYDONI ", "village", "payariq"), asAdmin())
                .andExpect(status().isConflict());
        // Boshqa qishloqdagi shu nomli maydon — boshqa maydon
        String other = read(perform(post("/api/admin/venues"), Map.of("name", "Sinov maydoni", "village", "Mirzacho‘l"), asAdmin())
                .andExpect(status().isOk())).get("id").asText();
        // O'zini o'zgarishsiz saqlash mumkin, boshqasini birinchisi bilan bir xil qilib bo'lmaydi
        perform(put("/api/admin/venues/" + first), Map.of("name", "Sinov maydoni", "village", "Payariq"), asAdmin())
                .andExpect(status().isOk());
        perform(put("/api/admin/venues/" + other), Map.of("name", "Sinov maydoni", "village", "Payariq"), asAdmin())
                .andExpect(status().isConflict());
    }
}
