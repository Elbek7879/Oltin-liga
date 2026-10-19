package uz.payariq.liga.web;

import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import uz.payariq.liga.service.UserService;
import uz.payariq.liga.web.Dto.UserDto;

/** Yordamchilar akkauntlari — faqat bosh tashkilotchi (SecurityConfig) */
@RestController
@RequestMapping("/api/admin/users")
public class UserController {

    private final UserService users;

    public UserController(UserService users) {
        this.users = users;
    }

    @GetMapping
    public List<UserDto> list() {
        return users.list();
    }

    @PostMapping
    public UserDto create(@Valid @RequestBody Requests.UserCreate in) {
        return users.create(in);
    }

    @PutMapping("/{id}")
    public UserDto update(@PathVariable UUID id, @Valid @RequestBody Requests.UserUpdate in) {
        return users.update(id, in);
    }

    @PutMapping("/{id}/password")
    public ResponseEntity<Void> resetPassword(@PathVariable UUID id, @Valid @RequestBody Requests.PasswordReset in) {
        users.resetPassword(id, in);
        return ResponseEntity.noContent().build();
    }
}
