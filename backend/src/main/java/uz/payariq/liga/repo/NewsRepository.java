package uz.payariq.liga.repo;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.payariq.liga.domain.NewsStatus;
import uz.payariq.liga.model.News;

public interface NewsRepository extends JpaRepository<News, UUID> {
    List<News> findByStatusOrderByPublishedAtDesc(NewsStatus status);

    List<News> findAllByOrderByPublishedAtDesc();

    Optional<News> findBySlugAndStatus(String slug, NewsStatus status);

    boolean existsBySlugAndIdNot(String slug, UUID id);

    boolean existsBySlug(String slug);
}
