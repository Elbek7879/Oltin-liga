package uz.payariq.liga.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.flyway.autoconfigure.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Faqat brauzer (e2e) testlari uchun: ishga tushganda test bazasini to'liq tozalab,
 * sxemani qaytadan yaratadi. Faqat application-e2e.properties da yoqiladi — asosiy bazaga ta'sir qilmaydi.
 */
@Configuration
@ConditionalOnProperty(name = "liga.reset-database", havingValue = "true")
public class E2eDatabaseReset {

    private static final Logger log = LoggerFactory.getLogger(E2eDatabaseReset.class);

    @Bean
    FlywayMigrationStrategy cleanThenMigrate() {
        return flyway -> {
            log.warn("E2E rejimi: test bazasi tozalanmoqda ({})", flyway.getConfiguration().getUrl());
            flyway.clean();
            flyway.migrate();
        };
    }
}
