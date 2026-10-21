package uz.payariq.liga.service;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import uz.payariq.liga.domain.Schedule;
import uz.payariq.liga.seo.SeoService;
import uz.payariq.liga.seo.SeoService.PageMeta;
import uz.payariq.liga.web.Dto.VisitCount;
import uz.payariq.liga.web.Dto.VisitDay;
import uz.payariq.liga.web.Dto.VisitPage;
import uz.payariq.liga.web.Dto.VisitShare;
import uz.payariq.liga.web.Dto.VisitStats;
import uz.payariq.liga.web.Requests;

/**
 * Tashrif statistikasi. Muxlis brauzeridagi tasodifiy anonim raqamning faqat xeshi saqlanadi —
 * ism, telefon, IP yoki brauzer ma'lumoti yozilmaydi. Robotlar, admin panel, mavjud bo'lmagan
 * sahifalar va tizimga kirgan tashkilotchilar sanalmaydi (oxirgisini controller tekshiradi).
 */
@Service
public class VisitService {

    /** Bir odam kuniga shundan ko'p sahifa ochsa, ortig'i sanalmaydi (soxta hisobdan himoya) */
    static final int MAX_VIEWS_PER_DAY = 300;
    private static final int TOP_PAGES = 10;
    private static final Pattern VISITOR = Pattern.compile("^[0-9a-fA-F-]{36}$");
    private static final Pattern BOT = Pattern.compile(
            "bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|whatsapp|curl|wget|python|okhttp|go-http|java/",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern PHONE = Pattern.compile("mobi|android|iphone|ipad|ipod", Pattern.CASE_INSENSITIVE);

    private final JdbcTemplate jdbc;
    private final SeoService seo;
    private final Clock clock;

    public VisitService(JdbcTemplate jdbc, SeoService seo, Clock clock) {
        this.jdbc = jdbc;
        this.seo = seo;
        this.clock = clock;
    }

    private LocalDate today() {
        return LocalDate.ofInstant(clock.instant(), Schedule.ZONE);
    }

    /** Sahifa ochilishini yozadi; noto'g'ri yoki keraksiz so'rov jimgina e'tiborsiz qoldiriladi */
    public void record(Requests.Visit in, String userAgent, String ownHost) {
        if (in == null || in.visitor() == null || !VISITOR.matcher(in.visitor()).matches()) return;
        if (userAgent == null || userAgent.isBlank() || BOT.matcher(userAgent).find()) return;
        String raw = in.path() == null ? "/" : in.path().split("[?#]", 2)[0];
        if (raw.length() > 200) return;
        PageMeta page = seo.resolve(raw);
        if (page.status() != 200 || page.noindex()) return;

        LocalDate day = today();
        Integer views = jdbc.queryForObject("""
                insert into visit_days (day, visitor, source, device, views) values (?, ?, ?, ?, 1)
                on conflict (day, visitor) do update set views = visit_days.views + 1,
                    source = case when visit_days.source = 'direct' then excluded.source else visit_days.source end
                returning views""", Integer.class, day, hash(in.visitor()), source(in.referrer(), ownHost), device(userAgent));
        if (views == null || views > MAX_VIEWS_PER_DAY) return;
        jdbc.update("""
                insert into visit_pages (day, path, views) values (?, ?, 1)
                on conflict (day, path) do update set views = visit_pages.views + 1""", day, page.path());
    }

    /** Qayerdan kelgani: ijtimoiy tarmoq, qidiruv tizimi, boshqa sayt yoki to'g'ridan-to'g'ri */
    static String source(String referrer, String ownHost) {
        if (referrer == null || referrer.isBlank() || referrer.length() > 500) return "direct";
        String host;
        try {
            host = URI.create(referrer.trim()).getHost();
        } catch (IllegalArgumentException e) {
            return "other";
        }
        if (host == null) return "direct";
        host = host.toLowerCase(Locale.ROOT);
        if (ownHost != null && (host.equals(ownHost.toLowerCase(Locale.ROOT)) || host.equals("www." + ownHost.toLowerCase(Locale.ROOT)))) return "direct";
        if (host.equals("t.me") || host.contains("telegram")) return "telegram";
        if (host.contains("instagram")) return "instagram";
        if (host.contains("google")) return "google";
        if (host.contains("yandex") || host.equals("ya.ru")) return "yandex";
        if (host.contains("youtube") || host.equals("youtu.be")) return "youtube";
        if (host.contains("facebook") || host.equals("fb.com")) return "facebook";
        return "other";
    }

    static String device(String userAgent) {
        return PHONE.matcher(userAgent).find() ? "phone" : "desktop";
    }

    /** Brauzerdagi raqamning o'zi ham saqlanmaydi — faqat xeshi */
    static String hash(String visitor) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(visitor.toLowerCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    public VisitStats stats() {
        LocalDate today = today();
        LocalDate monthStart = today.minusDays(29);
        return new VisitStats(count(today, today), count(today.minusDays(6), today), count(monthStart, today), count(null, null),
                jdbc.queryForObject("select min(day) from visit_days", LocalDate.class),
                daily(monthStart, today), pages(monthStart, today),
                shares("source", monthStart, today), shares("device", monthStart, today));
    }

    /** from va to null bo'lsa — butun davr */
    private VisitCount count(LocalDate from, LocalDate to) {
        String where = from == null ? "" : " where day between ? and ?";
        Object[] args = from == null ? new Object[0] : new Object[] {from, to};
        Long visitors = jdbc.queryForObject("select count(distinct visitor) from visit_days" + where, Long.class, args);
        Long views = jdbc.queryForObject("select coalesce(sum(views), 0) from visit_pages" + where, Long.class, args);
        return new VisitCount(visitors == null ? 0 : visitors, views == null ? 0 : views);
    }

    /** Har kun uchun (tashrif bo'lmagan kunlar ham — nol bilan) */
    private List<VisitDay> daily(LocalDate from, LocalDate to) {
        Map<LocalDate, Long> visitors = new HashMap<>();
        jdbc.query("select day, count(*) from visit_days where day between ? and ? group by day",
                rs -> { visitors.put(rs.getObject(1, LocalDate.class), rs.getLong(2)); }, from, to);
        Map<LocalDate, Long> views = new HashMap<>();
        jdbc.query("select day, sum(views) from visit_pages where day between ? and ? group by day",
                rs -> { views.put(rs.getObject(1, LocalDate.class), rs.getLong(2)); }, from, to);
        List<VisitDay> days = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            days.add(new VisitDay(d, visitors.getOrDefault(d, 0L), views.getOrDefault(d, 0L)));
        }
        return days;
    }

    private List<VisitPage> pages(LocalDate from, LocalDate to) {
        String league = seo.league();
        String suffix = " — " + league;
        return jdbc.query("""
                select path, sum(views) as total from visit_pages where day between ? and ?
                group by path order by total desc, path limit ?""", (rs, i) -> {
            String path = rs.getString(1);
            PageMeta meta = seo.resolve(path);
            String label = meta.home() ? "Bosh sahifa"
                    : meta.status() != 200 ? "O‘chirilgan sahifa"
                    : meta.title().endsWith(suffix) ? meta.title().substring(0, meta.title().length() - suffix.length()) : meta.title();
            return new VisitPage(path, label, rs.getLong(2));
        }, from, to, TOP_PAGES);
    }

    /** column — faqat "source" yoki "device" (foydalanuvchi kiritmaydi) */
    private List<VisitShare> shares(String column, LocalDate from, LocalDate to) {
        return jdbc.query("select " + column + ", count(*) as total from visit_days where day between ? and ? group by " + column + " order by total desc, " + column,
                (rs, i) -> new VisitShare(rs.getString(1), rs.getLong(2)), from, to);
    }
}
