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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import uz.payariq.liga.domain.ResultValidator.ResultInput;
import uz.payariq.liga.service.AdminQueryService;
import uz.payariq.liga.service.CompetitionService;
import uz.payariq.liga.service.PlayoffService;
import uz.payariq.liga.service.ResultService;
import uz.payariq.liga.service.SeasonService;
import uz.payariq.liga.service.TeamPlayerService;
import uz.payariq.liga.web.Dto.AdminPlayerRow;
import uz.payariq.liga.web.Dto.AdminTeamRow;
import uz.payariq.liga.web.Dto.Created;
import uz.payariq.liga.web.Dto.Dashboard;
import uz.payariq.liga.web.Dto.FinishPreview;
import uz.payariq.liga.web.Dto.MatchDto;
import uz.payariq.liga.web.Dto.Report;
import uz.payariq.liga.web.Dto.SeasonDto;
import uz.payariq.liga.web.Dto.TeamDto;

/** Musobaqani boshqarish: mavsumlar, jamoalar, futbolchilar, qur'a, o'yinlar, natijalar, pley-off */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminQueryService queries;
    private final SeasonService seasons;
    private final TeamPlayerService teamsPlayers;
    private final CompetitionService competition;
    private final ResultService results;
    private final PlayoffService playoffs;

    public AdminController(AdminQueryService queries, SeasonService seasons, TeamPlayerService teamsPlayers, CompetitionService competition,
                           ResultService results, PlayoffService playoffs) {
        this.queries = queries;
        this.seasons = seasons;
        this.teamsPlayers = teamsPlayers;
        this.competition = competition;
        this.results = results;
        this.playoffs = playoffs;
    }

    // ---------- Mavsumlar ----------

    @GetMapping("/seasons/{seasonId}/dashboard")
    public Dashboard dashboard(@PathVariable UUID seasonId) {
        return queries.dashboard(seasonId);
    }

    @PostMapping("/seasons")
    public SeasonDto createSeason(@Valid @RequestBody Requests.SeasonCreate in) {
        return seasons.create(in);
    }

    @PutMapping("/seasons/{seasonId}/rules")
    public SeasonDto updateRules(@PathVariable UUID seasonId, @Valid @RequestBody Requests.Rules in) {
        return seasons.updateRules(seasonId, in);
    }

    @PostMapping("/seasons/{seasonId}/activate")
    public SeasonDto activate(@PathVariable UUID seasonId) {
        return seasons.activate(seasonId);
    }

    @GetMapping("/seasons/{seasonId}/finish-preview")
    public FinishPreview finishPreview(@PathVariable UUID seasonId) {
        return queries.finishPreview(seasonId);
    }

    @PostMapping("/seasons/{seasonId}/finish")
    public SeasonDto finish(@PathVariable UUID seasonId) {
        return seasons.finish(seasonId);
    }

    @GetMapping("/seasons/{seasonId}/report")
    public Report report(@PathVariable UUID seasonId) {
        return queries.report(seasonId);
    }

    // ---------- Jamoalar ----------

    @GetMapping("/seasons/{seasonId}/teams")
    public List<AdminTeamRow> teams(@PathVariable UUID seasonId) {
        return queries.teams(seasonId);
    }

    @PostMapping("/teams")
    public TeamDto createTeam(@Valid @RequestBody Requests.TeamInput in, @RequestParam(required = false) UUID addToSeasonId) {
        return teamsPlayers.createTeam(in, addToSeasonId);
    }

    @PutMapping("/teams/{teamId}")
    public TeamDto updateTeam(@PathVariable UUID teamId, @Valid @RequestBody Requests.TeamInput in) {
        return teamsPlayers.updateTeam(teamId, in);
    }

    @DeleteMapping("/teams/{teamId}")
    public ResponseEntity<Void> deleteTeam(@PathVariable UUID teamId) {
        teamsPlayers.deleteTeam(teamId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/seasons/{seasonId}/teams/{teamId}")
    public ResponseEntity<Void> setTeamInSeason(@PathVariable UUID seasonId, @PathVariable UUID teamId, @RequestBody Requests.TeamInSeason in) {
        teamsPlayers.setInSeason(teamId, seasonId, in.inSeason());
        return ResponseEntity.noContent().build();
    }

    // ---------- Futbolchilar ----------

    @GetMapping("/seasons/{seasonId}/players")
    public List<AdminPlayerRow> players(@PathVariable UUID seasonId) {
        return queries.players(seasonId);
    }

    @PostMapping("/seasons/{seasonId}/players")
    public ResponseEntity<Void> createPlayer(@PathVariable UUID seasonId, @Valid @RequestBody Requests.PlayerInput in) {
        teamsPlayers.createPlayer(seasonId, in);
        return ResponseEntity.noContent().build();
    }

    /** Jamoa tarkibiga futbolchilarni ro'yxat bilan birdaniga qo'shish */
    @PostMapping("/seasons/{seasonId}/players/bulk")
    public Created createPlayers(@PathVariable UUID seasonId, @Valid @RequestBody Requests.PlayersBulk in) {
        return teamsPlayers.createPlayers(seasonId, in);
    }

    @PutMapping("/seasons/{seasonId}/players/{playerId}")
    public ResponseEntity<Void> updatePlayer(@PathVariable UUID seasonId, @PathVariable UUID playerId, @Valid @RequestBody Requests.PlayerInput in) {
        teamsPlayers.updatePlayer(seasonId, playerId, in);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/players/{playerId}")
    public ResponseEntity<Void> deletePlayer(@PathVariable UUID playerId) {
        teamsPlayers.deletePlayer(playerId);
        return ResponseEntity.noContent().build();
    }

    // ---------- Qur'a va o'yinlar ----------

    @PutMapping("/seasons/{seasonId}/groups")
    public ResponseEntity<Void> saveGroups(@PathVariable UUID seasonId, @Valid @RequestBody Requests.SaveGroups in) {
        competition.saveGroups(seasonId, in);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/seasons/{seasonId}/matches")
    public MatchDto createMatch(@PathVariable UUID seasonId, @Valid @RequestBody Requests.MatchInput in) {
        return competition.createMatch(seasonId, in);
    }

    @PutMapping("/matches/{matchId}")
    public MatchDto updateMatch(@PathVariable UUID matchId, @Valid @RequestBody Requests.MatchInput in) {
        return competition.updateMatch(matchId, in);
    }

    @DeleteMapping("/matches/{matchId}")
    public ResponseEntity<Void> deleteMatch(@PathVariable UUID matchId) {
        competition.deleteMatch(matchId);
        return ResponseEntity.noContent().build();
    }

    /** Qur'adan keyin juftliklar o'zi tuziladi; bu — o'yinlari yo'q guruhlar uchun qayta tuzish */
    @PostMapping("/seasons/{seasonId}/fixtures")
    public Created generateFixtures(@PathVariable UUID seasonId) {
        return competition.generateFixtures(seasonId);
    }

    /** Natija kiritish — jadval va statistika shundan keyin avtomatik qayta hisoblanadi */
    @PutMapping("/matches/{matchId}/result")
    public MatchDto saveResult(@PathVariable UUID matchId, @RequestBody ResultInput in) {
        return results.save(matchId, in);
    }

    // ---------- Pley-off ----------

    @PostMapping("/seasons/{seasonId}/playoff")
    public Created createPlayoff(@PathVariable UUID seasonId, @Valid @RequestBody Requests.CreatePlayoff in) {
        return playoffs.create(seasonId, in);
    }

    @DeleteMapping("/seasons/{seasonId}/playoff")
    public ResponseEntity<Void> deletePlayoff(@PathVariable UUID seasonId) {
        playoffs.delete(seasonId);
        return ResponseEntity.noContent().build();
    }

    /** O'yin sanasi, vaqti va maydoni (pley-off o'yinlari uchun asosiy usul) */
    @PutMapping("/matches/{matchId}/schedule")
    public MatchDto scheduleMatch(@PathVariable UUID matchId, @Valid @RequestBody Requests.MatchSchedule in) {
        return playoffs.schedule(matchId, in);
    }

    // ---------- Teng holatda qur'a ----------

    @PostMapping("/seasons/{seasonId}/lots")
    public ResponseEntity<Void> drawLot(@PathVariable UUID seasonId, @Valid @RequestBody Requests.LotInput in) {
        playoffs.drawLot(seasonId, in);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/seasons/{seasonId}/lots")
    public ResponseEntity<Void> deleteLot(@PathVariable UUID seasonId, @RequestParam String scope) {
        playoffs.deleteLot(seasonId, scope);
        return ResponseEntity.noContent().build();
    }
}
