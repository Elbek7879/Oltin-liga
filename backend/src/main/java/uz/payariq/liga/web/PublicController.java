package uz.payariq.liga.web;

import java.util.List;
import java.util.UUID;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import uz.payariq.liga.security.CurrentUser;
import uz.payariq.liga.service.BundleCache;
import uz.payariq.liga.service.LiveUpdates;
import uz.payariq.liga.service.PublicReadService;
import uz.payariq.liga.web.Dto.ArchiveBundle;
import uz.payariq.liga.web.Dto.HeadToHead;
import uz.payariq.liga.web.Dto.MatchSeason;
import uz.payariq.liga.web.Dto.NewsDto;
import uz.payariq.liga.web.Dto.PlayerProfile;
import uz.payariq.liga.web.Dto.SeasonBundle;
import uz.payariq.liga.web.Dto.SeasonDto;
import uz.payariq.liga.web.Dto.SettingsDto;
import uz.payariq.liga.web.Dto.SponsorDto;
import uz.payariq.liga.web.Dto.TeamProfile;

/** Muxlislar uchun ommaviy API: login talab qilinmaydi, faqat o'qish */
@RestController
@RequestMapping("/api/public")
public class PublicController {

    private final PublicReadService read;
    private final LiveUpdates live;
    private final BundleCache bundles;

    public PublicController(PublicReadService read, LiveUpdates live, BundleCache bundles) {
        this.read = read;
        this.live = live;
        this.bundles = bundles;
    }

    /** Jonli yangilanishlar oqimi: gol yoki natija saqlanishi bilan sahifa xabar oladi va ma'lumotni qayta yuklaydi */
    @GetMapping(value = "/live", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter live(HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-cache");
        response.setHeader("X-Accel-Buffering", "no");
        return live.subscribe();
    }

    @GetMapping("/settings")
    public SettingsDto settings() {
        return read.settings();
    }

    @GetMapping("/seasons")
    public List<SeasonDto> seasons() {
        return read.seasons();
    }

    /**
     * Mavsumning barcha ommaviy ma'lumotlari bitta so'rovda — sekin mobil internetda ham tez.
     * Muxlislarga qisqa keshdan beriladi va sinov mavsumi ko'rsatilmaydi; tashkilotchilar har doim yangisini oladi.
     */
    @GetMapping("/seasons/{seasonId}/bundle")
    public ResponseEntity<SeasonBundle> bundle(@PathVariable UUID seasonId) {
        SeasonBundle body = CurrentUser.anonymous() ? bundles.get(seasonId, () -> read.publicBundle(seasonId)) : read.bundle(seasonId);
        return ResponseEntity.ok().cacheControl(CacheControl.noCache()).body(body);
    }

    /** O'yin qaysi mavsumga tegishli (eski mavsum o'yiniga havola ochilganda) */
    @GetMapping("/matches/{matchId}/season")
    public MatchSeason matchSeason(@PathVariable UUID matchId) {
        return read.matchSeason(matchId, !CurrentUser.anonymous());
    }

    @GetMapping("/archive")
    public ArchiveBundle archive() {
        return read.archive();
    }

    @GetMapping("/teams/{teamId}/profile")
    public TeamProfile teamProfile(@PathVariable UUID teamId) {
        return read.teamProfile(teamId);
    }

    @GetMapping("/players/{playerId}/profile")
    public PlayerProfile playerProfile(@PathVariable UUID playerId) {
        return read.playerProfile(playerId);
    }

    @GetMapping("/head-to-head")
    public HeadToHead headToHead(@RequestParam UUID teamA, @RequestParam UUID teamB) {
        return read.headToHead(teamA, teamB);
    }

    @GetMapping("/news")
    public List<NewsDto> news() {
        return read.news(false);
    }

    @GetMapping("/news/{slug}")
    public NewsDto newsItem(@PathVariable String slug) {
        return read.newsBySlug(slug);
    }

    @GetMapping("/sponsors")
    public List<SponsorDto> sponsors() {
        return read.sponsors(false);
    }
}
