package uz.payariq.liga.common;

import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/** Barcha xatolar foydalanuvchiga o'zbek tilida, tushunarli ko'rinishda qaytariladi */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    public record ErrorBody(String message, Map<String, String> fields) {
    }

    private static ResponseEntity<ErrorBody> body(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(new ErrorBody(message, null));
    }

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ErrorBody> api(ApiException ex) {
        return body(ex.status(), ex.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ErrorBody> validation(MethodArgumentNotValidException ex) {
        Map<String, String> fields = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(e -> fields.putIfAbsent(e.getField(), e.getDefaultMessage()));
        String first = fields.values().stream().findFirst().orElse("Ma’lumotlarni tekshiring.");
        return ResponseEntity.badRequest().body(new ErrorBody(first, fields));
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<ErrorBody> unreadable(Exception ex) {
        return body(HttpStatus.BAD_REQUEST, "So‘rov ma’lumotlari noto‘g‘ri formatda.");
    }

    @ExceptionHandler(BadCredentialsException.class)
    ResponseEntity<ErrorBody> badCredentials() {
        return body(HttpStatus.UNAUTHORIZED, "Login yoki parol noto‘g‘ri.");
    }

    @ExceptionHandler(DisabledException.class)
    ResponseEntity<ErrorBody> disabled() {
        return body(HttpStatus.FORBIDDEN, "Bu foydalanuvchi o‘chirib qo‘yilgan. Bosh tashkilotchiga murojaat qiling.");
    }

    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    ResponseEntity<ErrorBody> optimisticLock() {
        return body(HttpStatus.CONFLICT, "Bu ma’lumotni boshqa foydalanuvchi hozirgina o‘zgartirdi. Sahifani yangilab, qayta urinib ko‘ring.");
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ErrorBody> integrity(DataIntegrityViolationException ex) {
        log.warn("Ma'lumotlar bazasi cheklovi: {}", ex.getMostSpecificCause().getMessage());
        return body(HttpStatus.CONFLICT, "Saqlab bo‘lmadi: ma’lumot boshqa yozuv bilan to‘qnashmoqda (masalan, takroriy nom yoki raqam).");
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<ErrorBody> tooLarge() {
        return body(HttpStatus.PAYLOAD_TOO_LARGE, "Fayl juda katta. 3 MB dan kichik rasm yuklang.");
    }

    @ExceptionHandler(NoResourceFoundException.class)
    ResponseEntity<ErrorBody> notFound() {
        return body(HttpStatus.NOT_FOUND, "Manzil topilmadi.");
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ResponseEntity<ErrorBody> method() {
        return body(HttpStatus.METHOD_NOT_ALLOWED, "Bu manzil uchun so‘rov turi noto‘g‘ri.");
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ErrorBody> unexpected(Exception ex) {
        log.error("Kutilmagan xato", ex);
        return body(HttpStatus.INTERNAL_SERVER_ERROR, "Serverda kutilmagan xato yuz berdi. Birozdan keyin qayta urinib ko‘ring.");
    }
}
