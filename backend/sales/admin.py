from django.contrib import admin
from .models import Sale, SaleItem


class SaleItemInline(admin.TabularInline):
    model = SaleItem
    extra = 1


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ('id', 'food_point', 'recorded_by', 'student_user', 'total_amount', 'payment_method', 'payment_status', 'sale_datetime')
    list_filter = ('food_point', 'payment_method', 'payment_status')
    inlines = [SaleItemInline]
