package uz.payariq.liga.seo;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.payariq.liga.domain.MatchStatus;
import uz.payariq.liga.domain.NewsStatus;
import uz.payariq.liga.model.LeagueSettings;
import uz.payariq.liga.model.Match;
import uz.payariq.liga.model.News;
import uz.payariq.liga.model.Player;
import uz.payariq.liga.model.RosterEntry;
import uz.payariq.liga.model.Season;
import uz.payariq.liga.model.SeasonTeam;
import uz.payariq.liga.model.Team;
import uz.payariq.liga.repo.LeagueSettingsRepository;
import uz.payariq.liga.repo.MatchRepository;
import uz.payariq.liga.repo.NewsRepository;
import uz.payariq.liga.repo.PlayerRepository;
import uz.payariq.liga.repo.RosterEntryRepository;
import uz.payariq.liga.repo.SeasonRepository;
import uz.payariq.liga.repo.SeasonTeamRepository;
import uz.payariq.liga.repo.TeamRepository;

/**
 * Har bir sahifaning nomi va tavsifi (Google va Telegram uchun). Matnlar frontend'dagi lib/seo.ts bilan
 * aynan bir xil — sayt sahifani ochgach brauzer nomini o'zgartirmaydi, faqat tasdiqlaydi.
 * Sinov mavsumiga tegishli sahifalar va mavjud bo'lmagan manzillar «topilmadi» (404) bo'ladi.
 */
@Service
@Transactional(readOnly = true)
public class SeoService {

    public static final String DEFAULT_LEAGUE = "Payariq Oltin Ligasi";

    /** Sahifa ma'lumoti: status 200 yoki 404; noindex — Google ko'rsatmasin */
    public record PageMeta(String title, String description, String path, int status, boolean noindex, boolean home) {
    }

    /** Doimiy bo'limlar: manzil → [sarlavha, tavsif]. lib/seo.ts dagi STATIC_PAGES bilan bir xil */
    public static final Map<String, String[]> STATIC_PAGES = new LinkedHashMap<>();

    static {
        STATIC_PAGES.put("/oyinlar", new String[] {"O‘yinlar", "O‘yinlar taqvimi va natijalari: sana, vaqt, stadion va hisob."});
        STATIC_PAGES.put("/jadval", new String[] {"Turnir jadvali", "Guruhlar jadvali: ochkolar, to‘plar farqi va pley-offga chiqish zonasi."});
        STATIC_PAGES.put("/pley-off", new String[] {"Pley-off", "Pley-off setkasi: chorak final, yarim final va final o‘yinlari."});
        STATIC_PAGES.put("/jamoalar", new String[] {"Jamoalar", "Ligada qatnashayotgan qishloq va mahalla jamoalari."});
        STATIC_PAGES.put("/futbolchilar", new String[] {"Futbolchilar", "Liga futbolchilari: jamoasi, pozitsiyasi va statistikasi."});
        STATIC_PAGES.put("/statistika", new String[] {"Statistika", "To‘purarlar, assistlar, kartochkalar va Fair Play reytingi."});
        STATIC_PAGES.put("/ramziy-jamoa", new String[] {"Ramziy jamoa", "Har tur yakunidagi eng yaxshi 5 futbolchi."});
        STATIC_PAGES.put("/yangiliklar", new String[] {"Yangiliklar", "Liga yangiliklari va e’lonlari."});
        STATIC_PAGES.put("/mavsumlar", new String[] {"Mavsumlar arxivi", "O‘tgan mavsumlar: chempionlar, to‘purarlar va final o‘yinlari."});
        STATIC_PAGES.put("/chempionlar", new String[] {"Chempionlar tarixi", "Liga chempionlari va sovrindorlari tarixi."});
        STATIC_PAGES.put("/homiylar", new String[] {"Homiylar", "Liga homiylari va hamkorlari."});
        STATIC_PAGES.put("/liga-haqida", new String[] {"Liga haqida", "Liga qayerda o‘tadi, kimlar qatnashadi va qanday qatnashish mumkin."});
        STATIC_PAGES.put("/nizom", new String[] {"Musobaqa nizomi", "Musobaqa qoidalari: ochkolar, teng ochkoda tartib, pley-offga chiqish va intizom."});
        STATIC_PAGES.put("/maxfiylik", new String[] {"Maxfiylik siyosati", "Sayt qanday ma’lumotlarni saqlaydi, nima uchun va futbolchi o‘z ma’lumotini qanday tuzattirishi mumkin."});
    }

    private static final Pattern TEAM = Pattern.compile("^/jamoalar/([0-9a-fA-F-]{36})$");
    private static final Pattern PLAYER = Pattern.compile("^/futbolchilar/([0-9a-fA-F-]{36})$");
    private static final Pattern MATCH = Pattern.compile("^/oyinlar/([0-9a-fA-F-]{36})$");
    private static final Pattern NEWS = Pattern.compile("^/yangiliklar/([^/]+)$");

