package uz.payariq.liga.telegram;

/** Amal Telegram bot orqali bajarilayotganini bildiradi (o'zgarishlar tarixida «Telegram» deb yoziladi) */
public final class BotContext {

    private static final ThreadLocal<Boolean> ACTIVE = new ThreadLocal<>();

    private BotContext() {
    }

    static void enter() {
        ACTIVE.set(Boolean.TRUE);
    }

    static void exit() {
        ACTIVE.remove();
    }

    public static boolean active() {
        return Boolean.TRUE.equals(ACTIVE.get());
    }
}
