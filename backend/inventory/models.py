from django.db import models
from core.models import FoodPoint, Ingredient, User


class InventoryStock(models.Model):
    """Current stock level of an ingredient at a food point."""

    food_point = models.ForeignKey(FoodPoint, on_delete=models.CASCADE, related_name='stock')
    ingredient = models.ForeignKey(Ingredient, on_delete=models.CASCADE, related_name='stock_levels')
    quantity_on_hand = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    reorder_level = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'inventory_stock'
        unique_together = ('food_point', 'ingredient')
        constraints = [
            models.CheckConstraint(condition=models.Q(quantity_on_hand__gte=0), name='chk_stock_qty'),
            models.CheckConstraint(condition=models.Q(reorder_level__gte=0), name='chk_reorder_qty'),
        ]

    def __str__(self):
        return f'{self.ingredient.ingredient_name} @ {self.food_point.name}: {self.quantity_on_hand}'

    @property
    def is_low(self):
        return self.quantity_on_hand <= self.reorder_level


class StockMovement(models.Model):
    """Auditable inventory movements: restock, sale consumption, adjustment, waste."""

    class MovementType(models.TextChoices):
        RESTOCK = 'RESTOCK', 'Restock'
        SALE_CONSUMPTION = 'SALE_CONSUMPTION', 'Sale Consumption'
        ADJUSTMENT = 'ADJUSTMENT', 'Adjustment'
        WASTE = 'WASTE', 'Waste'

    food_point = models.ForeignKey(FoodPoint, on_delete=models.PROTECT, related_name='movements')
    ingredient = models.ForeignKey(Ingredient, on_delete=models.PROTECT, related_name='movements')
    movement_type = models.CharField(max_length=20, choices=MovementType.choices)
    quantity_change = models.DecimalField(max_digits=12, decimal_places=3)
    sale = models.ForeignKey('sales.Sale', on_delete=models.SET_NULL, null=True, blank=True, related_name='stock_movements')
    recorded_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name='recorded_movements')
    reason = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'stock_movement'
        indexes = [models.Index(fields=['food_point', 'ingredient', 'created_at'],
                                name='idx_movement_point_ing_date')]
        constraints = [
            models.CheckConstraint(condition=~models.Q(quantity_change=0), name='chk_movement_nonzero'),
        ]

    def __str__(self):
        return f'{self.movement_type}: {self.quantity_change} {self.ingredient.ingredient_name}'
