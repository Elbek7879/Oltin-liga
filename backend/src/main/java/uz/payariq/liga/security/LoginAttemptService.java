package uz.payariq.liga.security;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import uz.payariq.liga.common.ApiException;

/**
 * Parolni taxmin qilishdan himoya (15 daqiqalik oyna):
 * - bitta login + bitta IP: 5 ta xato urinishdan keyin vaqtincha bloklanadi;
 * - bitta login, istalgan IP'dan: 10 ta xato — IP manzilini almashtirib taxmin qilishga qarshi.
 * Muddati o'tgan yozuvlar vaqti-vaqti bilan tozalanadi — xotira cheksiz o'smaydi.
 */
@Service
public class LoginAttemptService {

    static final int MAX_FAILURES = 5;
    static final int MAX_FAILURES_PER_USER = 10;
    static final Duration WINDOW = Duration.ofMinutes(15);
    /** Yozuvlar shundan ko'p bo'lsa, muddati o'tganlari tozalanadi (eng ko'pi bilan daqiqasiga bir marta) */
    private static final int PURGE_THRESHOLD = 1_000;
    private static final Duration PURGE_EVERY = Duration.ofMinutes(1);

    private record Attempts(int failures, Instant firstFailure) {
    }

    private final Map<String, Attempts> attempts = new ConcurrentHashMap<>();
    private final AtomicReference<Instant> lastPurge = new AtomicReference<>(Instant.EPOCH);
    private final Clock clock;

    public LoginAttemptService(Clock clock) {
        this.clock = clock;
    }

    public void checkAllowed(String username, String ip) {
        Instant now = clock.instant();
        if (blocked(ipKey(username, ip), MAX_FAILURES, now) || blocked(userKey(username), MAX_FAILURES_PER_USER, now)) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Juda ko‘p noto‘g‘ri urinish. 15 daqiqadan keyin qayta urinib ko‘ring.");
        }
    }

    public void recordFailure(String username, String ip) {
        Instant now = clock.instant();
        increment(ipKey(username, ip), now);
        increment(userKey(username), now);
        purgeExpired(now);
    }

    public void recordSuccess(String username, String ip) {
        attempts.remove(ipKey(username, ip));
        attempts.remove(userKey(username));
    }

    int size() {
        return attempts.size();
    }

    private boolean blocked(String key, int limit, Instant now) {
        Attempts a = attempts.get(key);
        if (a == null) return false;
        if (expired(a, now)) {
            attempts.remove(key, a);
            return false;
        }
        return a.failures() >= limit;
    }

    private void increment(String key, Instant now) {
        attempts.merge(key, new Attempts(1, now), (old, n) -> expired(old, now) ? n : new Attempts(old.failures() + 1, old.firstFailure()));
    }

    private void purgeExpired(Instant now) {
        if (attempts.size() < PURGE_THRESHOLD) return;
        Instant last = lastPurge.get();
        if (last.plus(PURGE_EVERY).isAfter(now) || !lastPurge.compareAndSet(last, now)) return;
        attempts.entrySet().removeIf(e -> expired(e.getValue(), now));
    }

    private static boolean expired(Attempts a, Instant now) {
        return a.firstFailure().plus(WINDOW).isBefore(now);
    }

    private static String userKey(String username) {
        return "user:" + normalize(username);
    }

    private static String ipKey(String username, String ip) {
        return normalize(username) + "|" + ip;
    }

    private static String normalize(String username) {
        return username == null ? "" : username.trim().toLowerCase(Locale.ROOT);
    }
}
