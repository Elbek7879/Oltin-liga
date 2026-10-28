package uz.payariq.liga.web;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import uz.payariq.liga.service.ApplicationService;
import uz.payariq.liga.web.Dto.AcceptedApplication;
import uz.payariq.liga.web.Dto.ApplicationCounts;
import uz.payariq.liga.web.Dto.FeedbackDto;
import uz.payariq.liga.web.Dto.TeamApplicationDto;

/**
 * Murojaatlar: sayt tomonidan yangi mavsumga qo'shilish arizasi hamda taklif va shikoyatlar yuboriladi,
 * admin panelining «Arizalar» bo'limida ko'rib chiqiladi (faqat bosh tashkilotchi va administrator).
 */
@RestController
public class ApplicationController {

    private final ApplicationService service;

    public ApplicationController(ApplicationService service) {
        this.service = service;
    }

    /** Ariza ma'lumotlari JSON qismida (data), logotip — alohida fayl qismida (logo) */
    @PostMapping(value = "/api/public/applications/team", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void submitTeam(@RequestPart("data") Requests.TeamApplicationInput in, @RequestPart(value = "logo", required = false) MultipartFile logo,
                           HttpServletRequest request) {
        service.submitTeam(in, logo, request.getRemoteAddr());
    }

    @PostMapping("/api/public/applications/feedback")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void submitFeedback(@RequestBody Requests.FeedbackInput in, HttpServletRequest request) {
        service.submitFeedback(in, request.getRemoteAddr());
    }

    // ---------- Admin ----------

    @GetMapping("/api/admin/applications/counts")
    public ApplicationCounts counts() {
        return service.counts();
    }

    @GetMapping("/api/admin/applications/teams")
    public List<TeamApplicationDto> teams() {
        return service.listTeams();
    }

    /** Jamoa avtomatik ravishda yangi (tayyorlanayotgan) mavsumga qo'shiladi; boshlangan mavsumga qo'shilmaydi */
    @PostMapping("/api/admin/applications/teams/{id}/accept")
    public AcceptedApplication accept(@PathVariable UUID id) {
        return service.accept(id);
    }

    @PostMapping("/api/admin/applications/teams/{id}/ignore")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void ignore(@PathVariable UUID id) {
        service.ignore(id);
    }

    @PostMapping("/api/admin/applications/teams/{id}/restore")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void restore(@PathVariable UUID id) {
        service.restore(id);
    }

    @DeleteMapping("/api/admin/applications/teams/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteApplication(@PathVariable UUID id) {
        service.deleteApplication(id);
    }

    @GetMapping("/api/admin/applications/messages")
    public List<FeedbackDto> messages() {
        return service.listMessages();
    }

    @PostMapping("/api/admin/applications/messages/read-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markAllRead() {
        service.markAllRead();
    }

    @PostMapping("/api/admin/applications/messages/{id}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markRead(@PathVariable UUID id) {
        service.markRead(id);
    }

    @DeleteMapping("/api/admin/applications/messages/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMessage(@PathVariable UUID id) {
        service.deleteMessage(id);
    }
}
