package uz.payariq.liga.service;

import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import tools.jackson.databind.ObjectMapper;

/**
 * Saytga jonli yangilanishlar (Server-Sent Events). Natija saqlanishi bilan (saytdan yoki Telegram botdan)
 * barcha ochiq sahifalarga qisqa xabar boradi — sahifa ma'lumotni darhol qayta oladi.
 * Xabar faqat tranzaksiya muvaffaqiyatli yakunlangach yuboriladi.
 */
@Component
public class LiveUpdates {

    private static final Logger log = LoggerFactory.getLogger(LiveUpdates.class);
    private static final long TIMEOUT = Duration.ofMinutes(30).toMillis();
    /** Bir vaqtda ulanishlar chegarasi (server resursini himoya qilish uchun) */
    private static final int MAX_CLIENTS = 5000;

    /**
     * Nima o'zgardi: START — o'yin boshlandi, GOAL — gol (side: home/away), FINISH — yakunlandi, UPDATE — boshqa o'zgarish
     */
    public record LiveEvent(UUID seasonId, UUID matchId, String kind, String side) {
    }

    private final Set<SseEmitter> emitters = ConcurrentHashMap.newKeySet();
    private final ScheduledExecutorService worker = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "live-updates");
        t.setDaemon(true);
        return t;
    });
    private final ObjectMapper json;
    private final BundleCache bundles;

    public LiveUpdates(ObjectMapper json, BundleCache bundles) {
        this.json = json;
        this.bundles = bundles;
        // Proksi va brauzer ulanishni uzib qo'ymasligi uchun har 25 soniyada bo'sh xabar
        worker.scheduleAtFixedRate(() -> broadcast(() -> SseEmitter.event().comment("ping")), 25, 25, TimeUnit.SECONDS);
    }

    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(TIMEOUT);
        if (emitters.size() >= MAX_CLIENTS) {
            emitter.complete();
            return emitter;
        }
        emitters.add(emitter);
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> {
            emitters.remove(emitter);
            emitter.complete();
        });
        emitter.onError(e -> emitters.remove(emitter));
        try {
            // Uzilsa, brauzer 5 soniyadan keyin o'zi qayta ulanadi
            emitter.send(SseEmitter.event().name("hello").reconnectTime(5000).data("ok"));
        } catch (IOException e) {
            emitters.remove(emitter);
        }
        return emitter;
    }

    @TransactionalEventListener(fallbackExecution = true)
    public void on(LiveEvent event) {
        // Avval kesh tozalanadi, keyin xabar yuboriladi — sahifalar qayta so'raganda yangi ma'lumot oladi
        bundles.evictAll();
        String data = json.writeValueAsString(Map.of(
                "seasonId", event.seasonId().toString(),
                "matchId", event.matchId().toString(),
                "kind", event.kind(),
                "side", event.side() == null ? "" : event.side()));
        worker.execute(() -> broadcast(() -> SseEmitter.event().name("match").data(data, MediaType.APPLICATION_JSON)));
    }

    int clients() {
        return emitters.size();
    }

    /** Har bir ulanish uchun yangi xabar quriladi (SseEventBuilder qayta ishlatilmaydi) */
    private void broadcast(Supplier<SseEmitter.SseEventBuilder> event) {
        for (SseEmitter e : emitters) {
            try {
                e.send(event.get());
            } catch (IOException | IllegalStateException ex) {
                emitters.remove(e);
                log.debug("Jonli ulanish yopildi: {}", ex.getClass().getSimpleName());
            }
        }
    }

    @PreDestroy
    void shutdown() {
        worker.shutdownNow();
        emitters.forEach(SseEmitter::complete);
        emitters.clear();
    }
}
