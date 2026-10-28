package uz.payariq.liga.service;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import uz.payariq.liga.common.ApiException;

/**
 * Yuklangan rasmlar papkasi. Faqat PNG, JPEG va WebP qabul qilinadi; turi fayl mazmunidan (magic bytes)
 * tekshiriladi, nomi tasodifiy beriladi — yo'l bilan hujum qilib bo'lmaydi.
 */
@Component
public class MediaStorage {

    public static final Pattern SAFE_NAME = Pattern.compile("^[0-9a-f-]{36}\\.(png|jpg|webp)$");
    private static final Pattern URL = Pattern.compile("^/media/([0-9a-f-]{36}\\.(?:png|jpg|webp))$");
    private static final long MAX_BYTES = 3L * 1024 * 1024;

    private final Path dir;

    public MediaStorage(@Value("${liga.media.dir:uploads}") String dir) throws IOException {
        this.dir = Path.of(dir).toAbsolutePath().normalize();
        Files.createDirectories(this.dir);
    }

    public Path dir() {
        return dir;
    }

    /** Rasmni tekshiradi va saqlaydi; qaytaradi: saytdagi manzili (/media/…) */
    public String store(MultipartFile file) {
        if (file == null || file.isEmpty()) throw ApiException.badRequest("Fayl tanlanmagan.");
        if (file.getSize() > MAX_BYTES) throw ApiException.badRequest("Fayl juda katta. 3 MB dan kichik rasm yuklang.");
        try {
            String ext;
            try (InputStream in = file.getInputStream()) {
                ext = detect(in.readNBytes(12));
            }
            if (ext == null) throw ApiException.badRequest("Faqat PNG, JPG yoki WebP rasm yuklash mumkin.");
            String name = UUID.randomUUID() + "." + ext;
            Path target = dir.resolve(name).normalize();
            if (!target.startsWith(dir)) throw ApiException.badRequest("Fayl nomi noto‘g‘ri.");
            file.transferTo(target);
            return "/media/" + name;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** O'zimiz yuklagan rasmni o'chiradi; boshqa manzil yoki yo'q fayl jimgina e'tiborsiz qoldiriladi */
    public void delete(String url) {
        if (url == null) return;
        Matcher m = URL.matcher(url);
        if (!m.matches()) return;
        Path file = dir.resolve(m.group(1)).normalize();
        if (!file.startsWith(dir)) return;
        try {
            Files.deleteIfExists(file);
        } catch (IOException ignored) {
            // Fayl band yoki ruxsat yo'q — rasm keyinroq qo'lda tozalanadi, asosiy amal to'xtamaydi
        }
    }

    /** Fayl turini birinchi baytlaridan aniqlaydi */
    static String detect(byte[] h) {
        if (h.length >= 8 && (h[0] & 0xFF) == 0x89 && h[1] == 'P' && h[2] == 'N' && h[3] == 'G') return "png";
        if (h.length >= 3 && (h[0] & 0xFF) == 0xFF && (h[1] & 0xFF) == 0xD8 && (h[2] & 0xFF) == 0xFF) return "jpg";
        if (h.length >= 12 && h[0] == 'R' && h[1] == 'I' && h[2] == 'F' && h[3] == 'F' && h[8] == 'W' && h[9] == 'E' && h[10] == 'B' && h[11] == 'P') return "webp";
        return null;
    }
}
