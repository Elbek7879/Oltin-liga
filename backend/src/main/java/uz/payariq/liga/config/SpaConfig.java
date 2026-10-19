package uz.payariq.liga.config;

import java.io.IOException;
import java.util.concurrent.TimeUnit;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

/**
 * Production'da frontend (Vite build) shu jar ichidan tarqatiladi: `mvn -Pwith-frontend package`.
 * - /assets/* fayl nomida xesh bor, shuning uchun bir yil keshlanadi;
 * - sayt sahifalari (/jadval, /admin/natijalar ...) uchun index.html qaytariladi, marshrutni React hal qiladi;
 * - API va mavjud bo'lmagan fayllar uchun index.html qaytarilmaydi (404).
 * Ishlab chiqishda static papka bo'lmaydi va frontend Vite orqali ochiladi.
 */
@Configuration
public class SpaConfig implements WebMvcConfigurer {

    private static final String STATIC = "classpath:/static/";

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/assets/**")
                .addResourceLocations(STATIC + "assets/")
                .setCacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic().immutable());

        registry.addResourceHandler("/**")
                .addResourceLocations(STATIC)
                .setCacheControl(CacheControl.noCache())
                .resourceChain(true)
                .addResolver(new SpaFallbackResolver());
    }

    public static final class SpaFallbackResolver extends PathResourceResolver {
        @Override
        protected Resource getResource(String resourcePath, Resource location) throws IOException {
            Resource requested = location.createRelative(resourcePath);
            if (requested.exists() && requested.isReadable()) return requested;
            if (!isAppRoute(resourcePath)) return null;
            Resource index = location.createRelative("index.html");
            return index.exists() && index.isReadable() ? index : null;
        }

        /** Nuqtasiz va API bo'lmagan yo'l — sayt sahifasi */
        public static boolean isAppRoute(String path) {
            return !path.startsWith("api/") && !path.startsWith("media/") && !path.startsWith("actuator/") && !path.contains(".");
        }
    }
}
