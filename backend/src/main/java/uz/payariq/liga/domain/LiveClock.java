package uz.payariq.liga.domain;

import java.time.Duration;
import java.time.Instant;

/**
 * Jonli o'yin soati. Admin har bir bo'limni boshlaganda vaqt yoziladi, daqiqa esa shundan hisoblanadi:
 * 1-bo'lim 1-daqiqadan, 2-bo'lim (bo'lim davomiyligi + 1)-daqiqadan, qo'shimcha vaqt (2 × bo'lim + 1)-daqiqadan.
 */
public final class LiveClock {

    public static final int MAX_MINUTE = 130;

    private LiveClock() {
    }

    public static int minute(LivePeriod period, Instant startedAt, int halfMinutes, Instant now) {
        if (period == null) return 1;
        long elapsed = startedAt == null ? 0 : Math.max(0, Duration.between(startedAt, now).toMinutes());
        long minute = switch (period) {
            case FIRST_HALF -> 1 + elapsed;
            case HALF_TIME -> halfMinutes;
            case SECOND_HALF -> halfMinutes + 1 + elapsed;
            case EXTRA_TIME -> 2L * halfMinutes + 1 + elapsed;
            case PENALTIES -> 2L * halfMinutes;
        };
        return (int) Math.max(1, Math.min(MAX_MINUTE, minute));
    }
}
