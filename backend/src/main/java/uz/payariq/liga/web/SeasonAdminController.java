package uz.payariq.liga.web;

import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import uz.payariq.liga.repo.SeasonRepository;
import uz.payariq.liga.service.SeasonDeletionService;
import uz.payariq.liga.web.Dto.SeasonDeletePreview;
import uz.payariq.liga.web.Dto.SeasonDeleted;
import uz.payariq.liga.web.Dto.SeasonDto;

/**
 * Admin paneli uchun mavsumlar ro'yxati (sinov mavsumlari bilan — saytdagi ro'yxatda ular yo'q)
 * va mavsumni butunlay o'chirish (faqat bosh tashkilotchi, SecurityConfig).
 */
@RestController
@RequestMapping("/api/admin")
public class SeasonAdminController {

    private final SeasonRepository seasons;
    private final SeasonDeletionService deletion;

    public SeasonAdminController(SeasonRepository seasons, SeasonDeletionService deletion) {
        this.seasons = seasons;
        this.deletion = deletion;
    }

    @GetMapping("/seasons")
    public List<SeasonDto> seasons() {
        return seasons.findAllByOrderByYearDescNumberDesc().stream().map(SeasonDto::of).toList();
    }

    @GetMapping("/seasons/{seasonId}/delete-preview")
    public SeasonDeletePreview deletePreview(@PathVariable UUID seasonId) {
        return deletion.preview(seasonId);
    }

    @PostMapping("/seasons/{seasonId}/delete")
    public SeasonDeleted delete(@PathVariable UUID seasonId, @Valid @RequestBody Requests.SeasonDelete in) {
        return deletion.delete(seasonId, in.name());
    }
}
