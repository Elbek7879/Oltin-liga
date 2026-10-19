package uz.payariq.liga.repo;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.Instant;
import uz.payariq.liga.domain.MatchStage;
import uz.payariq.liga.domain.MatchStatus;
import uz.payariq.liga.model.Match;

public interface MatchRepository extends JpaRepository<Match, UUID> {
    List<Match> findBySeasonIdOrderByKickoffAsc(UUID seasonId);

    List<Match> findBySeasonIdAndStage(UUID seasonId, MatchStage stage);

    boolean existsByGroupId(UUID groupId);

    List<Match> findByStatus(MatchStatus status);

    List<Match> findByKickoffBetweenOrderByKickoffAsc(Instant from, Instant to);

    @Query("select m from Match m where m.homeId in :ids or m.awayId in :ids order by m.kickoff desc")
    List<Match> findInvolving(@Param("ids") Collection<UUID> seasonTeamIds);

    @Query("select count(m) > 0 from Match m where m.homeId in :ids or m.awayId in :ids")
    boolean existsInvolving(@Param("ids") Collection<UUID> seasonTeamIds);

    @Query("select distinct m.homeId from Match m where m.homeId is not null")
    List<UUID> allHomeIds();

    @Query("select distinct m.awayId from Match m where m.awayId is not null")
    List<UUID> allAwayIds();
}
