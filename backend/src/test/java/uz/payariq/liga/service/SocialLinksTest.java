package uz.payariq.liga.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import uz.payariq.liga.common.ApiException;

class SocialLinksTest {

    @Test
    @DisplayName("havola istalgan ko'rinishda kiritilsa ham bir xil to'liq havolaga keltiriladi")
    void normalizes() {
        assertThat(SocialLinks.telegram("t.me/Oltinliga12")).isEqualTo("https://t.me/Oltinliga12");
        assertThat(SocialLinks.telegram("@Oltinliga12")).isEqualTo("https://t.me/Oltinliga12");
        assertThat(SocialLinks.telegram("https://t.me/Oltinliga12/")).isEqualTo("https://t.me/Oltinliga12");
        assertThat(SocialLinks.instagram("oltin.liga12")).isEqualTo("https://www.instagram.com/oltin.liga12/");
        assertThat(SocialLinks.instagram("https://www.instagram.com/oltin.liga12?igsh=abc")).isEqualTo("https://www.instagram.com/oltin.liga12/");
        assertThat(SocialLinks.youtube("https://www.youtube.com/@Sanjar192")).isEqualTo("https://www.youtube.com/@Sanjar192");
        assertThat(SocialLinks.youtube("youtube.com/@Sanjar192")).isEqualTo("https://www.youtube.com/@Sanjar192");
        assertThat(SocialLinks.youtube("@Sanjar192")).isEqualTo("https://www.youtube.com/@Sanjar192");
        assertThat(SocialLinks.youtube("  ")).isEmpty();
        assertThat(SocialLinks.telegram(null)).isEmpty();
    }

    @Test
    @DisplayName("boshqa saytga havola yoki noto'g'ri nom qabul qilinmaydi")
    void rejectsForeignLinks() {
        assertThatThrownBy(() -> SocialLinks.telegram("https://evil.example/Oltinliga12")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> SocialLinks.instagram("javascript:alert(1)")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> SocialLinks.youtube("https://youtube.com.evil.example/@x")).isInstanceOf(ApiException.class);
    }
}
