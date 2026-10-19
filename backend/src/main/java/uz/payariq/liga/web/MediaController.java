package uz.payariq.liga.web;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import uz.payariq.liga.common.ApiException;
import uz.payariq.liga.service.AuditService;
import uz.payariq.liga.web.Dto.MediaDto;

/**
 * Logotip va rasmlarni yuklash. Faqat PNG, JPEG va WebP qabul qilinadi; turi fayl
 * mazmunidan (magic bytes) tekshiriladi, nomi tasodifiy beriladi — yo'l bilan hujum qilib bo'lmaydi.
 */
@RestController
public class MediaController {

    private static final Pattern SAFE_NAME = Pattern.compile("^[0-9a-f-]{36}\\.(png|jpg|webp)$");
    private static final long MAX_BYTES = 3L * 1024 * 1024;

    private final Path dir;
    private final AuditService audit;

    public MediaController(@Value("${liga.media.dir:uploads}") String dir, AuditService audit) throws IOException {
        this.dir = Path.of(dir).toAbsolutePath().normalize();
        Files.createDirectories(this.dir);
        this.audit = audit;
    }

    @PostMapping("/api/admin/media")
    public MediaDto upload(@RequestParam("file") MultipartFile file) throws IOException {
        if (file.isEmpty()) throw ApiException.badRequest("Fayl tanlanmagan.");
        if (file.getSize() > MAX_BYTES) throw ApiException.badRequest("Fayl juda katta. 3 MB dan kichik rasm yuklang.");
        String ext;
        try (InputStream in = file.getInputStream()) {
            ext = detect(in.readNBytes(12));
        }
        if (ext == null) throw ApiException.badRequest("Faqat PNG, JPG yoki WebP rasm yuklash mumkin.");
        String name = UUID.randomUUID() + "." + ext;
        Path target = dir.resolve(name).normalize();
        if (!target.startsWith(dir)) throw ApiException.badRequest("Fayl nomi noto‘g‘ri.");
        file.transferTo(target);
        audit.record("Rasm", "Rasm yuklandi: " + name, "MEDIA", null);
        return new MediaDto("/media/" + name);
    }

    @GetMapping("/media/{name}")
    public ResponseEntity<Resource> serve(@PathVariable String name) {
        if (!SAFE_NAME.matcher(name).matches()) throw ApiException.notFound("Rasm topilmadi.");
        Path file = dir.resolve(name).normalize();
        if (!file.startsWith(dir) || !Files.exists(file)) throw ApiException.notFound("Rasm topilmadi.");
        MediaType type = name.endsWith(".png") ? MediaType.IMAGE_PNG : name.endsWith(".jpg") ? MediaType.IMAGE_JPEG : MediaType.parseMediaType("image/webp");
        return ResponseEntity.ok()
                .contentType(type)
                .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
                .header("X-Content-Type-Options", "nosniff")
                .body(new FileSystemResource(file));
    }

    /** Fayl turini birinchi baytlaridan aniqlaydi */
    static String detect(byte[] h) {
        if (h.length >= 8 && (h[0] & 0xFF) == 0x89 && h[1] == 'P' && h[2] == 'N' && h[3] == 'G') return "png";
        if (h.length >= 3 && (h[0] & 0xFF) == 0xFF && (h[1] & 0xFF) == 0xD8 && (h[2] & 0xFF) == 0xFF) return "jpg";
        if (h.length >= 12 && h[0] == 'R' && h[1] == 'I' && h[2] == 'F' && h[3] == 'F' && h[8] == 'W' && h[9] == 'E' && h[10] == 'B' && h[11] == 'P') return "webp";
        return null;
    }
}
