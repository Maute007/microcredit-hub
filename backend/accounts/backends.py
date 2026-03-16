from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend


User = get_user_model()


class UsernameOrEmailBackend(ModelBackend):
    """
    Authenticate by username or email.
    User can choose either when logging in.
    """

    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None or password is None:
            return None
        from django.db.models import Q

        user = User.objects.filter(
            Q(username__iexact=username) | Q(email__iexact=username)
        ).first()
        if user and user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
