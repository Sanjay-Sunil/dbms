from rest_framework import serializers
from core.models import FoodPoint, Ingredient, StaffAssignment
from menu.models import MenuItem, MenuRecipe
from inventory.models import InventoryStock, StockMovement
from sales.models import Sale, SaleItem
from mess.models import MessMealSession, MessMealRecord
from accounts.serializers import UserSerializer


# ── Core ──────────────────────────────────────────

class FoodPointSerializer(serializers.ModelSerializer):
    class Meta:
        model = FoodPoint
        fields = '__all__'


class IngredientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ingredient
        fields = '__all__'


class StaffAssignmentSerializer(serializers.ModelSerializer):
    staff_name = serializers.CharField(source='staff_user.full_name', read_only=True)
    food_point_name = serializers.CharField(source='food_point.name', read_only=True)

    class Meta:
        model = StaffAssignment
        fields = '__all__'


# ── Menu ──────────────────────────────────────────

class MenuRecipeSerializer(serializers.ModelSerializer):
    ingredient_name = serializers.CharField(source='ingredient.ingredient_name', read_only=True)
    unit = serializers.CharField(source='ingredient.unit_of_measure', read_only=True)

    class Meta:
        model = MenuRecipe
        fields = ('id', 'ingredient', 'ingredient_name', 'unit', 'quantity_required')


class MenuItemSerializer(serializers.ModelSerializer):
    food_point_name = serializers.CharField(source='food_point.name', read_only=True)
    recipes = MenuRecipeSerializer(many=True, read_only=True)

    class Meta:
        model = MenuItem
        fields = ('id', 'food_point', 'food_point_name', 'item_name', 'category',
                  'description', 'current_price', 'is_available', 'recipes')


class MenuItemListSerializer(serializers.ModelSerializer):
    """Lightweight menu item for browse views."""
    food_point_name = serializers.CharField(source='food_point.name', read_only=True)

    class Meta:
        model = MenuItem
        fields = ('id', 'food_point', 'food_point_name', 'item_name', 'category',
                  'description', 'current_price', 'is_available')


# ── Inventory ─────────────────────────────────────

class InventoryStockSerializer(serializers.ModelSerializer):
    ingredient_name = serializers.CharField(source='ingredient.ingredient_name', read_only=True)
    unit = serializers.CharField(source='ingredient.unit_of_measure', read_only=True)
    food_point_name = serializers.CharField(source='food_point.name', read_only=True)
    is_low = serializers.BooleanField(read_only=True)

    class Meta:
        model = InventoryStock
        fields = '__all__'


class StockMovementSerializer(serializers.ModelSerializer):
    ingredient_name = serializers.CharField(source='ingredient.ingredient_name', read_only=True)
    recorded_by_name = serializers.CharField(source='recorded_by.full_name', read_only=True)

    class Meta:
        model = StockMovement
        fields = '__all__'
        read_only_fields = ('created_at', 'recorded_by', 'sale')


# ── Sales ─────────────────────────────────────────

class SaleItemSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source='menu_item.item_name', read_only=True)
    line_total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = SaleItem
        fields = ('id', 'menu_item', 'item_name', 'quantity', 'unit_price', 'line_total')


class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True, read_only=True)
    food_point_name = serializers.CharField(source='food_point.name', read_only=True)
    recorded_by_name = serializers.CharField(source='recorded_by.full_name', read_only=True)
    student_name = serializers.CharField(source='student_user.full_name', read_only=True, default=None)

    class Meta:
        model = Sale
        fields = '__all__'
        read_only_fields = ('sale_datetime', 'total_amount')


class SaleLineSerializer(serializers.Serializer):
    menu_item_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)


class SaleCreateSerializer(serializers.Serializer):
    """Used to create a sale with items in one request."""
    food_point_id = serializers.IntegerField()
    student_user_id = serializers.IntegerField(required=False, allow_null=True)
    payment_method = serializers.ChoiceField(choices=Sale.PaymentMethod.choices, default='CASH')
    notes = serializers.CharField(required=False, default='', allow_blank=True)
    items = SaleLineSerializer(many=True, allow_empty=False)


# ── Mess ──────────────────────────────────────────

class MessMealRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student_user.full_name', read_only=True)
    student_roll = serializers.CharField(source='student_user.student_roll_no', read_only=True)

    class Meta:
        model = MessMealRecord
        fields = '__all__'
        read_only_fields = ('recorded_at', 'recorded_by')


class MessMealSessionSerializer(serializers.ModelSerializer):
    records = MessMealRecordSerializer(many=True, read_only=True)
    food_point_name = serializers.CharField(source='food_point.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)

    class Meta:
        model = MessMealSession
        fields = '__all__'
        read_only_fields = ('created_at', 'created_by')


class MessMealSessionListSerializer(serializers.ModelSerializer):
    food_point_name = serializers.CharField(source='food_point.name', read_only=True)

    class Meta:
        model = MessMealSession
        fields = ('id', 'food_point', 'food_point_name', 'session_date', 'meal_type', 'notes')
