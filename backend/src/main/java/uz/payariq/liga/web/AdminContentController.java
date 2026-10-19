package uz.payariq.liga.web;

import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import uz.payariq.liga.service.AdminQueryService;
import uz.payariq.liga.service.ContentService;
import uz.payariq.liga.service.PublicReadService;
import uz.payariq.liga.web.Dto.AuditDto;
import uz.payariq.liga.web.Dto.NewsDto;
import uz.payariq.liga.web.Dto.SettingsDto;
import uz.payariq.liga.web.Dto.SponsorDto;
import uz.payariq.liga.web.Dto.VenueDto;

/** Sayt kontenti va tizim: yangiliklar, homiylar, maydonlar, ochko o'zgarishlari, sozlamalar, tarix */
@RestController
@RequestMapping("/api/admin")
public class AdminContentController {

    private final ContentService content;
    private final PublicReadService read;
    private final AdminQueryService queries;

    public AdminContentController(ContentService content, PublicReadService read, AdminQueryService queries) {
        this.content = content;
        this.read = read;
        this.queries = queries;
    }

    @GetMapping("/news")
    public List<NewsDto> news() {
        return read.news(true);
    }

    @PostMapping("/news")
    public NewsDto createNews(@Valid @RequestBody Requests.NewsInput in) {
        return content.saveNews(null, in);
    }

    @PutMapping("/news/{id}")
    public NewsDto updateNews(@PathVariable UUID id, @Valid @RequestBody Requests.NewsInput in) {
        return content.saveNews(id, in);
    }

    @DeleteMapping("/news/{id}")
    public ResponseEntity<Void> deleteNews(@PathVariable UUID id) {
        content.deleteNews(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/sponsors")
    public List<SponsorDto> sponsors() {
        return read.sponsors(true);
    }

    @PostMapping("/sponsors")
    public SponsorDto createSponsor(@Valid @RequestBody Requests.SponsorInput in) {
        return content.saveSponsor(null, in);
    }

    @PutMapping("/sponsors/{id}")
    public SponsorDto updateSponsor(@PathVariable UUID id, @Valid @RequestBody Requests.SponsorInput in) {
        return content.saveSponsor(id, in);
    }

    @DeleteMapping("/sponsors/{id}")
    public ResponseEntity<Void> deleteSponsor(@PathVariable UUID id) {
        content.deleteSponsor(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/venues")
    public List<VenueDto> venues() {
        return read.venues();
    }

    @PostMapping("/venues")
    public VenueDto createVenue(@Valid @RequestBody Requests.VenueInput in) {
        return content.saveVenue(null, in);
    }

    @PutMapping("/venues/{id}")
    public VenueDto updateVenue(@PathVariable UUID id, @Valid @RequestBody Requests.VenueInput in) {
        return content.saveVenue(id, in);
    }

    @DeleteMapping("/venues/{id}")
    public ResponseEntity<Void> deleteVenue(@PathVariable UUID id) {
        content.deleteVenue(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/seasons/{seasonId}/adjustments")
    public ResponseEntity<Void> addAdjustment(@PathVariable UUID seasonId, @Valid @RequestBody Requests.AdjustmentInput in) {
        content.addAdjustment(seasonId, in);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/adjustments/{id}")
    public ResponseEntity<Void> deleteAdjustment(@PathVariable UUID id) {
        content.deleteAdjustment(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/settings")
    public SettingsDto updateSettings(@Valid @RequestBody Requests.SettingsInput in) {
        return content.updateSettings(in);
    }

    @GetMapping("/audit")
    public List<AuditDto> audit() {
        return queries.audit();
    }
}
