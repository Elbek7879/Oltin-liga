package uz.payariq.liga.telegram;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.SmartLifecycle;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import uz.payariq.liga.telegram.TelegramApi.TelegramException;

/**
 * Botning doimiy ishlashi: server yoniq ekan, Telegram'dan yangi xabarlarni kutib turadi (long polling).
 * Domen ham, ochiq port ham kerak emas — server o'zi Telegram'ga ulanadi.
 * Aloqa uzilsa yoki Telegram vaqtincha javob bermasa, kutib, o'zi qayta ulanadi — hech qachon to'xtab qolmaydi.
 */
@Component
public class TelegramPoller implements SmartLifecycle {

    private static final Logger log = LoggerFactory.getLogger(TelegramPoller.class);
    private static final int POLL_SECONDS = 25;

    private final TelegramApi api;
    private final TelegramSettings settings;
    private final BotUpdateHandler handler;
    private volatile boolean running;
    private Thread thread;

    public TelegramPoller(TelegramApi api, TelegramSettings settings, BotUpdateHandler handler) {
        this.api = api;
        this.settings = settings;
        this.handler = handler;
    }

    @Override
    public void start() {
        if (!settings.active()) {
            log.info("Telegram bot o‘chiq: backend/.env faylida TELEGRAM_BOT_TOKEN kiritilmagan.");
            return;
        }
        if (!settings.polling()) return;
        running = true;
        thread = new Thread(this::loop, "telegram-bot");
        thread.setDaemon(true);
        thread.start();
    }

    @Override
    public void stop() {
        running = false;
        if (thread != null) thread.interrupt();
    }

    @Override
    public boolean isRunning() {
        return running;
    }

    private void loop() {
        prepare();
        long offset = 0;
        long backoff = 1;
        while (running) {
            try {
                JsonNode updates = api.call("getUpdates",
                        Map.of("offset", offset, "timeout", POLL_SECONDS, "allowed_updates", List.of("message", "callback_query")),
                        Duration.ofSeconds(POLL_SECONDS + 15));
                for (JsonNode u : updates) {
                    offset = u.path("update_id").asLong() + 1;
                    try {
                        handler.handle(u);
                    } catch (RuntimeException e) {
                        log.warn("Telegram xabarini qayta ishlashda xato: {}", e.toString());
                    }
                }
                backoff = 1;
            } catch (TelegramException e) {
                if (!running) return;
                if (e.code() == 401 || e.code() == 404) {
                    log.error("Telegram bot tokeni noto‘g‘ri. backend/.env faylidagi TELEGRAM_BOT_TOKEN ni tekshiring. Bir daqiqadan keyin qayta uriniladi.");
                    sleep(60);
                } else if (e.code() == 409) {
                    log.warn("Shu bot boshqa joyda ham ishga tushirilgan (bir vaqtda faqat bitta server ishlashi kerak). Qayta uriniladi.");
                    sleep(15);
                } else {
                    log.warn("Telegram bilan aloqa: {}. {} soniyadan keyin qayta ulaniladi.", e.getMessage(), backoff);
                    sleep(backoff);
                    backoff = Math.min(backoff * 2, 30);
                }
            } catch (RuntimeException e) {
                if (!running) return;
                log.warn("Telegram bot: kutilmagan xato {}. Qayta ulaniladi.", e.toString());
                sleep(backoff);
                backoff = Math.min(backoff * 2, 30);
            }
        }
    }

    /** Ishga tushganda: eski webhook o'chiriladi va bot buyruqlari menyusi yoziladi */
    private void prepare() {
        try {
            api.call("deleteWebhook", Map.of("drop_pending_updates", false));
            api.call("setMyCommands", Map.of("commands", List.of(
                    Map.of("command", "start", "description", "Bugungi o‘yinlar"),
                    Map.of("command", "jonli", "description", "Jonli o‘yin paneli"))));
            log.info("Telegram bot ishga tushdi (@{}).", settings.username().isEmpty() ? "?" : settings.username());
        } catch (TelegramException e) {
            log.warn("Telegram botni tayyorlashda xato: {}", e.getMessage());
        }
    }

    private void sleep(long seconds) {
        try {
            Thread.sleep(seconds * 1000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            running = false;
        }
    }
}
