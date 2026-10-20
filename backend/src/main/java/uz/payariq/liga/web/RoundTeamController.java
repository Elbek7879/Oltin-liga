package uz.payariq.liga.web;

import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import uz.payariq.liga.service.RoundTeamService;
import uz.payariq.liga.web.Dto.RoundTeamDto;

/** Ramziy jamoa (tashkilotchilar) va futbolchi rasmi. O'qish — barcha adminlar, o'zgartirish — administratorlar */
@RestController
@RequestMapping("/api/admin")
public class RoundTeamController {

    private final RoundTeamService roundTeams;

    public RoundTeamController(RoundTeamService roundTeams) {
        this.roundTeams = roundTeams;
    }

    @GetMapping("/seasons/{seasonId}/round-teams")
    public List<RoundTeamDto> list(@PathVariable UUID seasonId) {
        return roundTeams.list(seasonId);
    }

    @PutMapping("/seasons/{seasonId}/round-teams")
    public RoundTeamDto save(@PathVariable UUID seasonId, @Valid @RequestBody Requests.RoundTeamInput in) {
        return roundTeams.save(seasonId, in);
    }

    @DeleteMapping("/round-teams/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        roundTeams.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/players/{playerId}/photo")
    public ResponseEntity<Void> photo(@PathVariable UUID playerId, @Valid @RequestBody Requests.PlayerPhoto in) {
        roundTeams.setPlayerPhoto(playerId, in.photoUrl());
        return ResponseEntity.noContent().build();
    }
}
