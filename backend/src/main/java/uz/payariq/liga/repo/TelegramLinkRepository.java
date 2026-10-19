package uz.payariq.liga.repo;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.payariq.liga.model.TelegramLink;

public interface TelegramLinkRepository extends JpaRepository<TelegramLink, UUID> {
    Optional<TelegramLink> findByChatId(long chatId);

    Optional<TelegramLink> findByUserId(UUID userId);
}
