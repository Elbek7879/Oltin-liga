package uz.payariq.liga.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class LiveClockTest {

    private static final Instant START = Instant.parse("2026-10-19T10:00:00Z");

    @Test
    @DisplayName("daqiqa bo'lim boshlangan vaqtdan hisoblanadi (2 × 25 daqiqa)")
    void minutes() {
        assertThat(LiveClock.minute(LivePeriod.FIRST_HALF, START, 25, START)).isEqualTo(1);
        assertThat(LiveClock.minute(LivePeriod.FIRST_HALF, START, 25, START.plusSeconds(33 * 60 + 40))).isEqualTo(34);
        assertThat(LiveClock.minute(LivePeriod.HALF_TIME, START, 25, START.plusSeconds(600))).isEqualTo(25);
        assertThat(LiveClock.minute(LivePeriod.SECOND_HALF, START, 25, START.plusSeconds(10 * 60))).isEqualTo(36);
        assertThat(LiveClock.minute(LivePeriod.EXTRA_TIME, START, 25, START)).isEqualTo(51);
    }

    @Test
    @DisplayName("daqiqa 1 dan 130 gacha chegaralanadi")
    void bounds() {
        assertThat(LiveClock.minute(LivePeriod.FIRST_HALF, START, 25, START.minusSeconds(120))).isEqualTo(1);
        assertThat(LiveClock.minute(LivePeriod.SECOND_HALF, START, 45, START.plusSeconds(5 * 3600))).isEqualTo(130);
        assertThat(LiveClock.minute(null, null, 25, START)).isEqualTo(1);
    }
}
