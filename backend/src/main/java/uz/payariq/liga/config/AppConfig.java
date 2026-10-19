package uz.payariq.liga.config;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AppConfig {

    /** Vaqtni testlarda boshqarish uchun yagona soat */
    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }
}
