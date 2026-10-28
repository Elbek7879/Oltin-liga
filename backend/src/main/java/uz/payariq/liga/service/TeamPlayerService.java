package uz.payariq.liga.service;

import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.payariq.liga.common.ApiException;
import uz.payariq.liga.domain.TeamNames;
import uz.payariq.liga.model.LeagueGroup;
import uz.payariq.liga.model.Match;
import uz.payariq.liga.model.Player;
import uz.payariq.liga.model.RosterEntry;
import uz.payariq.liga.model.Season;
import uz.payariq.liga.model.SeasonTeam;
import uz.payariq.liga.model.Team;
import uz.payariq.liga.repo.AppearanceRepository;
import uz.payariq.liga.repo.LeagueGroupRepository;
import uz.payariq.liga.repo.MatchEventRepository;
import uz.payariq.liga.repo.MatchRepository;
import uz.payariq.liga.repo.PlayerRepository;
import uz.payariq.liga.repo.RosterEntryRepository;
import uz.payariq.liga.repo.SeasonTeamRepository;
import uz.payariq.liga.repo.TeamRepository;
import uz.payariq.liga.web.Dto.TeamDto;
import uz.payariq.liga.web.Dto.Created;
import uz.payariq.liga.web.Requests;

/** Jamoalar va futbolchilar. Tarixi bor yozuvlarni o'chirishga ruxsat berilmaydi. */
@Service
@Transactional
public class TeamPlayerService {

    private final TeamRepository teams;
    private final SeasonTeamRepository seasonTeams;
    private final PlayerRepository players;
    private final RosterEntryRepository rosters;
    private final LeagueGroupRepository groups;
    private final MatchRepository matches;
    private final MatchEventRepository events;
    private final AppearanceRepository appearances;
    private final SeasonDataLoader loader;
    private final AuditService audit;
    private final uz.payariq.liga.repo.RoundTeamRepository roundTeams;

    public TeamPlayerService(TeamRepository teams, SeasonTeamRepository seasonTeams, PlayerRepository players, RosterEntryRepository rosters,
                             LeagueGroupRepository groups, MatchRepository matches, MatchEventRepository events, AppearanceRepository appearances,
                             SeasonDataLoader loader, AuditService audit, uz.payariq.liga.repo.RoundTeamRepository roundTeams) {
        this.roundTeams = roundTeams;
        this.teams = teams;
        this.seasonTeams = seasonTeams;
        this.players = players;
        this.rosters = rosters;
        this.groups = groups;
        this.matches = matches;
        this.events = events;
        this.appearances = appearances;
        this.loader = loader;
        this.audit = audit;
    }

    // ---------- Jamoalar ----------

    public TeamDto createTeam(Requests.TeamInput in, UUID addToSeasonId) {
        String name = in.name().trim();
        requireNameFree(name, null);
        if (addToSeasonId != null) ensureTeamListOpen(addToSeasonId, "yangi jamoa qo‘shib");
        Team t = new Team();
        apply(t, in);
        teams.save(t);
        if (addToSeasonId != null) {
            loader.editableSeason(addToSeasonId);
            addToSeason(t, addToSeasonId);
        }
        audit.record("Jamoa", "«" + t.name + "» jamoasi qo‘shildi", "TEAM", t.getId());
        return TeamDto.of(t);
    }

    public TeamDto updateTeam(UUID teamId, Requests.TeamInput in) {
        Team t = team(teamId);
        String name = in.name().trim();
        requireNameFree(name, teamId);
        apply(t, in);
        // Faqat yakunlanmagan mavsumlardagi nom yangilanadi — arxiv tarixi o'zgarmaydi
        for (SeasonTeam st : seasonTeams.findByTeamId(teamId)) {
            if (!loader.season(st.seasonId).isFinished()) {
                st.name = t.name;
                st.shortName = t.shortName;
            }
        }
        audit.record("Jamoa", "«" + t.name + "» jamoasi ma’lumotlari tahrirlandi", "TEAM", t.getId());
        return TeamDto.of(t);
    }

    public void deleteTeam(UUID teamId) {
        Team t = team(teamId);
        List<SeasonTeam> sts = seasonTeams.findByTeamId(teamId);
        List<UUID> ids = sts.stream().map(SeasonTeam::getId).toList();
        if (!ids.isEmpty() && matches.existsInvolving(ids)) {
            throw ApiException.conflict("«" + t.name + "» o‘yinlari tarixda saqlangan, shuning uchun uni o‘chirib bo‘lmaydi. Uning o‘rniga jamoani mavsumdan chiqaring.");
        }
        for (SeasonTeam st : sts) removeSeasonTeam(st);
        teams.delete(t);
        audit.record("Jamoa", "«" + t.name + "» jamoasi o‘chirildi", "TEAM", teamId);
    }

