package uz.payariq.liga.repo;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.payariq.liga.model.Venue;

public interface VenueRepository extends JpaRepository<Venue, UUID> {
    List<Venue> findAllByOrderByNameAsc();
}