    private final LeagueSettingsRepository settings;
    private final SeasonRepository seasons;
    private final TeamRepository teams;
    private final SeasonTeamRepository seasonTeams;
    private final PlayerRepository players;
    private final RosterEntryRepository rosters;
    private final MatchRepository matches;
    private final NewsRepository news;

    public SeoService(LeagueSettingsRepository settings, SeasonRepository seasons, TeamRepository teams, SeasonTeamRepository seasonTeams,
                      PlayerRepository players, RosterEntryRepository rosters, MatchRepository matches, NewsRepository news) {
        this.settings = settings;
        this.seasons = seasons;
        this.teams = teams;
        this.seasonTeams = seasonTeams;
        this.players = players;
        this.rosters = rosters;
        this.matches = matches;
        this.news = news;
    }

    public Optional<LeagueSettings> leagueSettings() {
        return settings.findAll().stream().findFirst();
    }

    public String league() {
        return leagueSettings().map(s -> s.name).filter(n -> n != null && !n.isBlank()).orElse(DEFAULT_LEAGUE);
    }

    public static String pageTitle(String title, String league) {
        return title + " — " + league;
    }

    /** Manzil bo'yicha sahifa ma'lumoti (so'rov parametrlarisiz, oxirida «/»siz) */
    public PageMeta resolve(String rawPath) {
        String path = normalize(rawPath);
        String league = league();
        if (path.equals("/")) {
            return new PageMeta(league + " — o‘yinlar, natijalar va turnir jadvali",
                    league + ": o‘yinlar taqvimi, natijalar, turnir jadvali, to‘purarlar va mavsumlar tarixi.", "/", 200, false, true);
        }
        if (path.equals("/admin") || path.startsWith("/admin/")) {
            return new PageMeta(pageTitle("Boshqaruv paneli", league), "Liga tashkilotchilari uchun boshqaruv paneli.", path, 200, true, false);
        }
        String[] page = STATIC_PAGES.get(path);
        if (page != null) return new PageMeta(pageTitle(page[0], league), page[1], path, 200, false, false);

        Matcher m;
        if ((m = TEAM.matcher(path)).matches()) return team(uuid(m.group(1)), path, league);
        if ((m = PLAYER.matcher(path)).matches()) return player(uuid(m.group(1)), path, league);
        if ((m = MATCH.matcher(path)).matches()) return match(uuid(m.group(1)), path, league);
        if ((m = NEWS.matcher(path)).matches()) return newsItem(m.group(1), path, league);
        return notFound(path, league);
    }

    public static PageMeta notFound(String path, String league) {
        return new PageMeta(pageTitle("Sahifa topilmadi", league), "Bu manzilda sahifa yo‘q.", path, 404, true, false);
    }

    private Set<UUID> testSeasonIds() {
        return seasons.findByTestTrue().stream().map(Season::getId).collect(Collectors.toSet());
    }

    private PageMeta team(UUID id, String path, String league) {
        Team t = id == null ? null : teams.findById(id).orElse(null);
        if (t == null) return notFound(path, league);
        Set<UUID> hidden = testSeasonIds();
        List<SeasonTeam> all = seasonTeams.findByTeamId(id);
        // Faqat sinov mavsumida qatnashgan jamoa saytda yo'q (PublicReadService.teamProfile bilan bir xil)
        if (!all.isEmpty() && all.stream().allMatch(st -> hidden.contains(st.seasonId))) return notFound(path, league);
        return new PageMeta(pageTitle(t.name, league), teamDescription(t.name, t.village), path, 200, false, false);
    }

    public static String teamDescription(String name, String village) {
        String place = village == null || village.isBlank() ? "" : " (" + village.trim() + ")";
        return name + place + ": o‘yinlar, natijalar, tarkib va mavsumlar bo‘yicha statistika.";
    }

    private PageMeta player(UUID id, String path, String league) {
        Player p = id == null ? null : players.findById(id).orElse(null);
        if (p == null) return notFound(path, league);
        Set<UUID> hidden = testSeasonIds();
        List<RosterEntry> all = rosters.findByPlayerId(id);
        if (!all.isEmpty() && all.stream().allMatch(r -> hidden.contains(r.seasonId))) return notFound(path, league);
        String name = p.firstName + " " + p.lastName;
        return new PageMeta(pageTitle(name, league), name + ": o‘yinlar, gollar, assistlar va mavsumlar bo‘yicha statistika.", path, 200, false, false);
    }

