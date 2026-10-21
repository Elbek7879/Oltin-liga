package uz.payariq.liga;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** Production'dagidek HTTPS proksi (Caddy) ortida: havolalar haqiqiy domen va https bilan yoziladi */
@TestPropertySource(properties = "server.forward-headers-strategy=framework")
class SeoBehindProxyTest extends IntegrationTestBase {

    private static MockHttpServletRequestBuilder viaProxy(String path) {
        return get(path).header("X-Forwarded-Proto", "https").header("X-Forwarded-Host", "oltinliga.uz").header("X-Forwarded-Port", "443");
    }

    private String body(String path) throws Exception {
        return mvc.perform(viaProxy(path)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    @Test
    @DisplayName("domen va https: sahifa, robots.txt va sitemap.xml dagi manzillar oltinliga.uz bilan, localhost yo'q")
    void realDomainLinks() throws Exception {
        assertThat(body("/jadval")).contains("<link rel=\"canonical\" href=\"https://oltinliga.uz/jadval\" />")
                .contains("content=\"https://oltinliga.uz/og-image.jpg\"").doesNotContain("localhost");
        assertThat(body("/")).contains("\"url\":\"https://oltinliga.uz/\"");
        assertThat(body("/robots.txt")).contains("Sitemap: https://oltinliga.uz/sitemap.xml");
        assertThat(body("/sitemap.xml")).contains("<loc>https://oltinliga.uz/nizom</loc>").doesNotContain("localhost");
    }
}
