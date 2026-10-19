package uz.payariq.liga.service;

import java.text.Normalizer;
import java.time.Clock;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.payariq.liga.common.ApiException;
import uz.payariq.liga.domain.NewsStatus;
import uz.payariq.liga.model.LeagueSettings;
import uz.payariq.liga.model.News;
import uz.payariq.liga.model.PointAdjustment;
import uz.payariq.liga.model.SeasonTeam;
import uz.payariq.liga.model.Sponsor;
import uz.payariq.liga.model.Venue;
import uz.payariq.liga.repo.LeagueSettingsRepository;
import uz.payariq.liga.repo.MatchRepository;
import uz.payariq.liga.repo.NewsRepository;
import uz.payariq.liga.repo.PointAdjustmentRepository;
import uz.payariq.liga.repo.SeasonTeamRepository;
import uz.payariq.liga.repo.SponsorRepository;
import uz.payariq.liga.repo.VenueRepository;
import uz.payariq.liga.security.CurrentUser;
import uz.payariq.liga.web.Dto.NewsDto;
import uz.payariq.liga.web.Dto.SettingsDto;
import uz.payariq.liga.web.Dto.SponsorDto;
import uz.payariq.liga.web.Dto.VenueDto;
import uz.payariq.liga.web.Requests;

/** Yangiliklar, homiylar, maydonlar, ochko o'zgarishlari va liga sozlamalari */
@Service
@Transactional
public class ContentService {

    private final NewsRepository news;
    private final SponsorRepository sponsors;
    private final VenueRepository venues;
    private final PointAdjustmentRepository adjustments;
    private final SeasonTeamRepository seasonTeams;
    private final MatchRepository matches;
    private final LeagueSettingsRepository settings;
    private final SeasonDataLoader loader;
    private final AuditService audit;
    private final OutboxService outbox;
    private final CurrentUser currentUser;
    private final Clock clock;
    private final PlayoffService playoffs;

    public ContentService(NewsRepository news, SponsorRepository sponsors, VenueRepository venues, PointAdjustmentRepository adjustments,
                          SeasonTeamRepository seasonTeams, MatchRepository matches, LeagueSettingsRepository settings, SeasonDataLoader loader,
                          AuditService audit, OutboxService outbox, CurrentUser currentUser, Clock clock, PlayoffService playoffs) {
        this.news = news;
        this.sponsors = sponsors;
        this.venues = venues;
        this.adjustments = adjustments;
        this.seasonTeams = seasonTeams;
        this.matches = matches;
        this.settings = settings;
        this.loader = loader;
        this.audit = audit;
        this.outbox = outbox;
        this.currentUser = currentUser;
        this.clock = clock;
        this.playoffs = playoffs;
    }

    // ---------- Yangiliklar ----------

    public NewsDto saveNews(UUID id, Requests.NewsInput in) {
        News n = id == null ? new News() : news.findById(id).orElseThrow(() -> ApiException.notFound("Yangilik topilmadi."));
        boolean wasPublished = n.status == NewsStatus.PUBLISHED && id != null;
        n.title = in.title().trim();
        n.excerpt = in.excerpt().trim();
        n.body = in.body().trim();
        n.important = in.important();
        n.status = in.status();
        String slug = slugify(n.title);
        if (slug.isBlank()) slug = "yangilik";
        if (id == null ? news.existsBySlug(slug) : news.existsBySlugAndIdNot(slug, id)) slug = slug + "-" + Long.toString(clock.millis(), 36).substring(4);
        n.slug = slug;
        if (id == null || (!wasPublished && n.status == NewsStatus.PUBLISHED)) n.publishedAt = clock.instant();
        news.save(n);
        audit.record("Yangilik", "«" + n.title + "» " + (n.status == NewsStatus.PUBLISHED ? "e’lon qilindi" : "qoralama sifatida saqlandi"), "NEWS", n.getId());
        if (n.status == NewsStatus.PUBLISHED && !wasPublished) {
            outbox.publish(OutboxService.NEWS_PUBLISHED, Map.of("newsId", n.getId().toString(), "title", n.title, "slug", n.slug));
        }
        return NewsDto.of(n);
    }

    public void deleteNews(UUID id) {
        News n = news.findById(id).orElseThrow(() -> ApiException.notFound("Yangilik topilmadi."));
        news.delete(n);
        audit.record("Yangilik", "«" + n.title + "» o‘chirildi", "NEWS", id);
    }

