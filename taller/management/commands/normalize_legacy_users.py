from __future__ import annotations

from dataclasses import dataclass

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError


@dataclass
class UserResolution:
    user: User
    found_by: str


def resolve_user(identifier: str) -> UserResolution:
    identifier = (identifier or "").strip()
    if not identifier:
        raise CommandError("Debés indicar un identificador de usuario.")

    if identifier.isdigit():
        try:
            user = User.objects.get(pk=int(identifier))
            return UserResolution(user=user, found_by="id")
        except User.DoesNotExist as exc:
            raise CommandError(f"No existe un usuario con id={identifier}.") from exc

    try:
        user = User.objects.get(email__iexact=identifier)
        return UserResolution(user=user, found_by="email")
    except User.DoesNotExist:
        pass

    try:
        user = User.objects.get(username__iexact=identifier)
        return UserResolution(user=user, found_by="username")
    except User.DoesNotExist as exc:
        raise CommandError(
            f"No encontré un usuario con email o username igual a '{identifier}'."
        ) from exc


class Command(BaseCommand):
    help = (
        "Normaliza usuarios legacy para el nuevo flujo de login: "
        "completa email si falta, baja a minúsculas usernames tipo email "
        "y permite resetear contraseña de una cuenta puntual."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Aplica los cambios. Sin esto, el comando corre en modo reporte.",
        )
        parser.add_argument(
            "--identifier",
            help="Usuario objetivo por id, email o username.",
        )
        parser.add_argument(
            "--set-email",
            help="Asigna manualmente un email al usuario indicado en --identifier.",
        )
        parser.add_argument(
            "--set-password",
            help="Define una nueva contraseña para el usuario indicado en --identifier.",
        )

    def handle(self, *args, **options):
        apply_changes = options["apply"]
        identifier = options.get("identifier")
        set_email = (options.get("set_email") or "").strip()
        set_password = options.get("set_password")

        if (set_email or set_password) and not identifier:
            raise CommandError(
                "Si usás --set-email o --set-password, también debés indicar --identifier."
            )

        if identifier:
            self._handle_targeted_update(
                identifier=identifier,
                set_email=set_email,
                set_password=set_password,
                apply_changes=apply_changes,
            )

        self._handle_bulk_normalization(apply_changes=apply_changes)

        if not apply_changes:
            self.stdout.write(
                self.style.WARNING(
                    "Modo reporte: no se guardó nada. Repetí con --apply para aplicar cambios."
                )
            )

    def _handle_targeted_update(
        self,
        *,
        identifier: str,
        set_email: str,
        set_password: str | None,
        apply_changes: bool,
    ) -> None:
        result = resolve_user(identifier)
        user = result.user
        changed = False

        self.stdout.write(
            f"Usuario objetivo encontrado por {result.found_by}: "
            f"id={user.id} username='{user.username}' email='{user.email or '-'}'"
        )

        if set_email:
            normalized_email = set_email.lower()
            if (
                User.objects.exclude(pk=user.pk)
                .filter(email__iexact=normalized_email)
                .exists()
            ):
                raise CommandError(
                    f"Ya existe otro usuario con el email '{normalized_email}'."
                )
            if user.email != normalized_email:
                self.stdout.write(
                    f"  - email: '{user.email or '-'}' -> '{normalized_email}'"
                )
                user.email = normalized_email
                changed = True

        if set_password:
            self.stdout.write("  - contraseña: será reemplazada por la nueva clave indicada")
            user.set_password(set_password)
            changed = True

        if changed and apply_changes:
            user.save()
            self.stdout.write(self.style.SUCCESS("  Cambios puntuales aplicados."))
        elif changed:
            self.stdout.write("  Cambios puntuales detectados.")
        else:
            self.stdout.write("  No hubo cambios puntuales para aplicar.")

    def _handle_bulk_normalization(self, *, apply_changes: bool) -> None:
        self.stdout.write("")
        self.stdout.write("Normalización masiva de usuarios legacy:")

        changed_count = 0
        for user in User.objects.order_by("id"):
            original_username = user.username or ""
            original_email = user.email or ""
            next_username = original_username
            next_email = original_email
            notes: list[str] = []

            if original_username and "@" in original_username:
                username_lower = original_username.lower()
                if username_lower != original_username:
                    next_username = username_lower
                    notes.append("username en minúsculas")
                if not original_email:
                    next_email = username_lower
                    notes.append("email copiado desde username")

            if original_email:
                email_lower = original_email.lower()
                if email_lower != original_email:
                    next_email = email_lower
                    notes.append("email en minúsculas")

            if next_email and (
                User.objects.exclude(pk=user.pk).filter(email__iexact=next_email).exists()
            ):
                notes.append(f"conflicto de email '{next_email}'")
                next_email = original_email

            if next_username != original_username or next_email != original_email:
                changed_count += 1
                self.stdout.write(
                    f"- id={user.id} username='{original_username}' email='{original_email or '-'}'"
                )
                self.stdout.write(
                    f"  -> username='{next_username}' email='{next_email or '-'}' "
                    f"[{', '.join(notes)}]"
                )
                if apply_changes:
                    user.username = next_username
                    user.email = next_email
                    user.save(update_fields=["username", "email"])

        if changed_count == 0:
            self.stdout.write(self.style.SUCCESS("No hay usuarios legacy para normalizar."))
        elif apply_changes:
            self.stdout.write(
                self.style.SUCCESS(f"Normalización aplicada sobre {changed_count} usuario(s).")
            )
        else:
            self.stdout.write(f"Se detectaron {changed_count} usuario(s) con cambios posibles.")
