package uz.payariq.liga.web;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import uz.payariq.liga.domain.AwardType;
import uz.payariq.liga.domain.DecidedBy;
import uz.payariq.liga.domain.EventType;
import uz.payariq.liga.domain.LivePeriod;
import uz.payariq.liga.domain.MatchStage;
import uz.payariq.liga.domain.MatchStatus;
import uz.payariq.liga.domain.NewsStatus;
import uz.payariq.liga.domain.PlayerStats;
import uz.payariq.liga.domain.PlayoffRound;
import uz.payariq.liga.domain.Position;
import uz.payariq.liga.domain.Role;
import uz.payariq.liga.domain.SeasonStatus;
import uz.payariq.liga.domain.SponsorTier;
import uz.payariq.liga.domain.StandingsCalculator.StandingRow;
import uz.payariq.liga.domain.Tiebreaker;
import uz.payariq.liga.model.AppUser;
import uz.payariq.liga.model.Appearance;
import uz.payariq.liga.model.LeagueGroup;
import uz.payariq.liga.model.LeagueSettings;
import uz.payariq.liga.model.Match;
import uz.payariq.liga.model.MatchEvent;
import uz.payariq.liga.model.News;
import uz.payariq.liga.model.Player;
import uz.payariq.liga.model.PointAdjustment;
import uz.payariq.liga.model.Season;
import uz.payariq.liga.model.SeasonAward;
import uz.payariq.liga.model.Sponsor;
import uz.payariq.liga.model.Team;
import uz.payariq.liga.model.TiebreakLot;
import uz.payariq.liga.model.Venue;

/**
 * API javoblari. Maydon nomlari frontenddagi TypeScript turlari (src/api/types.ts,
 * src/domain/types.ts) bilan aynan bir xil.
 */
public final class Dto {

    private Dto() {
    }

    public record SeasonRules(int pointsWin, int pointsDraw, int pointsLoss, List<Tiebreaker> tiebreakers, int legs, int qualifiersPerGroup,
                              Map<Integer, Integer> qualifiersBySize, boolean thirdPlaceMatch, int halfMinutes) {
    }

    public record SeasonDto(UUID id, int number, String name, int year, LocalDate startDate, LocalDate endDate, SeasonStatus status, SeasonRules rules) {
        public static SeasonDto of(Season s) {
            return new SeasonDto(s.getId(), s.number, s.name, s.year, s.startDate, s.endDate, s.status,
                    new SeasonRules(s.pointsWin, s.pointsDraw, s.pointsLoss, s.tiebreakerList(), s.legs, s.qualifiersPerGroup, s.qualifiersBySizeMap(), s.thirdPlaceMatch, s.halfMinutes));
        }
    }

    public record TeamDto(UUID id, String name, String shortName, String village, String primaryColor, String secondaryColor, Integer founded, boolean active, String logoUrl) {
        public static TeamDto of(Team t) {
            return new TeamDto(t.getId(), t.name, t.shortName, t.village, t.primaryColor, t.secondaryColor, t.founded, t.active, t.logoUrl);
        }
    }

    public record TeamView(UUID id, UUID teamId, UUID seasonId, String name, String shortName, String village, String primaryColor, String secondaryColor, UUID captainId, String coach, String logoUrl) {
    }

    /** Ommaviy saytdagi futbolchi — telefon kabi maxfiy maydonlarsiz */
    public record PublicPlayer(UUID id, String firstName, String lastName, Position position, Integer birthYear) {
        public static PublicPlayer of(Player p) {
            return new PublicPlayer(p.getId(), p.firstName, p.lastName, p.position, p.birthYear);
        }
    }

    public record RosterView(UUID playerId, UUID seasonTeamId, Integer number) {
    }

    public record GroupDto(UUID id, UUID seasonId, String name, int order, List<UUID> seasonTeamIds) {
        public static GroupDto of(LeagueGroup g) {
            return new GroupDto(g.getId(), g.seasonId, g.name, g.sortOrder, List.copyOf(g.seasonTeamIds));
        }
    }

    public record VenueDto(UUID id, String name, String village) {
        public static VenueDto of(Venue v) {
            return new VenueDto(v.getId(), v.name, v.village);
        }
    }