    /** Sarlavhadan URL uchun lotin harfli qisqa yozuv */
    static String slugify(String text) {
        String s = Normalizer.normalize(text.toLowerCase(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replaceAll("[‘’ʻʼ'`]", "")
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
        return s.length() > 80 ? s.substring(0, 80).replaceAll("-+$", "") : s;
    }

    // ---------- Homiylar ----------

    public SponsorDto saveSponsor(UUID id, Requests.SponsorInput in) {
        Sponsor s = id == null ? new Sponsor() : sponsors.findById(id).orElseThrow(() -> ApiException.notFound("Homiy topilmadi."));
        s.name = in.name().trim();
        s.tier = in.tier();
        s.description = in.description() == null ? "" : in.description().trim();
        s.url = in.url() == null || in.url().isBlank() ? null : in.url().trim();
        s.logoUrl = in.logoUrl() == null || in.logoUrl().isBlank() ? null : in.logoUrl().trim();
        s.active = in.active();
        s.sortOrder = in.order();
        sponsors.save(s);
        audit.record("Homiy", "«" + s.name + "» saqlandi", "SPONSOR", s.getId());
        return SponsorDto.of(s);
    }

    public void deleteSponsor(UUID id) {
        Sponsor s = sponsors.findById(id).orElseThrow(() -> ApiException.notFound("Homiy topilmadi."));
        sponsors.delete(s);
        audit.record("Homiy", "«" + s.name + "» o‘chirildi", "SPONSOR", id);
    }

    // ---------- Maydonlar ----------

    public VenueDto saveVenue(UUID id, Requests.VenueInput in) {
        Venue v = id == null ? new Venue() : venues.findById(id).orElseThrow(() -> ApiException.notFound("Maydon topilmadi."));
        v.name = in.name().trim();
        v.village = in.village() == null ? "" : in.village().trim();
        venues.save(v);
        audit.record("Maydon", "«" + v.name + "» saqlandi", "VENUE", v.getId());
        return VenueDto.of(v);
    }

    public void deleteVenue(UUID id) {
        Venue v = venues.findById(id).orElseThrow(() -> ApiException.notFound("Maydon topilmadi."));
        if (matches.findAll().stream().anyMatch(m -> id.equals(m.venueId))) {
            throw ApiException.conflict("Bu maydonda o‘yinlar belgilangan, uni o‘chirib bo‘lmaydi.");
        }
        venues.delete(v);
        audit.record("Maydon", "«" + v.name + "» o‘chirildi", "VENUE", id);
    }

    // ---------- Ochko o'zgarishlari ----------

    public void addAdjustment(UUID seasonId, Requests.AdjustmentInput in) {
        loader.editableSeason(seasonId);
        if (in.points() == 0) throw ApiException.badRequest("Ochko 0 ga teng bo‘lmasin.");
        SeasonTeam st = seasonTeams.findById(in.seasonTeamId()).filter(x -> x.seasonId.equals(seasonId))
                .orElseThrow(() -> ApiException.badRequest("Tanlangan jamoa bu mavsumda ishtirok etmaydi."));
        PointAdjustment a = new PointAdjustment();
        a.seasonId = seasonId;
        a.seasonTeamId = st.getId();
        a.points = in.points();
        a.reason = in.reason().trim();
        a.createdBy = currentUser.displayName();
        adjustments.save(a);
        audit.record("Ochko", st.name + ": " + (a.points > 0 ? "+" : "") + a.points + " ochko (" + a.reason + ")", "SEASON", seasonId);
        playoffs.sync(seasonId);
    }

    public void deleteAdjustment(UUID id) {
        PointAdjustment a = adjustments.findById(id).orElseThrow(() -> ApiException.notFound("Yozuv topilmadi."));
        loader.editableSeason(a.seasonId);
        adjustments.delete(a);
        String team = seasonTeams.findById(a.seasonTeamId).map(st -> st.name).orElse("Jamoa");
        audit.record("Ochko", team + " uchun ochko o‘zgarishi bekor qilindi", "SEASON", a.seasonId);
        playoffs.sync(a.seasonId);
    }

    // ---------- Sozlamalar ----------

    public SettingsDto updateSettings(Requests.SettingsInput in) {
        LeagueSettings s = settings.findFirstByOrderByCreatedAtAsc().orElseGet(LeagueSettings::new);
        s.name = in.name().trim();
        s.shortName = in.shortName().trim();
        s.region = in.region() == null ? "" : in.region().trim();
        s.about = in.about() == null ? "" : in.about().trim();
        s.contactPhone = in.contactPhone() == null ? "" : in.contactPhone().trim();
        s.telegram = in.telegram() == null || in.telegram().isBlank() ? "" : (in.telegram().startsWith("@") ? in.telegram().trim() : "@" + in.telegram().trim());
        settings.save(s);
        audit.record("Sozlamalar", "Liga ma’lumotlari yangilandi", "SETTINGS", s.getId());
        return SettingsDto.of(s);
    }
}
