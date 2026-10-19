package uz.payariq.liga.telegram;

import java.time.Duration;
import java.util.Map;
import tools.jackson.databind.JsonNode;

/** Telegram Bot API: metod nomi va parametrlar → javobdagi "result" */
public interface TelegramApi {

    JsonNode call(String method, Map<String, Object> params, Duration timeout);

    default JsonNode call(String method, Map<String, Object> params) {
        return call(method, params, Duration.ofSeconds(20));
    }

    /** Telegram xatosi: kod va tavsif (token hech qachon xabarga kirmaydi) */
    class TelegramException extends RuntimeException {
        private final int code;

        public TelegramException(int code, String description) {
            super(description);
            this.code = code;
        }

        public int code() {
            return code;
        }
    }
}
