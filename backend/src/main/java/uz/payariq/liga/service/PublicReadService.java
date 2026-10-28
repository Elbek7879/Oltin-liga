package uz.payariq.liga.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.payariq.liga.common.ApiException;
import uz.payariq.liga.domain.AwardType;
import uz.payariq.liga.domain.MatchStage;
import uz.payariq.liga.domain.MatchStatus;
import uz.payariq.liga.domain.NewsStatus;
import uz.payariq.liga.domain.PlayerStats;
import uz.payariq.liga.domain.PlayoffRound;
import uz.payariq.liga.domain.StandingsCalculator.StandingRow;
import uz.payariq.liga.model.LeagueGroup;
import uz.payariq.liga.model.Match;
import uz.payariq.liga.model.Player;
import uz.payariq.liga.model.RosterEntry;
import uz.payariq.liga.model.Season;
import uz.payariq.liga.model.SeasonAward;
import uz.payariq.liga.model.SeasonTeam;
import uz.payariq.liga.model.Team;
import uz.payariq.liga.repo.LeagueSettingsRepository;
import uz.payariq.liga.repo.MatchRepository;
import uz.payariq.liga.repo.NewsRepository;
import uz.payariq.liga.repo.PlayerRepository;
import uz.payariq.liga.repo.RosterEntryRepository;
import uz.payariq.liga.repo.SeasonAwardRepository;
import uz.payariq.liga.repo.SeasonRepository;
import uz.payariq.liga.repo.SeasonTeamRepository;
import uz.payariq.liga.repo.SponsorRepository;
import uz.payariq.liga.repo.TeamRepository;
import uz.payariq.liga.repo.VenueRepository;
import uz.payariq.liga.web.Dto.AdjustmentDto;
import uz.payariq.liga.web.Dto.AppearanceDto;
import uz.payariq.liga.web.Dto.ArchiveBundle;
import uz.payariq.liga.web.Dto.AwardDto;
import uz.payariq.liga.web.Dto.AwardWithSeason;
import uz.payariq.liga.web.Dto.GroupDto;
import uz.payariq.liga.web.Dto.HeadToHead;
import uz.payariq.liga.web.Dto.LotDto;
import uz.payariq.liga.web.Dto.MatchDto;
import uz.payariq.liga.web.Dto.MatchEventDto;
import uz.payariq.liga.web.Dto.MatchSeason;
import uz.payariq.liga.web.Dto.NewsDto;
import uz.payariq.liga.web.Dto.PlayerProfile;
import uz.payariq.liga.web.Dto.PlayerSeasonRecord;
import uz.payariq.liga.web.Dto.PlayerStatsDto;
import uz.payariq.liga.web.Dto.PublicPlayer;
import uz.payariq.liga.web.Dto.RosterView;
import uz.payariq.liga.web.Dto.ScorerSummary;
import uz.payariq.liga.web.Dto.SeasonBundle;
import uz.payariq.liga.web.Dto.SeasonDto;
import uz.payariq.liga.web.Dto.SeasonSummary;
import uz.payariq.liga.web.Dto.SettingsDto;
import uz.payariq.liga.web.Dto.SponsorDto;
import uz.payariq.liga.web.Dto.TeamDto;
import uz.payariq.liga.web.Dto.TeamProfile;
import uz.payariq.liga.web.Dto.TeamSeasonRecord;
import uz.payariq.liga.web.Dto.TeamView;
import uz.payariq.liga.web.Dto.VenueDto;

/** Muxlislar uchun ommaviy ma'lumotlar (faqat o'qish). Maxfiy maydonlar bu yerda hech qachon qaytarilmaydi. */
@Service
@Transactional(readOnly = true)
public class PublicReadService {

