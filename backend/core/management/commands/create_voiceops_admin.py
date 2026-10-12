from getpass import getpass

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Create the initial VoiceOps administrator interactively (no default credentials)."

    def handle(self, *args, **options):
        User = get_user_model()

        if User._default_manager.filter(is_active=True, is_superuser=True).exists():
            raise CommandError(
                "An active administrator already exists. No second administrator was created. "
                "Use 'python manage.py changepassword <username>' to reset its password."
            )

        username_field = User.USERNAME_FIELD
        username = input(f"{username_field.capitalize()}: ").strip()
        if not username:
            raise CommandError("Username cannot be empty.")

        lookup = {username_field: username}
        if User._default_manager.filter(**lookup).exists():
            raise CommandError(f"An account with that {username_field} already exists.")

        password = getpass("Password (input hidden): ")
        confirmation = getpass("Confirm password: ")
        if not password:
            raise CommandError("Password cannot be empty.")
        if password != confirmation:
            raise CommandError("Passwords did not match. No account was created.")

        candidate = User(**lookup)
        try:
            validate_password(password, user=candidate)
        except ValidationError as exc:
            raise CommandError(" ".join(exc.messages)) from exc

        User._default_manager.create_superuser(**lookup, password=password)
        self.stdout.write(self.style.SUCCESS(
            f"VoiceOps administrator '{username}' created. The password is stored as a hash in Django's database."
        ))
        self.stdout.write("No default login credentials are configured in the source code.")
