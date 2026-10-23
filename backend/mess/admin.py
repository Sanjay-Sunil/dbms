from django.contrib import admin
from .models import MessMealSession, MessMealRecord


class MessMealRecordInline(admin.TabularInline):
    model = MessMealRecord
    extra = 1


@admin.register(MessMealSession)
class MessMealSessionAdmin(admin.ModelAdmin):
    list_display = ('food_point', 'session_date', 'meal_type', 'created_by')
    list_filter = ('food_point', 'meal_type')
    inlines = [MessMealRecordInline]