    /** Tarkibsiz: ariza qabul qilinganda tarkib arizadan olinadi */
    public void setInSeason(UUID teamId, UUID seasonId, boolean inSeason) {
        setInSeason(teamId, seasonId, inSeason, false);
    }

    /**
     * Jamoani mavsumga qo'shadi yoki chiqaradi. withPlayers — jamoa oxirgi ishtirok etgan mavsumdagi tarkibi bilan qo'shiladi.
     * Qaytaradi: ko'chirilgan futbolchilar soni
     */
    public int setInSeason(UUID teamId, UUID seasonId, boolean inSeason, boolean withPlayers) {
        loader.editableSeason(seasonId);
        Team t = team(teamId);
        SeasonTeam st = seasonTeams.findBySeasonIdAndTeamId(seasonId, teamId).orElse(null);
        if (inSeason == (st != null)) return 0;
        ensureTeamListOpen(seasonId, inSeason ? "yangi jamoa qo‘shib" : "jamoani mavsumdan chiqarib");
        int copied = 0;
        if (inSeason && st == null) {
            SeasonTeam added = addToSeason(t, seasonId);
            SeasonTeam previous = withPlayers ? previousEntry(teamId, seasonId) : null;
            if (previous != null) copied = copyRoster(previous, added);
            audit.record("Jamoa", "«" + t.name + "» mavsumga qo‘shildi" + (copied > 0 ? " (oldingi tarkibidan " + copied + " ta futbolchi bilan)" : ""), "TEAM", teamId);
        } else if (!inSeason && st != null) {
            if (matches.existsInvolving(List.of(st.getId()))) {
                throw ApiException.conflict("«" + t.name + "» uchun bu mavsumda o‘yinlar belgilangan. Avval o‘sha o‘yinlarni o‘chiring.");
            }
            removeSeasonTeam(st);
            audit.record("Jamoa", "«" + t.name + "» mavsumdan chiqarildi", "TEAM", teamId);
        }
        return copied;
    }

    /** Jamoaning boshqa mavsumdagi eng so'nggi ishtiroki (sinov mavsumlari hisobga olinmaydi) */
    private SeasonTeam previousEntry(UUID teamId, UUID exceptSeasonId) {
        SeasonTeam best = null;
        int bestNumber = Integer.MIN_VALUE;
        for (SeasonTeam st : seasonTeams.findByTeamId(teamId)) {
            if (st.seasonId.equals(exceptSeasonId)) continue;
            Season s = loader.season(st.seasonId);
            if (s.test || s.number <= bestNumber) continue;
            best = st;
            bestNumber = s.number;
        }
        return best;
    }

    /**
     * Tarkibni yangi mavsumga ko'chiradi: futbolchilar raqamlari bilan, sardor va murabbiy.
     * Shu mavsumda boshqa jamoa tarkibida turgan futbolchi ko'chirilmaydi (u jamoasini almashtirgan). Qaytaradi: ko'chirilganlar soni
     */
    public int copyRoster(SeasonTeam from, SeasonTeam to) {
        int copied = 0;
        boolean captainCopied = false;
        for (RosterEntry r : rosters.findBySeasonTeamId(from.getId())) {
            if (rosters.findBySeasonIdAndPlayerId(to.seasonId, r.playerId).isPresent()) continue;
            RosterEntry copy = new RosterEntry();
            copy.seasonId = to.seasonId;
            copy.seasonTeamId = to.getId();
            copy.playerId = r.playerId;
            copy.shirtNumber = r.shirtNumber;
            rosters.save(copy);
            copied++;
            if (r.playerId.equals(from.captainId)) captainCopied = true;
        }
        if (captainCopied) to.captainId = from.captainId;
        to.coach = from.coach;
        return copied;
    }

    /** Bir xil nomli ikkita jamoa bo'lmaydi: katta-kichik harf, o‘/g‘ tutuq belgisi va ortiqcha bo'shliq farq qilmaydi */
    private void requireNameFree(String name, UUID exceptTeamId) {
        boolean taken = teams.findAll().stream().anyMatch(t -> !t.getId().equals(exceptTeamId) && TeamNames.same(t.name, name));
        if (taken) throw ApiException.conflict("«" + TeamNames.clean(name) + "» nomli jamoa allaqachon bor. Boshqa nom tanlang yoki o‘sha jamoani mavsumga qo‘shing.");
    }

