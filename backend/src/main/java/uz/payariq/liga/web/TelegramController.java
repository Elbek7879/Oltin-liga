package uz.payariq.liga.web;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import uz.payariq.liga.common.ApiException;
import uz.payariq.liga.model.AppUser;
import uz.payariq.liga.security.CurrentUser;
import uz.payariq.liga.telegram.TelegramLinkService;
import uz.payariq.liga.telegram.TelegramLinkService.LinkCode;
import uz.payariq.liga.telegram.TelegramLinkService.Status;

/** «Hisobim» sahifasi: admin o'z Telegram akkauntini botga ulaydi yoki uzadi */
@RestController
@RequestMapping("/api/auth/telegram")
public class TelegramController {

    private final TelegramLinkService links;
    private final CurrentUser currentUser;

    public TelegramController(TelegramLinkService links, CurrentUser currentUser) {
        this.links = links;
        this.currentUser = currentUser;
    }

    @GetMapping
    public Status status() {
        return links.status(me());
    }

    @PostMapping("/link")
    public LinkCode link() {
        return links.createCode(me());
    }

    @DeleteMapping
    public ResponseEntity<Void> unlink() {
        links.unlink(me());
        return ResponseEntity.noContent().build();
    }

    private AppUser me() {
        return currentUser.get().orElseThrow(() -> ApiException.badRequest("Avval tizimga kiring."));
    }
}
