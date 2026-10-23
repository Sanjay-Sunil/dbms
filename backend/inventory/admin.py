from django.contrib import admin
from .models import InventoryStock, StockMovement


@admin.register(InventoryStock)
class InventoryStockAdmin(admin.ModelAdmin):
    list_display = ('food_point', 'ingredient', 'quantity_on_hand', 'reorder_level', 'is_low')
    list_filter = ('food_point',)


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ('food_point', 'ingredient', 'movement_type', 'quantity_change', 'recorded_by', 'created_at')
    list_filter = ('movement_type', 'food_point')
