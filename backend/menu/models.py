from django.db import models
from core.models import FoodPoint, Ingredient


class MenuItem(models.Model):
    """A purchasable item on a food point's menu."""

    food_point = models.ForeignKey(FoodPoint, on_delete=models.CASCADE, related_name='menu_items')
    item_name = models.CharField(max_length=100)
    category = models.CharField(max_length=60, blank=True, default='')
    description = models.CharField(max_length=255, blank=True, default='')
    current_price = models.DecimalField(max_digits=10, decimal_places=2)
    is_available = models.BooleanField(default=True)

    class Meta:
        db_table = 'menu_item'
        unique_together = ('food_point', 'item_name')
        indexes = [models.Index(fields=['food_point', 'is_available'], name='idx_menu_point_available')]
        constraints = [
            models.CheckConstraint(condition=models.Q(current_price__gte=0), name='chk_menu_price'),
        ]

    def __str__(self):
        return f'{self.item_name} @ {self.food_point.name}'


class MenuRecipe(models.Model):
    """Ingredient quantities required for one serving of a menu item."""

    menu_item = models.ForeignKey(MenuItem, on_delete=models.CASCADE, related_name='recipes')
    ingredient = models.ForeignKey(Ingredient, on_delete=models.CASCADE, related_name='recipe_uses')
    quantity_required = models.DecimalField(max_digits=12, decimal_places=3)

    class Meta:
        db_table = 'menu_recipe'
        unique_together = ('menu_item', 'ingredient')
        constraints = [
            models.CheckConstraint(condition=models.Q(quantity_required__gt=0), name='chk_recipe_qty'),
        ]

    def __str__(self):
        return f'{self.menu_item.item_name}: {self.quantity_required} {self.ingredient.unit_of_measure} {self.ingredient.ingredient_name}'
