package uz.payariq.liga.seo;

import jakarta.servlet.http.HttpServletRequest;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.HtmlUtils;

/**
 * robots.txt va sitemap.xml — qidiruv tizimlari uchun. Manzillar SITE_URL sozlamasidan olinadi
 * (bo'sh bo'lsa — sayt qaysi domenda ochilgan bo'lsa, o'sha domendan).
 */
@RestController
public class SitemapController {

    private final SeoService seo;
    private final SiteUrl site;

    public SitemapController(SeoService seo, SiteUrl site) {
        this.seo = seo;
        this.site = site;
    }

    @GetMapping(value = "/robots.txt", produces = "text/plain;charset=UTF-8")
    public String robots(HttpServletRequest request) {
        return """
                User-agent: *
                Allow: /
                Disallow: /admin
                Disallow: /api/

                Sitemap: %s/sitemap.xml
                """.formatted(base(request));
    }

    @GetMapping(value = "/sitemap.xml", produces = MediaType.APPLICATION_XML_VALUE)
    public String sitemap(HttpServletRequest request) {
        String base = base(request);
        StringBuilder xml = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");
        for (SeoService.SitemapEntry e : seo.sitemap()) {
            xml.append("  <url><loc>").append(HtmlUtils.htmlEscape(base + e.path())).append("</loc>");
            if (e.lastModified() != null) {
                xml.append("<lastmod>").append(DateTimeFormatter.ISO_LOCAL_DATE.format(e.lastModified().atOffset(ZoneOffset.UTC))).append("</lastmod>");
            }
            xml.append("</url>\n");
        }
        return xml.append("</urlset>\n").toString();
    }

    private String base(HttpServletRequest request) {
        return site.base(request);
    }
}
