package uz.payariq.liga.telegram;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import uz.payariq.liga.telegram.TelegramApi.TelegramException;

/** Xabar yuborish, tahrirlash va tugmalar — Bot API ustidagi qulay qatlam */
@Component
public class TelegramBot {

    private static final Logger log = LoggerFactory.getLogger(TelegramBot.class);

    /** Asosiy menyu tugmalari (klaviatura o'rnida doim turadi) */
    public static final String MENU_TODAY = "Bugungi o‘yinlar";
    public static final String MENU_LIVE = "Jonli o‘yin";

    private final TelegramApi api;

    public TelegramBot(TelegramApi api) {
        this.api = api;
    }

    /** Inline tugmalar: qatorlar ro'yxati */
    public static final class Keyboard {
        private final List<List<Map<String, String>>> rows = new ArrayList<>();

        public Keyboard row(Button... buttons) {
            List<Map<String, String>> row = new ArrayList<>();
            for (Button b : buttons) if (b != null) row.add(Map.of("text", b.text(), "callback_data", b.data()));
            if (!row.isEmpty()) rows.add(row);
            return this;
        }

        /** Tugmalarni n tadan qatorlarga taqsimlaydi */
        public Keyboard grid(List<Button> buttons, int perRow) {
            for (int i = 0; i < buttons.size(); i += perRow) row(buttons.subList(i, Math.min(buttons.size(), i + perRow)).toArray(Button[]::new));
            return this;
        }

        Map<String, Object> markup() {
            return Map.of("inline_keyboard", rows);
        }
    }

    public record Button(String text, String data) {
    }

    /** Pastda doim turadigan asosiy menyu */
    public static Map<String, Object> mainMenu() {
        return Map.of(
                "keyboard", List.of(List.of(Map.of("text", MENU_TODAY), Map.of("text", MENU_LIVE))),
                "resize_keyboard", true,
                "is_persistent", true);
    }

    public long send(long chatId, String html, Keyboard keyboard) {
        return send(chatId, html, keyboard == null ? null : keyboard.markup());
    }

    public long send(long chatId, String html, Map<String, Object> replyMarkup) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("chat_id", chatId);
        p.put("text", html);
        p.put("parse_mode", "HTML");
        p.put("link_preview_options", Map.of("is_disabled", true));
        if (replyMarkup != null) p.put("reply_markup", replyMarkup);
        JsonNode res = api.call("sendMessage", p);
        return res.path("message_id").asLong();
    }

    /** Xabarni joyida yangilaydi; eski (tahrirlab bo'lmaydigan) xabar bo'lsa — yangisini yuboradi */
    public void edit(long chatId, long messageId, String html, Keyboard keyboard) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("chat_id", chatId);
        p.put("message_id", messageId);
        p.put("text", html);
        p.put("parse_mode", "HTML");
        p.put("link_preview_options", Map.of("is_disabled", true));
        if (keyboard != null) p.put("reply_markup", keyboard.markup());
        try {
            api.call("editMessageText", p);
        } catch (TelegramException e) {
            String d = e.getMessage() == null ? "" : e.getMessage();
            if (d.contains("message is not modified")) return;
            log.debug("Xabarni tahrirlab bo‘lmadi ({}), yangisi yuboriladi", d);
            send(chatId, html, keyboard);
        }
    }

    public void answer(String callbackId, String text, boolean alert) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("callback_query_id", callbackId);
        if (text != null) p.put("text", text.length() > 190 ? text.substring(0, 187) + "..." : text);
        p.put("show_alert", alert);
        try {
            api.call("answerCallbackQuery", p);
        } catch (TelegramException e) {
            log.debug("Tugma javobi yuborilmadi: {}", e.getMessage());
        }
    }

    /** HTML belgilaridan himoya (jamoa va futbolchi nomlari uchun) */
    public static String esc(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