    private final SeasonDataLoader loader;
    private final SeasonRepository seasons;
    private final TeamRepository teams;
    private final SeasonTeamRepository seasonTeams;
    private final PlayerRepository players;
    private final RosterEntryRepository rosters;
    private final MatchRepository matches;
    private final SeasonAwardRepository awards;
    private final VenueRepository venues;
    private final NewsRepository news;
    private final SponsorRepository sponsors;
    private final LeagueSettingsRepository settings;
    private final uz.payariq.liga.repo.RoundTeamRepository roundTeams;

    public PublicReadService(SeasonDataLoader loader, SeasonRepository seasons, TeamRepository teams, SeasonTeamRepository seasonTeams,
                             PlayerRepository players, RosterEntryRepository rosters, MatchRepository matches, SeasonAwardRepository awards,
                             VenueRepository venues, NewsRepository news, SponsorRepository sponsors, LeagueSettingsRepository settings,
                             uz.payariq.liga.repo.RoundTeamRepository roundTeams) {
        this.roundTeams = roundTeams;
        this.loader = loader;
        this.seasons = seasons;
        this.teams = teams;
        this.seasonTeams = seasonTeams;
        this.players = players;
        this.rosters = rosters;
        this.matches = matches;
        this.awards = awards;
        this.venues = venues;
        this.news = news;
        this.sponsors = sponsors;
        this.settings = settings;
    }

    public SettingsDto settings() {
        return settings.findFirstByOrderByCreatedAtAsc().map(SettingsDto::of)
                .orElseThrow(() -> ApiException.notFound("Liga sozlamalari topilmadi."));
    }

    /** Saytdagi mavsumlar: sinov mavsumlari muxlislarga ko'rsatilmaydi */
    public List<SeasonDto> seasons() {
        return publicSeasons().stream().map(SeasonDto::of).toList();
    }

    private List<Season> publicSeasons() {
        return seasons.findAllByOrderByYearDescNumberDesc().stream().filter(s -> !s.test).toList();
    }

    private Set<UUID> testSeasonIds() {
        return seasons.findByTestTrue().stream().map(Season::getId).collect(Collectors.toSet());
    }

    /** Muxlislar uchun mavsum ma'lumotlari: sinov mavsumi yashirin (uni faqat tashkilotchilar ko'radi) */
    public SeasonBundle publicBundle(UUID seasonId) {
        Season s = seasons.findById(seasonId).orElseThrow(() -> ApiException.notFound("Mavsum topilmadi."));
        if (s.test) throw ApiException.notFound("Mavsum topilmadi.");
        return bundle(seasonId);
    }

    /** O'yin qaysi mavsumga tegishli — boshqa mavsum o'yiniga havola ochilganda sayt shu mavsumga o'tadi */
    public MatchSeason matchSeason(UUID matchId, boolean includeTest) {
        Match m = matches.findById(matchId).orElseThrow(() -> ApiException.notFound("O‘yin topilmadi."));
        boolean hidden = seasons.findById(m.seasonId).map(s -> s.test).orElse(true);
        if (hidden && !includeTest) throw ApiException.notFound("O‘yin topilmadi.");
        return new MatchSeason(m.seasonId);
    }

    public SeasonBundle bundle(UUID seasonId) {
        SeasonData d = loader.load(seasonId);
        Map<UUID, List<StandingRow>> standings = d.standings();
        return new SeasonBundle(
                SeasonDto.of(d.season()),
                d.views().stream().sorted(Comparator.comparing(TeamView::name)).toList(),
                d.groups().stream().map(GroupDto::of).toList(),
                d.matches().stream().map(MatchDto::of).toList(),
                d.events().stream().map(MatchEventDto::of).toList(),
                d.appearances().stream().map(AppearanceDto::of).toList(),
                d.players().values().stream().map(PublicPlayer::of).toList(),
                d.rosters().stream().map(r -> new RosterView(r.playerId, r.seasonTeamId, r.shirtNumber)).toList(),
                venues.findAllByOrderByNameAsc().stream().map(VenueDto::of).toList(),
                standings,
                d.playerStats().stream().map(PlayerStatsDto::of).toList(),
                d.discipline(),
                d.awards().stream().map(AwardDto::of).toList(),
                d.adjustments().stream().map(AdjustmentDto::of).toList(),
                d.lots().stream().map(LotDto::of).toList(),
                roundTeams.findBySeasonIdAndPublishedTrueOrderByPublishedAtAsc(seasonId).stream().map(uz.payariq.liga.web.Dto.RoundTeamDto::of).toList());
    }

