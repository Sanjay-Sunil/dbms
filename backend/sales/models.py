from django.db import models
from core.models import FoodPoint, User
from menu.models import MenuItem


class Sale(models.Model):
    """Counter sale header. Student is optional for anonymous purchases."""

    class PaymentMethod(models.TextChoices):
        CASH = 'CASH', 'Cash'
        UPI = 'UPI', 'UPI'
        CARD = 'CARD', 'Card'
        OTHER = 'OTHER', 'Other'

    class PaymentStatus(models.TextChoices):
        PAID = 'PAID', 'Paid'
        PENDING = 'PENDING', 'Pending'
        REFUNDED = 'REFUNDED', 'Refunded'

    food_point = models.ForeignKey(FoodPoint, on_delete=models.CASCADE, related_name='sales')
    recorded_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='recorded_sales')
    student_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='purchases')
    sale_datetime = models.DateTimeField(auto_now_add=True)
    payment_method = models.CharField(max_length=5, choices=PaymentMethod.choices, default=PaymentMethod.CASH)
    payment_status = models.CharField(max_length=10, choices=PaymentStatus.choices, default=PaymentStatus.PAID)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    notes = models.CharField(max_length=255, blank=True, default='')

    class Meta:
        db_table = 'sale'
        indexes = [
            models.Index(fields=['sale_datetime'], name='idx_sale_datetime'),
            models.Index(fields=['food_point', 'sale_datetime'], name='idx_sale_point_datetime'),
            models.Index(fields=['student_user', 'sale_datetime'], name='idx_sale_student_datetime'),
        ]
        constraints = [
            models.CheckConstraint(condition=models.Q(total_amount__gte=0), name='chk_sale_total'),
        ]

    def __str__(self):
        return f'Sale #{self.pk} — ₹{self.total_amount} @ {self.food_point.name}'


class SaleItem(models.Model):
    """Individual item in a counter sale; unit_price preserves historical price."""

    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='items')
    menu_item = models.ForeignKey(MenuItem, on_delete=models.CASCADE, related_name='sale_items')
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = 'sale_item'
        constraints = [
            models.CheckConstraint(condition=models.Q(quantity__gt=0), name='chk_sale_item_qty'),
            models.CheckConstraint(condition=models.Q(unit_price__gte=0), name='chk_sale_item_price'),
        ]

    def __str__(self):
        return f'{self.quantity}x {self.menu_item.item_name} @ ₹{self.unit_price}'

    @property
    def line_total(self):
        return self.quantity * self.unit_price
