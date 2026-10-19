package uz.payariq.liga.security;

import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import uz.payariq.liga.repo.AppUserRepository;

@Service
public class LeagueUserDetailsService implements UserDetailsService {

    private final AppUserRepository users;

    public LeagueUserDetailsService(AppUserRepository users) {
        this.users = users;
    }

    @Override
    public UserDetails loadUserByUsername(String username) {
        return users.findByUsernameIgnoreCase(username.trim())
                .map(u -> User.withUsername(u.username)
                        .password(u.passwordHash)
                        .roles(u.role.name())
                        .disabled(!u.enabled)
                        .build())
                .orElseThrow(() -> new UsernameNotFoundException("Foydalanuvchi topilmadi"));
    }
}
