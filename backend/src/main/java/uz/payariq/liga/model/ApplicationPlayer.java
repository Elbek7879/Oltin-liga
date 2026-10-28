package uz.payariq.liga.model;

import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import java.util.Objects;
import uz.payariq.liga.domain.Position;

/** Arizadagi bitta futbolchi: ism, familiya, pozitsiya va (ixtiyoriy) tug'ilgan yil */
@Embeddable
public class ApplicationPlayer {
    public String firstName;
    public String lastName;
    public Integer birthYear;

    @Enumerated(EnumType.STRING)
    public Position position;

    public ApplicationPlayer() {
    }

    public ApplicationPlayer(String firstName, String lastName, Integer birthYear, Position position) {
        this.firstName = firstName;
        this.lastName = lastName;
        this.birthYear = birthYear;
        this.position = position;
    }

    public String fullName() {
        return firstName + " " + lastName;
    }

    @Override
    public boolean equals(Object o) {
        return o instanceof ApplicationPlayer p && Objects.equals(firstName, p.firstName) && Objects.equals(lastName, p.lastName)
                && Objects.equals(birthYear, p.birthYear) && position == p.position;
    }

    @Override
    public int hashCode() {
        return Objects.hash(firstName, lastName, birthYear, position);
    }
}
