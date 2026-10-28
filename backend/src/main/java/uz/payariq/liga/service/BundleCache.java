package uz.payariq.liga.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import uz.payariq.liga.web.Dto.SeasonBundle;

/**
 * Muxlislar uchun mavsum ma'lumotlarining qisqa (2 soniyalik) keshi. Gol paytida yuzlab ochiq sahifa bir vaqtda
 * qayta so'raganda jadval va statistika har biri uchun qaytadan hisoblanmaydi: birinchi so'rov hisoblaydi,
 * qolganlari tayyor natijani oladi. Har qanday o'zgarish saqlanishi bilan (jonli xabar yuborilishidan oldin)
 * kesh tozalanadi. Tashkilotchilar har doim yangi ma'lumot oladi (kesh faqat tizimga kirmaganlar uchun).
 */
@Component
public class BundleCache {

    static final Duration TTL = Duration.ofSeconds(2);

    private record Entry(SeasonBundle bundle, Instant at, long generation) {
    }

    private final Map<UUID, Entry> cache = new ConcurrentHashMap<>();
    private final Map<UUID, Object> locks = new ConcurrentHashMap<>();
    /** Har tozalashda oshadi: hisoblash davomida o'zgarish bo'lsa, eskirgan natija keshga tushmaydi */
    private final AtomicLong generation = new AtomicLong();
    private final Clock clock;

    public BundleCache(Clock clock) {
        this.clock = clock;
    }

    public SeasonBundle get(UUID seasonId, Supplier<SeasonBundle> load) {
        Entry hit = fresh(seasonId);
        if (hit != null) return hit.bundle();
        synchronized (locks.computeIfAbsent(seasonId, k -> new Object())) {
            hit = fresh(seasonId);
            if (hit != null) return hit.bundle();
            long started = generation.get();
            SeasonBundle bundle = load.get();
            if (generation.get() == started) cache.put(seasonId, new Entry(bundle, clock.instant(), started));
            return bundle;
        }
    }

    /** Ma'lumot o'zgardi — keyingi so'rov yangidan hisoblaydi */
    public void evictAll() {
        generation.incrementAndGet();
        cache.clear();
    }

    /** O'zgarish tranzaksiyasi yakunlangach tozalaydi (tranzaksiyadan tashqarida — darhol) */
    public void evictAllAfterCommit() {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            evictAll();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                evictAll();
            }
        });
    }

    private Entry fresh(UUID seasonId) {
        Entry e = cache.get(seasonId);
        if (e == null || e.generation() != generation.get() || !e.at().plus(TTL).isAfter(clock.instant())) return null;
        return e;
    }
}
