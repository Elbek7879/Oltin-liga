package uz.payariq.liga.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import uz.payariq.liga.common.ApiException;
import uz.payariq.liga.domain.TeamNames;

class ApplicationRulesTest {

    /** Vaqtni qo'lda surish mumkin bo'lgan soat */
    private static final class MovableClock extends Clock {
        private Instant now = Instant.parse("2026-10-28T10:15:00Z");

        void advance(Duration d) {
            now = now.plus(d);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    @Test
    @DisplayName("chegara: bitta IP manzildan soatiga N ta; boshqa manzil, boshqa tur va keyingi soat hisobga kirmaydi")
    void limiter() {
        MovableClock clock = new MovableClock();
        SubmissionLimiter limiter = new SubmissionLimiter(clock);
        for (int i = 0; i < 3; i++) limiter.acquire("team", "10.0.0.1", 3);
        assertThatThrownBy(() -> limiter.acquire("team", "10.0.0.1", 3))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS));
        limiter.acquire("team", "10.0.0.2", 3);
        limiter.acquire("feedback", "10.0.0.1", 3);
        clock.advance(Duration.ofHours(1));
        limiter.acquire("team", "10.0.0.1", 3);
    }

    @Test
    @DisplayName("jamoa nomlari: katta-kichik harf, o‘/g‘ tutuq belgisi va bo'shliqlar farq qilmaydi")
    void sameNames() {
        assertThat(TeamNames.same("Qo‘rg‘on", "  qo'rg'on ")).isTrue();
        assertThat(TeamNames.same("Qo’rg’on  Yoshlari", "QOʻRGʻON yoshlari")).isTrue();
        assertThat(TeamNames.same("Burgut", "Burgut-2")).isFalse();
        assertThat(TeamNames.clean("  Oltin   Soy ")).isEqualTo("Oltin Soy");
    }

    @Test
    @DisplayName("qisqa nom: dastlabki 3 ta harf, raqam va tutuq belgisi tashlanadi")
    void shortName() {
        assertThat(ApplicationService.shortName("Burgut")).isEqualTo("BUR");
        assertThat(ApplicationService.shortName("Qo‘rg‘on")).isEqualTo("QOR");
        assertThat(ApplicationService.shortName("FK 7")).isEqualTo("FK");
        assertThat(ApplicationService.shortName("77")).isEqualTo("JAM");
    }
}
