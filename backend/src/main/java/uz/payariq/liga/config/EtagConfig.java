package uz.payariq.liga.config;

import jakarta.servlet.http.HttpServletRequest;
import java.util.regex.Pattern;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.filter.ShallowEtagHeaderFilter;

/**
 * Katta ommaviy javoblar (mavsum ma'lumotlari va arxiv) uchun ETag: ma'lumot o'zgarmagan bo'lsa brauzer
 * «304 Not Modified» oladi va yuzlab kilobaytni qayta yuklamaydi. Jonli oqimga (SSE) qo'llanmaydi — u bufersiz uzatiladi.
 */
@Configuration
public class EtagConfig {

    static final Pattern BUNDLE = Pattern.compile("^/api/public/seasons/[^/]+/bundle$");

    @Bean
    FilterRegistrationBean<ShallowEtagHeaderFilter> publicEtagFilter() {
        ShallowEtagHeaderFilter filter = new ShallowEtagHeaderFilter() {
            @Override
            protected boolean shouldNotFilter(HttpServletRequest request) {
                if (!"GET".equals(request.getMethod())) return true;
                String uri = request.getRequestURI();
                return !(BUNDLE.matcher(uri).matches() || "/api/public/archive".equals(uri));
            }
        };
        // Javob siqilgan holda ham uzatiladi — shuning uchun «kuchsiz» ETag
        filter.setWriteWeakETag(true);
        FilterRegistrationBean<ShallowEtagHeaderFilter> registration = new FilterRegistrationBean<>(filter);
        registration.addUrlPatterns("/api/public/*");
        return registration;
    }
}
