from django.db import models
from core.models import FoodPoint, User


class MessMealSession(models.Model):
    """A breakfast/lunch/dinner session at a mess on a specific date."""

    class MealType(models.TextChoices):
        BREAKFAST = 'BREAKFAST', 'Breakfast'
        LUNCH = 'LUNCH', 'Lunch'
        DINNER = 'DINNER', 'Dinner'
        SNACKS = 'SNACKS', 'Snacks'

    food_point = models.ForeignKey(FoodPoint, on_delete=models.CASCADE, related_name='meal_sessions')
    session_date = models.DateField()
    meal_type = models.CharField(max_length=10, choices=MealType.choices)
    notes = models.CharField(max_length=255, blank=True, default='')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_sessions')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'mess_meal_session'
        unique_together = ('food_point', 'session_date', 'meal_type')

    def __str__(self):
        return f'{self.meal_type} @ {self.food_point.name} on {self.session_date}'


class MessMealRecord(models.Model):
    """Student attendance and payment for a mess meal session."""

    class AttendanceStatus(models.TextChoices):
        SERVED = 'SERVED', 'Served'
        ABSENT = 'ABSENT', 'Absent'
        EXEMPT = 'EXEMPT', 'Exempt'

    class PaymentStatus(models.TextChoices):
        PAID = 'PAID', 'Paid'
        PENDING = 'PENDING', 'Pending'
        EXEMPT = 'EXEMPT', 'Exempt'

    session = models.ForeignKey(MessMealSession, on_delete=models.CASCADE, related_name='records')
    student_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='mess_records')
    attendance_status = models.CharField(max_length=10, choices=AttendanceStatus.choices, default=AttendanceStatus.SERVED)
    amount_due = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    payment_status = models.CharField(max_length=10, choices=PaymentStatus.choices, default=PaymentStatus.PENDING)
    recorded_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='recorded_meal_records')
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'mess_meal_record'
        unique_together = ('session', 'student_user')
        constraints = [
            models.CheckConstraint(condition=models.Q(amount_due__gte=0), name='chk_meal_amount'),
        ]

    def __str__(self):
        return f'{self.student_user} — {self.session}'
