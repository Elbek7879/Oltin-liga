package uz.payariq.liga;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import uz.payariq.liga.config.BootstrapRunner;
import uz.payariq.liga.repo.VenueRepository;

class BootstrapIntegrationTest extends IntegrationTestBase {

    @Autowired
    private BootstrapRunner bootstrap;
    @Autowired
    private VenueRepository venues;
    @Autowired
    private JdbcTemplate jdbc;

    @Test
    @DisplayName("birinchi o'rnatishda asosiy stadion yaratiladi, keyin o'chirilsa qayta yaratilmaydi")
    void mainVenueOnFirstInstall() {
        jdbc.update("delete from league_settings");
        bootstrap.run(null);
        assertThat(venues.findAll()).extracting(v -> v.name).containsExactly(BootstrapRunner.MAIN_VENUE);
        assertThat(jdbc.queryForObject("select about from league_settings", String.class)).contains(BootstrapRunner.MAIN_VENUE);

        // Tashkilotchi maydonni o'chirgan bo'lsa, server qayta ishga tushganda u qaytib kelmaydi
        venues.deleteAll();
        bootstrap.run(null);
        assertThat(venues.count()).isZero();
    }
}
