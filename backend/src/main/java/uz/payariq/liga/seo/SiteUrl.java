package uz.payariq.liga.seo;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

/**
 * Saytning tashqi manzili (canonical, og:url, sitemap uchun). Production'da SITE_URL sozlamasidan olinadi —
 * so'rov sarlavhalari (Host, Forwarded) orqali begona domenni qo'yib bo'lmaydi. Sozlama bo'sh bo'lsa
 * (lokal ishlab chiqish), so'rov kelgan manzil ishlatiladi.
 */
@Component
public class SiteUrl {

    private final String configured;

    public SiteUrl(@Value("${liga.site-url:}") String configured) {
        this.configured = configured == null ? "" : configured.trim().replaceAll("/+$", "");
    }

    public String base(HttpServletRequest request) {
        if (!configured.isEmpty()) return configured;
        return ServletUriComponentsBuilder.fromContextPath(request).replaceQuery(null).build().toUriString();
    }
}
