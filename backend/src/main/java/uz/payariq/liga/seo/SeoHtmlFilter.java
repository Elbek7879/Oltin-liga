package uz.payariq.liga.seo;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import org.springframework.web.util.HtmlUtils;
import org.springframework.web.util.UrlPathHelper;
import tools.jackson.databind.ObjectMapper;
import uz.payariq.liga.config.SpaConfig;
import uz.payariq.liga.model.LeagueSettings;
import uz.payariq.liga.seo.SeoService.PageMeta;

/**
 * Sayt sahifasi so'ralganda (production'da index.html shu jar ichida) sahifa boshidagi SEO blokini
 * («seo:start» … «seo:end») shu sahifaning nomi, tavsifi va havolalari bilan almashtiradi.
 * Shunda Google va Telegram sahifani JavaScript'siz ham to'g'ri nom bilan ko'radi.
 * Mavjud bo'lmagan sahifa 404, admin panel esa «noindex» bilan qaytadi.
 * index.html bo'lmasa (ishlab chiqishda frontend Vite orqali ochiladi) filtr hech narsa qilmaydi.
 */
@Component
public class SeoHtmlFilter extends OncePerRequestFilter {

    private static final Pattern BLOCK = Pattern.compile("<!-- seo:start.*?<!-- seo:end -->", Pattern.DOTALL);
    private static final UrlPathHelper PATHS = new UrlPathHelper();

    private final SeoService seo;
    private final ObjectMapper json;

    public SeoHtmlFilter(SeoService seo, ObjectMapper json) {
        this.seo = seo;
        this.json = json;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String method = request.getMethod();
        if (!"GET".equals(method) && !"HEAD".equals(method)) return true;
        String path = PATHS.getPathWithinApplication(request);
        return !SpaConfig.SpaFallbackResolver.isAppRoute(path.startsWith("/") ? path.substring(1) : path);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        String template = template();
        if (template == null || !BLOCK.matcher(template).find()) {
            chain.doFilter(request, response);
            return;
        }
        PageMeta meta = seo.resolve(PATHS.getPathWithinApplication(request));
        String base = ServletUriComponentsBuilder.fromContextPath(request).replaceQuery(null).build().toUriString();
        String html = BLOCK.matcher(template).replaceFirst(Matcher.quoteReplacement(head(meta, base)));
        byte[] body = html.getBytes(StandardCharsets.UTF_8);
        response.setStatus(meta.status());
        response.setContentType("text/html;charset=UTF-8");
        response.setHeader("Cache-Control", "no-cache");
        if (meta.noindex()) response.setHeader("X-Robots-Tag", "noindex");
        response.setContentLength(body.length);
        response.getOutputStream().write(body);
    }

    /** index.html har safar o'qiladi (fayl kichik): yangi frontend nusxasi server qayta yoqilmasdan ishlaydi */
    private static String template() throws IOException {
        ClassPathResource index = new ClassPathResource("static/index.html");
        if (!index.exists()) return null;
        try (InputStream in = index.getInputStream()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    String head(PageMeta meta, String base) {
        String url = base + meta.path();
        String league = seo.league();
        StringBuilder h = new StringBuilder();
        h.append("<title>").append(esc(meta.title())).append("</title>\n");
        h.append("    <meta name=\"description\" content=\"").append(esc(meta.description())).append("\" />\n");
        if (meta.noindex()) h.append("    <meta name=\"robots\" content=\"noindex\" />\n");
        else h.append("    <link rel=\"canonical\" href=\"").append(esc(url)).append("\" />\n");
        h.append("    <meta property=\"og:type\" content=\"website\" />\n");
        h.append("    <meta property=\"og:site_name\" content=\"").append(esc(league)).append("\" />\n");
        h.append("    <meta property=\"og:title\" content=\"").append(esc(meta.title())).append("\" />\n");
        h.append("    <meta property=\"og:description\" content=\"").append(esc(meta.description())).append("\" />\n");
        h.append("    <meta property=\"og:url\" content=\"").append(esc(url)).append("\" />\n");
        h.append("    <meta property=\"og:image\" content=\"").append(esc(base + "/og-image.jpg")).append("\" />\n");
        h.append("    <meta property=\"og:image:width\" content=\"1200\" />\n");
        h.append("    <meta property=\"og:image:height\" content=\"630\" />\n");
        h.append("    <meta name=\"twitter:card\" content=\"summary_large_image\" />");
        if (meta.home()) h.append("\n    <script type=\"application/ld+json\">").append(organization(base, league)).append("</script>");
        return h.toString();
    }

    /** Bosh sahifa uchun tuzilgan ma'lumot: Google ligani tashkilot sifatida taniydi */
    private String organization(String base, String league) {
        LeagueSettings s = seo.leagueSettings().orElse(null);
        Map<String, Object> org = new LinkedHashMap<>();
        org.put("@context", "https://schema.org");
        org.put("@type", "SportsOrganization");
        org.put("name", league);
        org.put("sport", "Football");
        org.put("url", base + "/");
        org.put("logo", base + "/brand/icon-512.png");
        if (s != null) {
            if (s.region != null && !s.region.isBlank()) org.put("areaServed", s.region);
            if (s.contactPhone != null && !s.contactPhone.isBlank()) org.put("telephone", s.contactPhone);
            List<String> same = new ArrayList<>();
            for (String link : new String[] {s.telegramChannel, s.instagram, s.youtube}) if (link != null && link.startsWith("https://")) same.add(link);
            if (!same.isEmpty()) org.put("sameAs", same);
        }
        // «</» skript ichida yopuvchi teg bo'lib qolmasin
        return json.writeValueAsString(org).replace("</", "<\\/");
    }

    private static String esc(String s) {
        return HtmlUtils.htmlEscape(s == null ? "" : s, StandardCharsets.UTF_8.name());
    }
}