    // ---------- Arxiv ----------

    public ArchiveBundle archive() {
        List<SeasonSummary> summaries = new ArrayList<>();
        List<TeamView> finalTeams = new ArrayList<>();
        for (Season s : publicSeasons()) {
            SeasonData d = loader.load(s.getId());
            SeasonSummary summary = summary(d);
            summaries.add(summary);
            if (summary.finalMatch() != null) {
                Stream.of(summary.finalMatch().homeId(), summary.finalMatch().awayId()).filter(Objects::nonNull).map(d::view).forEach(finalTeams::add);
            }
        }
        return new ArchiveBundle(summaries, finalTeams);
    }

    SeasonSummary summary(SeasonData d) {
        List<Match> finished = d.matches().stream().filter(m -> m.status == MatchStatus.FINISHED).toList();
        int goals = finished.stream().mapToInt(m -> m.homeTotal() + m.awayTotal()).sum();
        Match fin = d.matches().stream().filter(m -> m.playoffRound == PlayoffRound.F).findFirst().orElse(null);
        return new SeasonSummary(
                SeasonDto.of(d.season()),
                d.seasonTeams().size(),
                finished.size(),
                (int) d.matches().stream().filter(m -> m.status != MatchStatus.CANCELLED).count(),
                goals,
                awardTeam(d, AwardType.CHAMPION),
                awardTeam(d, AwardType.RUNNER_UP),
                awardTeam(d, AwardType.THIRD),
                topScorer(d),
                fin == null ? null : MatchDto.of(fin));
    }

    private static TeamView awardTeam(SeasonData d, AwardType type) {
        return d.awards().stream().filter(a -> a.type == type && a.seasonTeamId != null).findFirst().map(a -> d.view(a.seasonTeamId)).orElse(null);
    }

    /** Mavsum to'purari: yakunlangan mavsumda tasdiqlangan mukofot, aks holda hisoblangan reyting */
    ScorerSummary topScorer(SeasonData d) {
        List<PlayerStats.Row> stats = d.playerStats();
        List<PlayerStats.Row> top = PlayerStats.topScorers(stats, d::playerName);
        SeasonAward award = d.awards().stream().filter(a -> a.type == AwardType.TOP_SCORER && a.playerId != null).findFirst().orElse(null);
        if (award != null) {
            int goals = stats.stream().filter(s -> s.playerId.equals(award.playerId)).mapToInt(s -> s.goals).sum();
            PublicPlayer p = d.publicPlayer(award.playerId);
            if (p != null) return new ScorerSummary(p, d.view(award.seasonTeamId), goals);
        }
        if (top.isEmpty()) return null;
        PlayerStats.Row best = top.get(0);
        return new ScorerSummary(d.publicPlayer(best.playerId), d.view(best.seasonTeamId), best.goals);
    }

    // ---------- Jamoa va futbolchi profili ----------