    /** Qur'a tashlangach mavsum ishtirokchilari qulflanadi — aks holda jamoa guruhsiz qoladi yoki guruh juftliklari buziladi */
    private void ensureTeamListOpen(UUID seasonId, String action) {
        if (groups.findBySeasonIdOrderBySortOrderAsc(seasonId).isEmpty()) return;
        throw ApiException.conflict("Qur’a tashlangan — guruhlar shakllangan, bu mavsumga " + action + " bo‘lmaydi. "
                + "Jamoa esdan chiqqan bo‘lsa va hali birorta natija kiritilmagan bo‘lsa, «Guruhlar» bo‘limida qur’ani bekor qiling.");
    }

    private SeasonTeam addToSeason(Team t, UUID seasonId) {
        SeasonTeam st = new SeasonTeam();
        st.seasonId = seasonId;
        st.teamId = t.getId();
        st.name = t.name;
        st.shortName = t.shortName;
        return seasonTeams.save(st);
    }

    private void removeSeasonTeam(SeasonTeam st) {
        for (LeagueGroup g : groups.findBySeasonIdOrderBySortOrderAsc(st.seasonId)) g.seasonTeamIds.remove(st.getId());
        rosters.deleteAll(rosters.findBySeasonTeamId(st.getId()));
        rosters.flush();
        seasonTeams.delete(st);
    }

    private static void apply(Team t, Requests.TeamInput in) {
        t.name = in.name().trim();
        t.shortName = in.shortName().trim().toUpperCase();
        t.village = in.village().trim();
        t.primaryColor = in.primaryColor();
        t.secondaryColor = in.secondaryColor();
        t.founded = in.founded();
        t.logoUrl = in.logoUrl() == null || in.logoUrl().isBlank() ? null : in.logoUrl();
    }

    private Team team(UUID id) {
        return teams.findById(id).orElseThrow(() -> ApiException.notFound("Jamoa topilmadi."));
    }

    // ---------- Futbolchilar ----------

    /** Futbolchi qo'shadi; qaytaradi: yangi futbolchi id (natija kiritishda gol darhol uning nomiga yoziladi) */
    public UUID createPlayer(UUID seasonId, Requests.PlayerInput in) {
        Player p = new Player();
        apply(p, in);
        players.save(p);
        if (in.seasonTeamId() != null) {
            loader.editableSeason(seasonId);
            assignRoster(seasonId, p, in.seasonTeamId(), in.number());
        }
        audit.record("Futbolchi", p.fullName() + " qo‘shildi", "PLAYER", p.getId());
        return p.getId();
    }

    /**
     * Jamoa tarkibiga bir nechta futbolchini birdaniga qo'shadi. Biror qatorda xato bo'lsa hech biri saqlanmaydi
     * va xabarda qator raqami ko'rsatiladi.
     */
    public Created createPlayers(UUID seasonId, Requests.PlayersBulk in) {
        loader.editableSeason(seasonId);
        SeasonTeam st = seasonTeams.findById(in.seasonTeamId()).filter(x -> x.seasonId.equals(seasonId))
                .orElseThrow(() -> ApiException.badRequest("Tanlangan jamoa bu mavsumda ishtirok etmaydi."));
        java.util.Set<Integer> numbers = new java.util.HashSet<>();
        for (int i = 0; i < in.players().size(); i++) {
            Integer n = in.players().get(i).number();
            if (n == null) continue;
            if (!numbers.add(n)) throw ApiException.badRequest((i + 1) + "-qator: " + n + "-raqam ro‘yxatda ikki marta yozilgan.");
            final int row = i + 1;
            rosters.findBySeasonTeamIdAndShirtNumber(st.getId(), n).ifPresent(r -> {
                String owner = players.findById(r.playerId).map(Player::fullName).orElse("boshqa futbolchi");
                throw ApiException.conflict(row + "-qator: " + n + "-raqam " + st.name + " jamoasida " + owner + "ga tegishli.");
            });
        }
        for (Requests.PlayerRow r : in.players()) {
            Player p = new Player();
            apply(p, new Requests.PlayerInput(r.firstName(), r.lastName(), r.birthYear(), r.position(), null, st.getId(), r.number()));
            players.save(p);
            RosterEntry entry = new RosterEntry();
            entry.seasonId = seasonId;
            entry.seasonTeamId = st.getId();
            entry.playerId = p.getId();
            entry.shirtNumber = r.number();
            rosters.save(entry);
        }
        audit.record("Futbolchi", st.name + " tarkibiga " + in.players().size() + " ta futbolchi qo‘shildi", "SEASON", seasonId);
        return new Created(in.players().size());
    }

