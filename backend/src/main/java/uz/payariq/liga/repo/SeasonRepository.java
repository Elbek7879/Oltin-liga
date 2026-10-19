package uz.payariq.liga.repo;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import uz.payariq.liga.domain.SeasonStatus;
import uz.payariq.liga.model.Season;

public interface SeasonRepository extends JpaRepository<Season, UUID> {
    List<Season> findAllByOrderByYearDescNumberDesc();

    Optional<Season> findFirstByStatus(SeasonStatus status);

    @Query("select coalesce(max(s.number), 0) from Season s")
    int maxNumber();
}