    public TeamProfile teamProfile(UUID teamId) {
        Team team = teams.findById(teamId).orElseThrow(() -> ApiException.notFound("Jamoa topilmadi."));
        Set<UUID> hidden = testSeasonIds();
        List<SeasonTeam> all = seasonTeams.findByTeamId(teamId);
        List<SeasonTeam> sts = all.stream().filter(st -> !hidden.contains(st.seasonId)).toList();
        // Faqat sinov mavsumida qatnashgan jamoa saytda yo'q
        if (!all.isEmpty() && sts.isEmpty()) throw ApiException.notFound("Jamoa topilmadi.");
        List<TeamSeasonRecord> records = new ArrayList<>();
        List<TeamView> views = new ArrayList<>();
        Set<UUID> stIds = sts.stream().map(SeasonTeam::getId).collect(Collectors.toSet());
        for (SeasonTeam st : sts) {
            SeasonData d = loader.load(st.seasonId);
            records.add(teamRecord(d, st));
            views.addAll(d.views());
        }
        records.sort(Comparator.comparingInt((TeamSeasonRecord r) -> r.season().year()).reversed());
        List<Match> involved = stIds.isEmpty() ? List.of() : matches.findInvolving(stIds);
        Set<UUID> involvedTeams = involved.stream().flatMap(m -> Stream.of(m.homeId, m.awayId)).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<UUID, TeamView> uniqueViews = views.stream().filter(v -> involvedTeams.contains(v.id()) || stIds.contains(v.id()))
                .collect(Collectors.toMap(TeamView::id, Function.identity(), (a, b) -> a));
        return new TeamProfile(TeamDto.of(team), records, involved.stream().map(MatchDto::of).toList(), List.copyOf(uniqueViews.values()));
    }

    private TeamSeasonRecord teamRecord(SeasonData d, SeasonTeam st) {
        UUID id = st.getId();
        LeagueGroup group = d.groups().stream().filter(g -> g.seasonTeamIds.contains(id)).findFirst().orElse(null);
        StandingRow row = group == null ? null : d.standings().get(group.getId()).stream().filter(r -> r.seasonTeamId().equals(id)).findFirst().orElse(null);
        int won = 0, drawn = 0, lost = 0, gf = 0, ga = 0, played = 0;
        for (Match m : d.matches()) {
            if (m.status != MatchStatus.FINISHED || !m.involves(id)) continue;
            boolean home = id.equals(m.homeId);
            int f = home ? m.homeTotal() : m.awayTotal();
            int a = home ? m.awayTotal() : m.homeTotal();
            played++;
            gf += f;
            ga += a;
            if (id.equals(m.winnerId)) won++;
            else if (m.winnerId == null && f == a) drawn++;
            else lost++;
        }
        AwardType achievement = d.awards().stream()
                .filter(a -> id.equals(a.seasonTeamId) && (a.type == AwardType.CHAMPION || a.type == AwardType.RUNNER_UP || a.type == AwardType.THIRD))
                .map(a -> a.type).findFirst().orElse(null);
        String stageReached = d.matches().stream()
                .filter(m -> m.stage == MatchStage.PLAYOFF && m.involves(id) && m.playoffRound != PlayoffRound.THIRD)
                .map(m -> m.playoffRound)
                .max(Comparator.naturalOrder())
                .map(Enum::name)
                .orElse(group != null ? "GROUP" : null);
        return new TeamSeasonRecord(SeasonDto.of(d.season()), d.view(st), group == null ? null : group.name,
                row != null && row.played() > 0 ? row.position() : null, played, won, drawn, lost, gf, ga, achievement, stageReached);
    }

