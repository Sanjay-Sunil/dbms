from django.contrib import admin
from .models import User, FoodPoint, Ingredient, StaffAssignment


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('username', 'full_name', 'role', 'student_roll_no', 'is_active')
    list_filter = ('role', 'is_active')
    search_fields = ('username', 'first_name', 'last_name', 'student_roll_no')


@admin.register(FoodPoint)
class FoodPointAdmin(admin.ModelAdmin):
    list_display = ('name', 'point_type', 'location_description', 'is_active')
    list_filter = ('point_type', 'is_active')


@admin.register(Ingredient)
class IngredientAdmin(admin.ModelAdmin):
    list_display = ('ingredient_name', 'unit_of_measure', 'is_active')
    list_filter = ('unit_of_measure',)
    search_fields = ('ingredient_name',)


@admin.register(StaffAssignment)
class StaffAssignmentAdmin(admin.ModelAdmin):
    list_display = ('staff_user', 'food_point', 'assigned_from', 'assigned_until', 'is_active')
    list_filter = ('is_active', 'food_point')