    public void updatePlayer(UUID seasonId, UUID playerId, Requests.PlayerInput in) {
        Player p = players.findById(playerId).orElseThrow(() -> ApiException.notFound("Futbolchi topilmadi."));
        apply(p, in);
        RosterEntry current = rosters.findBySeasonIdAndPlayerId(seasonId, playerId).orElse(null);
        UUID target = in.seasonTeamId();
        boolean teamChanged = !Objects.equals(current == null ? null : current.seasonTeamId, target);
        boolean numberChanged = current != null && !Objects.equals(current.shirtNumber, in.number());
        if (teamChanged || numberChanged) loader.editableSeason(seasonId);
        if (current != null && teamChanged) {
            if (playedFor(seasonId, playerId, current.seasonTeamId)) {
                throw ApiException.conflict("Bu futbolchi mavsumda jamoasi uchun o‘ynagan. Statistikasi saqlanishi uchun jamoasini mavsum o‘rtasida o‘zgartirib bo‘lmaydi.");
            }
            rosters.delete(current);
            rosters.flush();
            current = null;
        }
        if (target != null) {
            if (current == null) assignRoster(seasonId, p, target, in.number());
            else {
                assertNumberFree(target, in.number(), playerId);
                current.shirtNumber = in.number();
            }
        }
        audit.record("Futbolchi", p.fullName() + " ma’lumotlari tahrirlandi", "PLAYER", playerId);
    }

    public void deletePlayer(UUID playerId) {
        Player p = players.findById(playerId).orElseThrow(() -> ApiException.notFound("Futbolchi topilmadi."));
        // Yakunlangan (arxivdagi) mavsum tarkibidagi futbolchi o'chirilmaydi — tarix o'zgarmasin
        rosters.findByPlayerId(playerId).forEach(r -> loader.editableSeason(r.seasonId));
        if (events.existsForPlayer(playerId) || appearances.existsByPlayerId(playerId)) {
            throw ApiException.conflict("Bu futbolchining o‘yinlar statistikasi bor, uni o‘chirib bo‘lmaydi. Uning o‘rniga jamoa tarkibidan chiqaring.");
        }
        if (roundTeams.existsWithPlayer(playerId)) {
            throw ApiException.conflict("Bu futbolchi ramziy jamoada turibdi — o‘chirishdan oldin uni ramziy jamoada boshqa futbolchiga almashtiring.");
        }
        rosters.deleteAll(rosters.findByPlayerId(playerId));
        for (SeasonTeam st : seasonTeams.findAll()) if (playerId.equals(st.captainId)) st.captainId = null;
        rosters.flush();
        players.delete(p);
        audit.record("Futbolchi", p.fullName() + " o‘chirildi", "PLAYER", playerId);
    }

    private void assignRoster(UUID seasonId, Player p, UUID seasonTeamId, Integer number) {
        SeasonTeam st = seasonTeams.findById(seasonTeamId).orElseThrow(() -> ApiException.notFound("Jamoa topilmadi."));
        if (!st.seasonId.equals(seasonId)) throw ApiException.badRequest("Tanlangan jamoa bu mavsumda ishtirok etmaydi.");
        assertNumberFree(seasonTeamId, number, p.getId());
        RosterEntry r = new RosterEntry();
        r.seasonId = seasonId;
        r.seasonTeamId = seasonTeamId;
        r.playerId = p.getId();
        r.shirtNumber = number;
        rosters.save(r);
    }

    private void assertNumberFree(UUID seasonTeamId, Integer number, UUID playerId) {
        if (number == null) return;
        rosters.findBySeasonTeamIdAndShirtNumber(seasonTeamId, number).filter(r -> !r.playerId.equals(playerId)).ifPresent(r -> {
            String owner = players.findById(r.playerId).map(Player::fullName).orElse("boshqa futbolchi");
            throw ApiException.conflict(number + "-raqam bu jamoada " + owner + "ga tegishli. Boshqa raqam tanlang.");
        });
    }

    private boolean playedFor(UUID seasonId, UUID playerId, UUID seasonTeamId) {
        List<UUID> matchIds = matches.findBySeasonIdOrderByKickoffAsc(seasonId).stream().map(Match::getId).toList();
        if (matchIds.isEmpty()) return false;
        return events.findByMatchIdIn(matchIds).stream().anyMatch(e -> seasonTeamId.equals(e.seasonTeamId) && (playerId.equals(e.playerId) || playerId.equals(e.assistId)))
                || appearances.findByMatchIdIn(matchIds).stream().anyMatch(a -> seasonTeamId.equals(a.seasonTeamId) && playerId.equals(a.playerId));
    }

    private static void apply(Player p, Requests.PlayerInput in) {
        p.firstName = in.firstName().trim();
        p.lastName = in.lastName().trim();
        p.birthYear = in.birthYear();
        p.position = in.position();
        p.phone = in.phone() == null || in.phone().isBlank() ? null : in.phone().trim();
    }
}
