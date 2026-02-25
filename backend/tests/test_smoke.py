import pytest
from django.contrib.auth.models import User


@pytest.mark.django_db
def test_user_creation():
    user = User.objects.create_user(username='smoke', password='smoke-pass')
    assert user.id is not None
