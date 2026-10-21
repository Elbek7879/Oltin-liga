package uz.payariq.liga.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class VisitServiceTest {

    @Test
    @DisplayName("muxlis qayerdan kelgani havoladan aniqlanadi; o'z saytidan o'tish — to'g'ridan-to'g'ri")
    void source() {
        assertThat(VisitService.source("https://t.me/oltinliga12", "oltinliga.uz")).isEqualTo("telegram");
        assertThat(VisitService.source("android-app://org.telegram.messenger/", "oltinliga.uz")).isEqualTo("telegram");
        assertThat(VisitService.source("https://l.instagram.com/?u=x", "oltinliga.uz")).isEqualTo("instagram");
        assertThat(VisitService.source("https://www.google.com/", "oltinliga.uz")).isEqualTo("google");
        assertThat(VisitService.source("https://yandex.uz/search", "oltinliga.uz")).isEqualTo("yandex");
        assertThat(VisitService.source("https://m.youtube.com/@Sanjar192", "oltinliga.uz")).isEqualTo("youtube");
        assertThat(VisitService.source("https://m.facebook.com/", "oltinliga.uz")).isEqualTo("facebook");
        assertThat(VisitService.source("https://kun.uz/news", "oltinliga.uz")).isEqualTo("other");
        assertThat(VisitService.source("https://www.oltinliga.uz/jadval", "oltinliga.uz")).isEqualTo("direct");
        assertThat(VisitService.source("https://oltinliga.uz/", "oltinliga.uz")).isEqualTo("direct");
        assertThat(VisitService.source("", "oltinliga.uz")).isEqualTo("direct");
        assertThat(VisitService.source(null, "oltinliga.uz")).isEqualTo("direct");
        assertThat(VisitService.source("bu havola emas ::", "oltinliga.uz")).isEqualTo("other");
    }

    @Test
    @DisplayName("telefon va kompyuter brauzer yozuvidan farqlanadi; raqamning faqat xeshi saqlanadi")
    void deviceAndHash() {
        assertThat(VisitService.device("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Mobile/15E148")).isEqualTo("phone");
        assertThat(VisitService.device("Mozilla/5.0 (Linux; Android 14) Mobile Safari/537.36")).isEqualTo("phone");
        assertThat(VisitService.device("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0")).isEqualTo("desktop");
        String id = "3f2b8c1e-6a4d-4f7b-9c2e-1d5a7b9e0c3f";
        assertThat(VisitService.hash(id)).hasSize(64).isEqualTo(VisitService.hash(id.toUpperCase())).doesNotContain(id);
    }
}
