package uz.payariq.liga.web;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import uz.payariq.liga.service.VisitService;
import uz.payariq.liga.web.Dto.VisitStats;

/** Tashrif statistikasi: sayt har bir ochilgan sahifani yuboradi, tashkilotchilar umumiy sonlarni ko'radi */
@RestController
public class VisitController {

    private final VisitService visits;

    public VisitController(VisitService visits) {
        this.visits = visits;
    }

    /** Javob doim 204: muxlis sahifasi hisob natijasini kutmaydi va xato ko'rmaydi */
    @PostMapping("/api/public/visit")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void visit(@RequestBody(required = false) Requests.Visit in, HttpServletRequest request) {
        // Tizimga kirgan tashkilotchining o'zi saytni ko'rsa, sanalmaydi
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !(auth instanceof AnonymousAuthenticationToken)) return;
        // Bitta manzildan juda ko'p so'rov — statistikani sun'iy oshirishga urinish, sanalmaydi
        if (!visits.allow(request.getRemoteAddr())) return;
        visits.record(in, request.getHeader(HttpHeaders.USER_AGENT), request.getServerName());
    }

    @GetMapping("/api/admin/visits")
    public VisitStats stats() {
        return visits.stats();
    }
}
