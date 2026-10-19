package uz.payariq.liga.telegram;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Bot sozlamalari backend/.env faylidan: TELEGRAM_BOT_TOKEN va TELEGRAM_BOT_USERNAME.
 * Token hech qayerda (jurnal, javob, xato xabari) ko'rsatilmaydi.
 */
@Component
public class TelegramSettings {

    private final String token;
    private final String username;
    private final boolean enabled;
    private final boolean polling;

    public TelegramSettings(@Value("${liga.telegram.token:}") String token,
                            @Value("${liga.telegram.username:}") String username,
                            @Value("${liga.telegram.enabled:true}") boolean enabled,
                            @Value("${liga.telegram.polling:true}") boolean polling) {
        this.token = token == null ? "" : token.trim();
        this.username = username == null ? "" : username.trim().replaceFirst("^@", "");
        this.enabled = enabled;
        this.polling = polling;
    }

    /** Telegram'dan xabarlarni kutib turish (testlarda o'chiriladi) */
    public boolean polling() {
        return polling;
    }

    /** Bot ishlaydimi: yoqilgan va token kiritilgan */
    public boolean active() {
        return enabled && !token.isEmpty();
    }

    public String username() {
        return username;
    }

    String token() {
        return token;
    }
}
