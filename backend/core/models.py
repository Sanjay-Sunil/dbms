from django.contrib.auth.models import AbstractUser, UserManager
from django.db import models


class AppUserManager(UserManager):
    def create_superuser(self, username, email=None, password=None, **extra_fields):
        extra_fields.setdefault('role', User.Role.ADMIN)
        return super().create_superuser(username, email, password, **extra_fields)


class User(AbstractUser):
    """Custom user with role-based access."""

    class Role(models.TextChoices):
        STUDENT = 'STUDENT', 'Student'
        STAFF = 'STAFF', 'Staff'
        ADMIN = 'ADMIN', 'Admin'

    role = models.CharField(max_length=10, choices=Role.choices, default=Role.STUDENT)
    student_roll_no = models.CharField(max_length=30, unique=True, null=True, blank=True)
    phone = models.CharField(max_length=20, blank=True, default='')
    is_active = models.BooleanField(default=True)

    objects = AppUserManager()

    class Meta:
        db_table = 'app_user'
        constraints = [
            # A roll number exists exactly when the user is a student.
            models.CheckConstraint(
                condition=(models.Q(role='STUDENT', student_roll_no__isnull=False)
                           | (~models.Q(role='STUDENT') & models.Q(student_roll_no__isnull=True))),
                name='chk_student_roll_role',
            ),
        ]

    def __str__(self):
        return f'{self.full_name} ({self.role})'

    @property
    def full_name(self):
        return f'{self.first_name} {self.last_name}'.strip() or self.username

    @property
    def is_admin_user(self):
        return self.role == self.Role.ADMIN

    @property
    def is_staff_user(self):
        return self.role == self.Role.STAFF

    @property
    def is_student_user(self):
        return self.role == self.Role.STUDENT


class FoodPoint(models.Model):
    """Campus food points — shops and mess canteens."""

    class PointType(models.TextChoices):
        SHOP = 'SHOP', 'Shop'
        MESS = 'MESS', 'Mess'

    name = models.CharField(max_length=80, unique=True)
    point_type = models.CharField(max_length=4, choices=PointType.choices, default=PointType.SHOP)
    location_description = models.CharField(max_length=150, blank=True, default='')
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'food_point'

    def __str__(self):
        return self.name


class Ingredient(models.Model):
    """Master ingredient list used across food points."""

    class Unit(models.TextChoices):
        GRAM = 'g', 'Grams'
        KG = 'kg', 'Kilograms'
        ML = 'ml', 'Millilitres'
        LITRE = 'L', 'Litres'
        PIECE = 'piece', 'Piece'
        PACKET = 'packet', 'Packet'

    ingredient_name = models.CharField(max_length=100, unique=True)
    unit_of_measure = models.CharField(max_length=10, choices=Unit.choices)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'ingredient'

    def __str__(self):
        return f'{self.ingredient_name} ({self.unit_of_measure})'


class StaffAssignment(models.Model):
    """Links a staff user to a food point for a period."""

    staff_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='assignments')
    food_point = models.ForeignKey(FoodPoint, on_delete=models.CASCADE, related_name='staff_assignments')
    assigned_from = models.DateField(auto_now_add=True)
    assigned_until = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'staff_assignment'
        constraints = [
            models.CheckConstraint(
                condition=models.Q(assigned_until__isnull=True)
                | models.Q(assigned_until__gte=models.F('assigned_from')),
                name='chk_assignment_dates',
            ),
        ]

    def __str__(self):
        return f'{self.staff_user} → {self.food_point}'
