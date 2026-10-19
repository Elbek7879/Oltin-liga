package uz.payariq.liga.security;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import uz.payariq.liga.common.ApiException;

/** Parolni taxmin qilishdan himoya: 15 daqiqada 5 ta xato urinishdan keyin vaqtincha bloklanadi */
@Service
public class LoginAttemptService {

    static final int MAX_FAILURES = 5;
    static final Duration WINDOW = Duration.ofMinutes(15);

    private record Attempts(int failures, Instant firstFailure) {
    }

    private final Map<String, Attempts> attempts = new ConcurrentHashMap<>();
    private final Clock clock;

    public LoginAttemptService(Clock clock) {
        this.clock = clock;
    }

    public void checkAllowed(String key) {
        Attempts a = attempts.get(key);
        if (a == null) return;
        if (a.firstFailure().plus(WINDOW).isBefore(clock.instant())) {
            attempts.remove(key);
            return;
        }
        if (a.failures() >= MAX_FAILURES) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Juda ko‘p noto‘g‘ri urinish. 15 daqiqadan keyin qayta urinib ko‘ring.");
        }
    }

    public void recordFailure(String key) {
        Instant now = clock.instant();
        attempts.merge(key, new Attempts(1, now), (old, n) ->
                old.firstFailure().plus(WINDOW).isBefore(now) ? n : new Attempts(old.failures() + 1, old.firstFailure()));
    }

    public void recordSuccess(String key) {
        attempts.remove(key);
    }
}
