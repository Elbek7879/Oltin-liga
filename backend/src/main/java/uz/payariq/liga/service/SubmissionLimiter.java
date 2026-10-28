package uz.payariq.liga.service;

import java.time.Clock;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import uz.payariq.liga.common.ApiException;

/**
 * Saytdan yuboriladigan arizalar va murojaatlar uchun chegara: bitta IP manzildan bir soatda ko'pi bilan N ta.
 * Skript bilan yuzlab soxta ariza yuborib, admin ro'yxatini to'ldirib tashlashdan himoya.
 */
@Component
public class SubmissionLimiter {

    private static final long HOUR_MS = 3_600_000;
    private static final int PURGE_THRESHOLD = 10_000;

    private record Window(long hour, int count) {
    }

    private final Map<String, Window> windows = new ConcurrentHashMap<>();
    private final AtomicLong lastPurgeHour = new AtomicLong();
    private final Clock clock;

    public SubmissionLimiter(Clock clock) {
        this.clock = clock;
    }

    /** Chegara oshgan bo'lsa 429 xato bilan to'xtatadi; aks holda yuborishni hisobga oladi */
    public void acquire(String kind, String ip, int perHour) {
        long hour = clock.millis() / HOUR_MS;
        Window w = windows.merge(kind + "|" + (ip == null ? "" : ip), new Window(hour, 1),
                (old, n) -> old.hour() == hour ? new Window(hour, old.count() + 1) : n);
        // O'tgan soatlar yozuvlari tozalanadi (eng ko'pi bilan soatiga bir marta) — xotira cheksiz o'smaydi
        long last = lastPurgeHour.get();
        if (windows.size() > PURGE_THRESHOLD && last < hour && lastPurgeHour.compareAndSet(last, hour)) {
            windows.entrySet().removeIf(e -> e.getValue().hour() < hour);
        }
        if (w.count() > perHour) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Bu qurilmadan juda ko‘p murojaat yuborildi. Bir soatdan keyin qayta urinib ko‘ring.");
        }
    }
}
