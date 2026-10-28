package uz.payariq.liga.domain;

import java.util.Locale;

/**
 * Jamoa va futbolchi nomlarini taqqoslash. «Qo'rg'on», «qo‘rg‘on» va «Qo‘rg‘on » bitta nom hisoblanadi —
 * katta-kichik harf, o‘/g‘ tutuq belgisining turli yozilishi va ortiqcha bo'shliqlar farq qilmaydi.
 */
public final class TeamNames {

    private TeamNames() {
    }

    /** Ortiqcha bo'shliqlar olib tashlanadi */
    public static String clean(String s) {
        return s == null ? "" : s.strip().replaceAll("\\s+", " ");
    }

    /** Taqqoslash kaliti */
    public static String key(String s) {
        return clean(s).toLowerCase(Locale.ROOT).replaceAll("[‘’ʻʼ`´]", "'");
    }

    public static boolean same(String a, String b) {
        return key(a).equals(key(b));
    }
}