    public PlayerProfile playerProfile(UUID playerId) {
        Player player = players.findById(playerId).orElseThrow(() -> ApiException.notFound("Futbolchi topilmadi."));
        Set<UUID> hidden = testSeasonIds();
        List<RosterEntry> all = rosters.findByPlayerId(playerId);
        List<RosterEntry> visible = all.stream().filter(r -> !hidden.contains(r.seasonId)).toList();
        if (!all.isEmpty() && visible.isEmpty()) throw ApiException.notFound("Futbolchi topilmadi.");
        List<PlayerSeasonRecord> records = new ArrayList<>();
        for (RosterEntry r : visible) {
            SeasonData d = loader.load(r.seasonId);
            PlayerStatsDto stats = d.playerStats().stream()
                    .filter(s -> s.playerId.equals(playerId) && s.seasonTeamId.equals(r.seasonTeamId))
                    .findFirst().map(PlayerStatsDto::of).orElse(PlayerStatsDto.empty(playerId, r.seasonTeamId));
            records.add(new PlayerSeasonRecord(SeasonDto.of(d.season()), d.view(r.seasonTeamId), r.shirtNumber, stats));
        }
        records.sort(Comparator.comparingInt((PlayerSeasonRecord r) -> r.season().year()).reversed());
        List<AwardWithSeason> playerAwards = awards.findByPlayerId(playerId).stream()
                .filter(a -> !hidden.contains(a.seasonId))
                .map(a -> new AwardWithSeason(a.getId(), a.seasonId, a.type, a.seasonTeamId, a.playerId, a.note, SeasonDto.of(loader.season(a.seasonId))))
                .toList();
        return new PlayerProfile(PublicPlayer.of(player), records, playerAwards);
    }

    /** Ikki jamoa o'rtasidagi barcha mavsumlardagi rasmiy uchrashuvlar */
    public HeadToHead headToHead(UUID teamA, UUID teamB) {
        Set<UUID> hidden = testSeasonIds();
        Set<UUID> a = seasonTeams.findByTeamId(teamA).stream().filter(st -> !hidden.contains(st.seasonId)).map(SeasonTeam::getId).collect(Collectors.toSet());
        Set<UUID> b = seasonTeams.findByTeamId(teamB).stream().filter(st -> !hidden.contains(st.seasonId)).map(SeasonTeam::getId).collect(Collectors.toSet());
        if (a.isEmpty() || b.isEmpty()) return new HeadToHead(List.of(), List.of(), seasons());
        List<Match> list = matches.findInvolving(a).stream()
                .filter(m -> m.status == MatchStatus.FINISHED && m.homeId != null && m.awayId != null)
                .filter(m -> (a.contains(m.homeId) && b.contains(m.awayId)) || (b.contains(m.homeId) && a.contains(m.awayId)))
                .toList();
        Set<UUID> ids = new HashSet<>();
        list.forEach(m -> {
            ids.add(m.homeId);
            ids.add(m.awayId);
        });
        Map<UUID, Team> teamMap = teams.findAllById(List.of(teamA, teamB)).stream().collect(Collectors.toMap(Team::getId, Function.identity()));
        List<TeamView> views = seasonTeams.findAllById(ids).stream().map(st -> {
            Team t = teamMap.get(st.teamId);
            return new TeamView(st.getId(), st.teamId, st.seasonId, st.name, st.shortName, t.village, t.primaryColor, t.secondaryColor, st.captainId, st.coach, t.logoUrl);
        }).toList();
        return new HeadToHead(list.stream().map(MatchDto::of).toList(), views, seasons());
    }

    // ---------- Kontent ----------

    public List<NewsDto> news(boolean includeDrafts) {
        return (includeDrafts ? news.findAllByOrderByPublishedAtDesc() : news.findByStatusOrderByPublishedAtDesc(NewsStatus.PUBLISHED))
                .stream().map(NewsDto::of).toList();
    }

    public NewsDto newsBySlug(String slug) {
        return news.findBySlugAndStatus(slug, NewsStatus.PUBLISHED).map(NewsDto::of)
                .orElseThrow(() -> ApiException.notFound("Yangilik topilmadi yoki hali e’lon qilinmagan."));
    }

    public List<SponsorDto> sponsors(boolean includeInactive) {
        return (includeInactive ? sponsors.findAllByOrderBySortOrderAscNameAsc() : sponsors.findByActiveTrueOrderBySortOrderAscNameAsc())
                .stream().map(SponsorDto::of).toList();
    }

    public List<VenueDto> venues() {
        return venues.findAllByOrderByNameAsc().stream().map(VenueDto::of).toList();
    }
}