    private PageMeta match(UUID id, String path, String league) {
        Match m = id == null ? null : matches.findById(id).orElse(null);
        if (m == null || testSeasonIds().contains(m.seasonId)) return notFound(path, league);
        String home = m.homeId == null ? null : seasonTeams.findById(m.homeId).map(st -> st.name).orElse(null);
        String away = m.awayId == null ? null : seasonTeams.findById(m.awayId).map(st -> st.name).orElse(null);
        boolean scored = m.status == MatchStatus.FINISHED || m.status == MatchStatus.LIVE;
        return new PageMeta(pageTitle(matchTitle(home, away, scored ? m.homeTotal() : null, scored ? m.awayTotal() : null), league),
                matchDescription(home, away), path, 200, false, false);
    }

    /** «Lochin 2:1 Chinor», hisob bo'lmasa «Lochin – Chinor»; jamoalar hali aniqlanmagan bo'lsa — «Pley-off o‘yini» */
    public static String matchTitle(String home, String away, Integer homeGoals, Integer awayGoals) {
        if (home == null || away == null) return "Pley-off o‘yini";
        return homeGoals == null || awayGoals == null ? home + " – " + away : home + " " + homeGoals + ":" + awayGoals + " " + away;
    }

    public static String matchDescription(String home, String away) {
        String who = home == null || away == null ? "Pley-off o‘yini" : home + " va " + away + " o‘yini";
        return who + ": hisob, gollar, kartochkalar va o‘yin tafsilotlari.";
    }

    private PageMeta newsItem(String slug, String path, String league) {
        News n = news.findBySlugAndStatus(slug, NewsStatus.PUBLISHED).orElse(null);
        if (n == null) return notFound(path, league);
        return new PageMeta(pageTitle(n.title, league), newsDescription(n.title, n.excerpt, league), path, 200, false, false);
    }

    public static String newsDescription(String title, String excerpt, String league) {
        return excerpt != null && !excerpt.isBlank() ? excerpt.trim() : league + " yangiliklari: " + title + ".";
    }

    /** sitemap.xml qatori: manzil va oxirgi o'zgarish sanasi (bo'lmasligi mumkin) */
    public record SitemapEntry(String path, java.time.Instant lastModified) {
    }

    /**
     * Google uchun sahifalar ro'yxati: doimiy bo'limlar, ochiq (sinov bo'lmagan) mavsumlardagi jamoalar,
     * futbolchilar va o'yinlar hamda e'lon qilingan yangiliklar. Admin panel va sinov mavsumi kirmaydi.
     */
    public List<SitemapEntry> sitemap() {
        List<SitemapEntry> list = new java.util.ArrayList<>();
        list.add(new SitemapEntry("/", null));
        for (String path : STATIC_PAGES.keySet()) list.add(new SitemapEntry(path, null));
        Set<UUID> publicSeasons = seasons.findAll().stream().filter(x -> !x.test).map(Season::getId).collect(Collectors.toSet());
        Set<UUID> teamIds = new java.util.LinkedHashSet<>();
        Set<UUID> playerIds = new java.util.LinkedHashSet<>();
        List<SitemapEntry> matchEntries = new java.util.ArrayList<>();
        for (UUID seasonId : publicSeasons) {
            for (SeasonTeam st : seasonTeams.findBySeasonId(seasonId)) teamIds.add(st.teamId);
            for (RosterEntry r : rosters.findBySeasonId(seasonId)) playerIds.add(r.playerId);
            for (Match m : matches.findBySeasonIdOrderByKickoffAsc(seasonId)) {
                if (m.status == MatchStatus.CANCELLED || m.homeId == null || m.awayId == null) continue;
                matchEntries.add(new SitemapEntry("/oyinlar/" + m.getId(), m.getUpdatedAt()));
            }
        }
        for (UUID id : teamIds) list.add(new SitemapEntry("/jamoalar/" + id, null));
        for (UUID id : playerIds) list.add(new SitemapEntry("/futbolchilar/" + id, null));
        list.addAll(matchEntries);
        for (News n : news.findByStatusOrderByPublishedAtDesc(NewsStatus.PUBLISHED)) {
            list.add(new SitemapEntry("/yangiliklar/" + org.springframework.web.util.UriUtils.encodePathSegment(n.slug, java.nio.charset.StandardCharsets.UTF_8),
                    n.getUpdatedAt()));
        }
        return list;
    }

    private static UUID uuid(String s) {
        try {
            return UUID.fromString(s);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /** «/jadval/» → «/jadval», bo'sh → «/» */
    public static String normalize(String path) {
        if (path == null || path.isBlank()) return "/";
        String p = path.startsWith("/") ? path : "/" + path;
        while (p.length() > 1 && p.endsWith("/")) p = p.substring(0, p.length() - 1);
        return p;
    }
}
