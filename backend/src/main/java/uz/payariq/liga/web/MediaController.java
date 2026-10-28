package uz.payariq.liga.web;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
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
import uz.payariq.liga.service.MediaStorage;
import uz.payariq.liga.web.Dto.MediaDto;

/** Logotip va rasmlarni yuklash (tekshirish va saqlash — MediaStorage) hamda saytga tarqatish */
@RestController
public class MediaController {

    private final MediaStorage storage;
    private final AuditService audit;

    public MediaController(MediaStorage storage, AuditService audit) {
        this.storage = storage;
        this.audit = audit;
    }

    @PostMapping("/api/admin/media")
    public MediaDto upload(@RequestParam("file") MultipartFile file) {
        String url = storage.store(file);
        audit.record("Rasm", "Rasm yuklandi: " + url.substring("/media/".length()), "MEDIA", null);
        return new MediaDto(url);
    }

    @GetMapping("/media/{name}")
    public ResponseEntity<Resource> serve(@PathVariable String name) {
        if (!MediaStorage.SAFE_NAME.matcher(name).matches()) throw ApiException.notFound("Rasm topilmadi.");
        Path dir = storage.dir();
        Path file = dir.resolve(name).normalize();
        if (!file.startsWith(dir) || !Files.exists(file)) throw ApiException.notFound("Rasm topilmadi.");
        MediaType type = name.endsWith(".png") ? MediaType.IMAGE_PNG : name.endsWith(".jpg") ? MediaType.IMAGE_JPEG : MediaType.parseMediaType("image/webp");
        return ResponseEntity.ok()
                .contentType(type)
                .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
                .header("X-Content-Type-Options", "nosniff")
                .body(new FileSystemResource(file));
    }
}