    public record MatchDto(
            UUID id, UUID seasonId, MatchStage stage, UUID groupId, Integer round, PlayoffRound playoffRound, Integer bracketIndex,
            UUID homeId, UUID awayId, String homeLabel, String awayLabel, Instant kickoff, boolean timeConfirmed, UUID venueId, MatchStatus status,
            Integer homeScore, Integer awayScore, Integer homeExtra, Integer awayExtra, Integer homePens, Integer awayPens,
            DecidedBy decidedBy, UUID winnerId, UUID nextMatchId, String nextSlot, UUID loserNextMatchId, String loserNextSlot,
            String referee, Integer liveMinute, LivePeriod livePeriod, Instant periodStartedAt, String note) {
        public static MatchDto of(Match m) {
            return new MatchDto(m.getId(), m.seasonId, m.stage, m.groupId, m.round, m.playoffRound, m.bracketIndex,
                    m.homeId, m.awayId, m.homeLabel, m.awayLabel, m.kickoff, m.timeConfirmed, m.venueId, m.status,
                    m.homeScore, m.awayScore, m.homeExtra, m.awayExtra, m.homePens, m.awayPens,
                    m.decidedBy, m.winnerId, m.nextMatchId, m.nextSlot, m.loserNextMatchId, m.loserNextSlot,
                    m.referee, m.liveMinute, m.livePeriod, m.periodStartedAt, m.note);
        }
    }

    public record MatchEventDto(UUID id, UUID matchId, EventType type, Integer minute, UUID playerId, UUID seasonTeamId, UUID assistId) {
        public static MatchEventDto of(MatchEvent e) {
            return new MatchEventDto(e.getId(), e.matchId, e.type, e.minute, e.playerId, e.seasonTeamId, e.assistId);
        }
    }

    public record AppearanceDto(UUID matchId, UUID seasonTeamId, UUID playerId) {
        public static AppearanceDto of(Appearance a) {
            return new AppearanceDto(a.matchId, a.seasonTeamId, a.playerId);
        }
    }

    public record PlayerStatsDto(UUID playerId, UUID seasonTeamId, int appearances, int goals, int penaltyGoals, int ownGoals, int assists, int yellow, int red) {
        public static PlayerStatsDto of(PlayerStats.Row r) {
            return new PlayerStatsDto(r.playerId, r.seasonTeamId, r.appearances, r.goals, r.penaltyGoals, r.ownGoals, r.assists, r.yellow, r.red);
        }

        public static PlayerStatsDto empty(UUID playerId, UUID seasonTeamId) {
            return new PlayerStatsDto(playerId, seasonTeamId, 0, 0, 0, 0, 0, 0, 0);
        }
    }

    public record AwardDto(UUID id, UUID seasonId, AwardType type, UUID seasonTeamId, UUID playerId, String note) {
        public static AwardDto of(SeasonAward a) {
            return new AwardDto(a.getId(), a.seasonId, a.type, a.seasonTeamId, a.playerId, a.note);
        }
    }

    public record AwardWithSeason(UUID id, UUID seasonId, AwardType type, UUID seasonTeamId, UUID playerId, String note, SeasonDto season) {
    }

    public record AdjustmentDto(UUID id, UUID seasonId, UUID seasonTeamId, int points, String reason, Instant createdAt) {
        public static AdjustmentDto of(PointAdjustment a) {
            return new AdjustmentDto(a.getId(), a.seasonId, a.seasonTeamId, a.points, a.reason, a.getCreatedAt());
        }
    }

    public record SeasonBundle(
            SeasonDto season,
            List<TeamView> teams,
            List<GroupDto> groups,
            List<MatchDto> matches,
            List<MatchEventDto> events,
            List<AppearanceDto> appearances,
            List<PublicPlayer> players,
            List<RosterView> rosters,
            List<VenueDto> venues,
            Map<UUID, List<StandingRow>> standings,
            List<PlayerStatsDto> playerStats,
            List<PlayerStats.TeamDiscipline> discipline,
            List<AwardDto> awards,
            List<AdjustmentDto> adjustments,
            List<LotDto> lots) {
    }

    /** Teng holatdagi qur'a natijasi: scope — "GROUP:<id>" yoki "SEED:<o'rin>" */
    public record LotDto(String scope, List<UUID> order) {
        public static LotDto of(TiebreakLot l) {
            return new LotDto(l.scope, l.order());
        }
    }

    public record ScorerSummary(PublicPlayer player, TeamView team, int goals) {
    }

