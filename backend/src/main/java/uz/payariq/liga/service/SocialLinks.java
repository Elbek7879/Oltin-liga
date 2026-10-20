package uz.payariq.liga.service;

import java.util.regex.Matcher;
import java.util.regex.Pattern;
import uz.payariq.liga.common.ApiException;

/**
 * Ijtimoiy tarmoq havolalarini bir xil ko'rinishga keltiradi: tashkilotchi «@kanal», «t.me/kanal» yoki to'liq havola
 * kiritishi mumkin — saqlanadigani doim https:// bilan boshlanadigan to'liq havola. Boshqa saytga havola qabul qilinmaydi.
 * Frontenddagi lib/social.ts bilan bir xil qoida.
 */
final class SocialLinks {

    private static final Pattern TELEGRAM = Pattern.compile("^(?:https?://)?(?:www\\.)?(?:t\\.me|telegram\\.me)/([A-Za-z0-9_]{4,64})/?$|^@?([A-Za-z0-9_]{4,64})$");
    private static final Pattern INSTAGRAM = Pattern.compile("^(?:https?://)?(?:www\\.)?instagram\\.com/([A-Za-z0-9_.]{1,40})/?(?:\\?.*)?$|^@?([A-Za-z0-9_.]{1,40})$");
    private static final Pattern YOUTUBE = Pattern.compile(
            "^(?:https?://)?(?:www\\.|m\\.)?youtube\\.com/(@[A-Za-z0-9_.-]{3,40}|channel/[A-Za-z0-9_-]{10,40}|c/[A-Za-z0-9_.-]{1,60})/?(?:\\?.*)?$|^(@[A-Za-z0-9_.-]{3,40})$");

    private SocialLinks() {
    }

    static String telegram(String raw) {
        String name = match(TELEGRAM, raw, "Telegram kanal havolasini t.me/kanal_nomi ko‘rinishida kiriting.");
        return name.isEmpty() ? "" : "https://t.me/" + name;
    }

    static String instagram(String raw) {
        String name = match(INSTAGRAM, raw, "Instagram havolasini instagram.com/sahifa_nomi ko‘rinishida kiriting.");
        return name.isEmpty() ? "" : "https://www.instagram.com/" + name + "/";
    }

    static String youtube(String raw) {
        String path = match(YOUTUBE, raw, "YouTube havolasini youtube.com/@kanal_nomi ko‘rinishida kiriting.");
        return path.isEmpty() ? "" : "https://www.youtube.com/" + path;
    }

    private static String match(Pattern pattern, String raw, String error) {
        if (raw == null || raw.isBlank()) return "";
        Matcher m = pattern.matcher(raw.trim());
        if (!m.matches()) throw ApiException.badRequest(error);
        return m.group(1) != null ? m.group(1) : m.group(2);
    }
}
