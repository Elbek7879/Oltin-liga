package uz.payariq.liga.repo;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.payariq.liga.domain.FeedbackStatus;
import uz.payariq.liga.model.FeedbackMessage;

public interface FeedbackMessageRepository extends JpaRepository<FeedbackMessage, UUID> {
    List<FeedbackMessage> findAllByOrderByCreatedAtDesc();

    long countByStatus(FeedbackStatus status);
}