    /** Frontend "final" maydonini kutadi; Java'da final kalit so'z bo'lgani uchun JSON nomi alohida berilgan */
    public record SeasonSummary(SeasonDto season, int teamsCount, int matchesPlayed, int matchesTotal, int goals,
                                TeamView champion, TeamView runnerUp, TeamView third, ScorerSummary topScorer,
                                @JsonProperty("final") MatchDto finalMatch) {
    }

    public record ArchiveBundle(List<SeasonSummary> summaries, List<TeamView> teams) {
    }

    public record TeamSeasonRecord(SeasonDto season, TeamView team, String groupName, Integer position, int played, int won, int drawn, int lost,
                                   int goalsFor, int goalsAgainst, AwardType achievement, String stageReached) {
    }

    public record TeamProfile(TeamDto team, List<TeamSeasonRecord> records, List<MatchDto> matches, List<TeamView> teams) {
    }

    public record PlayerSeasonRecord(SeasonDto season, TeamView team, Integer number, PlayerStatsDto stats) {
    }

    public record PlayerProfile(PublicPlayer player, List<PlayerSeasonRecord> records, List<AwardWithSeason> awards) {
    }

    public record HeadToHead(List<MatchDto> matches, List<TeamView> teams, List<SeasonDto> seasons) {
    }

    public record NewsDto(UUID id, String slug, String title, String excerpt, String body, Instant publishedAt, boolean important, NewsStatus status) {
        public static NewsDto of(News n) {
            return new NewsDto(n.getId(), n.slug, n.title, n.excerpt, n.body, n.publishedAt, n.important, n.status);
        }
    }

    public record SponsorDto(UUID id, String name, SponsorTier tier, String description, String url, String logoUrl, boolean active, int order) {
        public static SponsorDto of(Sponsor s) {
            return new SponsorDto(s.getId(), s.name, s.tier, s.description, s.url, s.logoUrl, s.active, s.sortOrder);
        }
    }

    public record SettingsDto(String name, String shortName, String region, String about, String contactPhone, String telegram) {
        public static SettingsDto of(LeagueSettings s) {
            return new SettingsDto(s.name, s.shortName, s.region, s.about, s.contactPhone, s.telegram);
        }
    }

    public record AdminUser(String username, String displayName, Role role) {
    }

    // ---------- Admin ----------

    public record AdminTeamRow(UUID id, String name, String shortName, String village, String primaryColor, String secondaryColor, Integer founded,
                               boolean active, String logoUrl, boolean inSeason, UUID seasonTeamId, int playersCount, boolean hasHistory) {
    }

    /** Admin uchun futbolchi — telefon raqami bilan */
    public record AdminPlayerRow(UUID id, String firstName, String lastName, Integer birthYear, Position position, String phone,
                                 UUID seasonTeamId, Integer number, int goals, boolean hasHistory) {
    }

    public record AuditDto(UUID id, Instant at, String user, String action, String summary) {
    }

    public record Dashboard(SeasonDto season, int teamsCount, int playersCount, int matchesTotal, int matchesFinished,
                            List<MatchDto> pendingResults, List<MatchDto> today, List<MatchDto> upcoming, List<AuditDto> recentAudit,
                            List<TeamView> teams, int groupsCount) {
    }

    public record FinishPreview(boolean canFinish, List<String> problems, TeamView champion, TeamView runnerUp, TeamView third,
                                ScorerSummary topScorer, TeamView fairPlay) {
    }

    public record TeamGoals(TeamView team, int goals) {
    }

    public record TeamConceded(TeamView team, int conceded) {
    }

    public record Report(SeasonDto season, int matchesFinished, int goals, double avgGoals, int yellow, int red, MatchDto biggestWin,
                         TeamGoals bestAttack, TeamConceded bestDefence, List<TeamView> teams) {
    }

    public record Created(int created) {
    }

    public record MediaDto(String url) {
    }

    /** Tashkilotchi akkaunti (parol xeshi hech qachon qaytarilmaydi) */
    public record UserDto(UUID id, String username, String displayName, Role role, boolean enabled, Instant lastLoginAt, Instant createdAt) {
        public static UserDto of(AppUser u) {
            return new UserDto(u.getId(), u.username, u.displayName, u.role, u.enabled, u.lastLoginAt, u.getCreatedAt());
        }
    }
}
