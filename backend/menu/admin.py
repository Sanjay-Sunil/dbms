from django.contrib import admin
from .models import MenuItem, MenuRecipe


class MenuRecipeInline(admin.TabularInline):
    model = MenuRecipe
    extra = 1


@admin.register(MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
    list_display = ('item_name', 'food_point', 'category', 'current_price', 'is_available')
    list_filter = ('food_point', 'category', 'is_available')
    search_fields = ('item_name',)
    inlines = [MenuRecipeInline]
